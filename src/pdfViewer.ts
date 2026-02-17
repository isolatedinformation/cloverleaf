import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PdfViewerPanel {
    private static readonly viewType = 'cloverleafPdfViewer';
    private _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _onDidDispose = new vscode.EventEmitter<void>();
    public readonly onDidDispose = this._onDidDispose.event;
    private _currentPdfPath: string | undefined;
    private _localResourceRoots: vscode.Uri[];
    private _isRecreating = false; // Flag to prevent disposal event during recreation

    public get currentPdfPath(): string | undefined {
        return this._currentPdfPath;
    }

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        this._localResourceRoots = [
            this._extensionUri,
            ...(vscode.workspace.workspaceFolders?.map(folder => folder.uri) || [])
        ];

        this._panel = this._createPanel();
    }

    private _createPanel(viewColumn: vscode.ViewColumn = vscode.ViewColumn.Two): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            PdfViewerPanel.viewType,
            'PDF Preview',
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: this._localResourceRoots
            }
        );

        panel.webview.html = this._getHtmlForWebview(panel.webview);

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'syncPdfToTex':
                        vscode.commands.executeCommand('cloverleaf.syncPdf', message.page, message.x, message.y);
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

        panel.onDidDispose(() => {
            // Only trigger full disposal if we're not recreating the panel
            if (!this._isRecreating) {
                this.dispose();
            }
        }, null, this._disposables);
        
        return panel;
    }

    public loadPdf(pdfPath: string) {
        if (!fs.existsSync(pdfPath)) {
            vscode.window.showErrorMessage(`PDF file not found: ${pdfPath}`);
            return;
        }

        this._currentPdfPath = pdfPath;
        const pdfDir = vscode.Uri.file(path.dirname(pdfPath));
        
        const isAllowed = this._localResourceRoots.some(root => 
            pdfDir.fsPath.toLowerCase().startsWith(root.fsPath.toLowerCase())
        );
        
        if (!isAllowed) {
            this._localResourceRoots.push(pdfDir);
            // Dynamic update of localResourceRoots requires panel recreation
            const column = this._panel.viewColumn || vscode.ViewColumn.Two;
            
            // Set flag to prevent triggering disposal event
            this._isRecreating = true;
            this._panel.dispose();
            this._panel = this._createPanel(column);
            this._isRecreating = false;
        }
        
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
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
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
                    body { margin: 0; padding: 0; overflow: hidden; background-color: var(--vscode-editor-background); }
                    #pdfContainer { position: absolute; top: 40px; left: 0; right: 0; bottom: 0; overflow: auto; text-align: center; background-color: #525659; }
                    #pdfContainer.dark-mode { background-color: #1e1e1e; }
                    #toolbar { position: absolute; top: 0; left: 0; right: 0; height: 40px; background-color: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-widget-border); display: flex; align-items: center; padding: 0 10px; gap: 10px; }
                    .toolbar-button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; border-radius: 2px; }
                    .toolbar-button:hover { background: var(--vscode-button-hoverBackground); }
                    .toolbar-button.active { background: var(--vscode-button-secondaryBackground); border: 1px solid var(--vscode-button-border); }
                    .page { margin: 10px auto; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); position: relative; }
                    .page canvas { transition: filter 0.3s ease; }
                    .dark-mode .page canvas { filter: invert(0.9) hue-rotate(180deg); }
                    .synctex-indicator { position: absolute; background-color: rgba(255, 255, 0, 0.4); border: 2px solid #ffff00; pointer-events: none; z-index: 100; animation: fade-out 2s ease-in-out forwards; }
                    @keyframes fade-out { 0% { opacity: 1; } 50% { opacity: 1; } 100% { opacity: 0; } }
                    #pageInfo { color: var(--vscode-editor-foreground); margin-left: auto; }
                </style>
            </head>
            <body>
                <div id="toolbar">
                    <button class="toolbar-button" id="zoomOut" title="Zoom Out">-</button>
                    <button class="toolbar-button" id="zoomIn" title="Zoom In">+</button>
                    <button class="toolbar-button" id="fitPage" title="Fit Page">Fit Page</button>
                    <button class="toolbar-button" id="fitWidth" title="Fit Width">Fit Width</button>
                    <button class="toolbar-button" id="darkMode" title="Toggle Dark Mode">🌙</button>
                    <span id="pageInfo">Page: <span id="currentPage">0</span> / <span id="totalPages">0</span></span>
                </div>
                <div id="pdfContainer"></div>
                <script src="${pdfjsLib}" nonce="${nonce}"></script>
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    let pdfDoc = null;
                    let currentPdfUrl = null;
                    let scale = 1.5;
                    const state = vscode.getState() || {};
                    let isDarkMode = state.darkMode !== undefined ? state.darkMode : true;

                    pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfjsWorker}';

                    function applyDarkMode() {
                        const container = document.getElementById('pdfContainer');
                        const btn = document.getElementById('darkMode');
                        if (isDarkMode) { 
                            container.classList.add('dark-mode'); 
                            btn.classList.add('active');
                            btn.textContent = '☀️'; 
                        } else { 
                            container.classList.remove('dark-mode'); 
                            btn.classList.remove('active');
                            btn.textContent = '🌙'; 
                        }
                        vscode.setState({ ...vscode.getState(), darkMode: isDarkMode });
                    }
                    applyDarkMode();

                    window.addEventListener('message', async event => {
                        const message = event.data;
                        if (message.command === 'loadPdf') { 
                            currentPdfUrl = message.pdfUrl;
                            loadPdf(message.pdfUrl); 
                        } else if (message.command === 'scrollToPosition') { 
                            scrollToPosition(message.page, message.x, message.y); 
                        }
                    });

                    async function loadPdf(url) {
                        try {
                            pdfDoc = await pdfjsLib.getDocument(url).promise;
                            document.getElementById('totalPages').textContent = pdfDoc.numPages;
                            document.getElementById('pdfContainer').innerHTML = '';
                            for (let i = 1; i <= pdfDoc.numPages; i++) { await renderPage(i); }
                            vscode.postMessage({ command: 'ready' });
                        } catch (e) { 
                            vscode.postMessage({ command: 'error', text: e.message }); 
                        }
                    }

                    async function renderPage(num) {
                        const page = await pdfDoc.getPage(num);
                        const viewport = page.getViewport({ scale });
                        const container = document.createElement('div');
                        container.className = 'page';
                        container.id = 'page-' + num;
                        const canvas = document.createElement('canvas');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        container.appendChild(canvas);
                        document.getElementById('pdfContainer').appendChild(container);
                        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                        
                        canvas.addEventListener('click', e => {
                            if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
                                const rect = canvas.getBoundingClientRect();
                                vscode.postMessage({
                                    command: 'syncPdfToTex',
                                    page: num,
                                    x: (e.clientX - rect.left) * (canvas.width / rect.width) / scale,
                                    y: (e.clientY - rect.top) * (canvas.height / rect.height) / scale
                                });
                            }
                        });
                    }

                    function scrollToPosition(page, x, y) {
                        const el = document.getElementById('page-' + page);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const ind = document.createElement('div');
                            ind.className = 'synctex-indicator';
                            ind.style.left = (x * scale) + 'px';
                            ind.style.top = (y * scale) + 'px';
                            ind.style.width = '50px'; 
                            ind.style.height = '20px';
                            el.appendChild(ind);
                            setTimeout(() => ind.remove(), 2000);
                        }
                        document.getElementById('currentPage').textContent = page;
                    }

                    async function changeScale(newScale) {
                        if (!pdfDoc || !currentPdfUrl) return;
                        scale = newScale;
                        await loadPdf(currentPdfUrl);
                    }

                    document.getElementById('darkMode').onclick = () => { 
                        isDarkMode = !isDarkMode; 
                        applyDarkMode(); 
                    };
                    
                    document.getElementById('zoomIn').onclick = () => { 
                        changeScale(scale * 1.2); 
                    };
                    
                    document.getElementById('zoomOut').onclick = () => { 
                        changeScale(scale / 1.2); 
                    };
                    
                    document.getElementById('fitPage').onclick = async () => {
                        if (!pdfDoc) return;
                        const container = document.getElementById('pdfContainer');
                        const containerHeight = container.clientHeight - 20;
                        const page = await pdfDoc.getPage(1);
                        const viewport = page.getViewport({ scale: 1 });
                        const newScale = containerHeight / viewport.height;
                        changeScale(newScale);
                    };
                    
                    document.getElementById('fitWidth').onclick = async () => {
                        if (!pdfDoc) return;
                        const container = document.getElementById('pdfContainer');
                        const containerWidth = container.clientWidth - 20;
                        const page = await pdfDoc.getPage(1);
                        const viewport = page.getViewport({ scale: 1 });
                        const newScale = containerWidth / viewport.width;
                        changeScale(newScale);
                    };
                </script>
            </body></html>`;
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)); }
        return text;
    }
}