import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PdfViewerPanel {
    private static readonly viewType = 'cloverleafPdfViewer';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _onDidDispose = new vscode.EventEmitter<void>();
    public readonly onDidDispose = this._onDidDispose.event;
    private _currentPdfPath: string | undefined;

    public get currentPdfPath(): string | undefined {
        return this._currentPdfPath;
    }

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;

        this._panel = vscode.window.createWebviewPanel(
            PdfViewerPanel.viewType,
            'PDF Preview',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: undefined // Allow all local resources
            }
        );

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'syncPdfToTex':
                        vscode.commands.executeCommand(
                            'cloverleaf.syncPdf',
                            message.page,
                            message.x,
                            message.y
                        );
                        break;
                    case 'ready':
                        console.log('PDF viewer ready');
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(`PDF Viewer Error: ${message.text}`);
                        break;
                }
            },
            null,
            this._disposables
        );

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public loadPdf(pdfPath: string) {
        if (!fs.existsSync(pdfPath)) {
            vscode.window.showErrorMessage(`PDF file not found: ${pdfPath}`);
            return;
        }

        this._currentPdfPath = pdfPath;
        const pdfUri = this._panel.webview.asWebviewUri(vscode.Uri.file(pdfPath));
        this._panel.webview.postMessage({
            command: 'loadPdf',
            pdfUrl: pdfUri.toString()
        });
    }

    public reload(pdfPath: string) {
        this.loadPdf(pdfPath);
    }

    public scrollToPosition(position: { page: number; x: number; y: number }) {
        this._panel.webview.postMessage({
            command: 'scrollToPosition',
            ...position
        });
    }

    public reveal(viewColumn?: vscode.ViewColumn) {
        this._panel.reveal(viewColumn);
    }

    public dispose() {
        this._onDidDispose.fire();
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const pdfjsPath = vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'pdfjs-dist');
        const pdfjsLib = webview.asWebviewUri(vscode.Uri.joinPath(pdfjsPath, 'build', 'pdf.js'));
        const pdfjsWorker = webview.asWebviewUri(vscode.Uri.joinPath(pdfjsPath, 'build', 'pdf.worker.js'));
        
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; img-src ${webview.cspSource} data: blob:; connect-src ${webview.cspSource} https:; worker-src ${webview.cspSource} blob:;">
                <title>PDF Preview</title>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                        background-color: var(--vscode-editor-background);
                    }
                    #pdfContainer {
                        position: absolute;
                        top: 40px;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        overflow: auto;
                        text-align: center;
                        background-color: #525659;
                    }
                    #toolbar {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 40px;
                        background-color: var(--vscode-editor-background);
                        border-bottom: 1px solid var(--vscode-widget-border);
                        display: flex;
                        align-items: center;
                        padding: 0 10px;
                        gap: 10px;
                    }
                    .toolbar-button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 5px 10px;
                        cursor: pointer;
                        border-radius: 2px;
                    }
                    .toolbar-button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .page {
                        margin: 10px auto;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                        position: relative;
                    }
                    .synctex-indicator {
                        position: absolute;
                        background-color: rgba(255, 255, 0, 0.4);
                        border: 2px solid #ffff00;
                        pointer-events: none;
                        z-index: 100;
                        animation: fade-out 2s ease-in-out forwards;
                    }
                    @keyframes fade-out {
                        0% { opacity: 1; }
                        50% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    #pageInfo {
                        color: var(--vscode-editor-foreground);
                        margin-left: auto;
                    }
                </style>
            </head>
            <body>
                <div id="toolbar">
                    <button class="toolbar-button" id="zoomOut">-</button>
                    <button class="toolbar-button" id="zoomIn">+</button>
                    <button class="toolbar-button" id="fitPage">Fit Page</button>
                    <button class="toolbar-button" id="fitWidth">Fit Width</button>
                    <span id="pageInfo">Page: <span id="currentPage">0</span> / <span id="totalPages">0</span></span>
                </div>
                <div id="pdfContainer"></div>

                <script src="${pdfjsLib}" nonce="${nonce}"></script>
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    let pdfDoc = null;
                    let scale = 1.5;
                    let currentPage = 1;

                    pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfjsWorker}';

                    window.addEventListener('message', async event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'loadPdf':
                                loadPdf(message.pdfUrl);
                                break;
                            case 'scrollToPosition':
                                scrollToPosition(message.page, message.x, message.y);
                                break;
                        }
                    });

                    async function loadPdf(url) {
                        try {
                            pdfDoc = await pdfjsLib.getDocument(url).promise;
                            document.getElementById('totalPages').textContent = pdfDoc.numPages;
                            
                            document.getElementById('pdfContainer').innerHTML = '';
                            
                            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                                await renderPage(pageNum);
                            }
                            
                            vscode.postMessage({ command: 'ready' });
                        } catch (error) {
                            vscode.postMessage({ command: 'error', text: error.message });
                        }
                    }

                    async function renderPage(pageNumber) {
                        const page = await pdfDoc.getPage(pageNumber);
                        const viewport = page.getViewport({ scale });
                        
                        const container = document.createElement('div');
                        container.className = 'page';
                        container.id = 'page-' + pageNumber;
                        
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        container.appendChild(canvas);
                        document.getElementById('pdfContainer').appendChild(container);
                        
                        await page.render({
                            canvasContext: context,
                            viewport: viewport
                        }).promise;

                        canvas.addEventListener('click', (event) => {
                            // Only trigger sync on Cmd+Shift+Click (Mac) or Ctrl+Shift+Click (Windows/Linux)
                            if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
                                const rect = canvas.getBoundingClientRect();
                                const x = (event.clientX - rect.left) * (canvas.width / rect.width);
                                const y = (event.clientY - rect.top) * (canvas.height / rect.height);

                                vscode.postMessage({
                                    command: 'syncPdfToTex',
                                    page: pageNumber,
                                    x: x / scale,
                                    y: y / scale
                                });
                            }
                        });
                    }

                    function scrollToPosition(page, x, y) {
                        const pageElement = document.getElementById('page-' + page);
                        if (pageElement) {
                            pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            const indicator = document.createElement('div');
                            indicator.className = 'synctex-indicator';
                            indicator.style.left = (x * scale) + 'px';
                            indicator.style.top = (y * scale) + 'px';
                            indicator.style.width = '50px';
                            indicator.style.height = '20px';
                            
                            pageElement.appendChild(indicator);
                            
                            setTimeout(() => indicator.remove(), 2000);
                        }
                        
                        currentPage = page;
                        document.getElementById('currentPage').textContent = page;
                    }

                    async function changeScale(newScale) {
                        scale = newScale;
                        if (pdfDoc) {
                            document.getElementById('pdfContainer').innerHTML = '';
                            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                                await renderPage(pageNum);
                            }
                        }
                    }

                    document.getElementById('zoomIn').addEventListener('click', () => {
                        changeScale(scale * 1.2);
                    });

                    document.getElementById('zoomOut').addEventListener('click', () => {
                        changeScale(scale / 1.2);
                    });

                    document.getElementById('fitPage').addEventListener('click', () => {
                        const container = document.getElementById('pdfContainer');
                        const containerHeight = container.clientHeight - 20;
                        if (pdfDoc) {
                            pdfDoc.getPage(1).then(page => {
                                const viewport = page.getViewport({ scale: 1 });
                                const newScale = containerHeight / viewport.height;
                                changeScale(newScale);
                            });
                        }
                    });

                    document.getElementById('fitWidth').addEventListener('click', () => {
                        const container = document.getElementById('pdfContainer');
                        const containerWidth = container.clientWidth - 20;
                        if (pdfDoc) {
                            pdfDoc.getPage(1).then(page => {
                                const viewport = page.getViewport({ scale: 1 });
                                const newScale = containerWidth / viewport.width;
                                changeScale(newScale);
                            });
                        }
                    });

                    vscode.postMessage({ command: 'ready' });
                </script>
            </body>
            </html>`;
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}