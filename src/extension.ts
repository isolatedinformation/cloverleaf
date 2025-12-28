import * as vscode from 'vscode';
import { PdfViewerPanel } from './pdfViewer';
import { LatexCompiler } from './latexCompiler';
import { SyncTexManager } from './synctex';

let pdfViewer: PdfViewerPanel | undefined;
let latexCompiler: LatexCompiler;
let syncTexManager: SyncTexManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Cloverleaf extension is now active!');

    latexCompiler = new LatexCompiler();
    syncTexManager = new SyncTexManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('cloverleaf.showPdfPreview', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active LaTeX document');
                return;
            }

            const texPath = editor.document.uri.fsPath;
            const pdfPath = texPath.replace(/\.(tex|latex)$/, '.pdf');

            if (!pdfViewer) {
                pdfViewer = new PdfViewerPanel(context.extensionUri);
                pdfViewer.onDidDispose(() => {
                    pdfViewer = undefined;
                });
            }

            pdfViewer.reveal(vscode.ViewColumn.Beside);
            pdfViewer.loadPdf(pdfPath);

            syncTexManager.setPdfViewer(pdfViewer);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cloverleaf.compile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active LaTeX document');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Compiling LaTeX document...",
                cancellable: true
            }, async (progress, token) => {
                try {
                    const success = await latexCompiler.compile(editor.document.uri.fsPath, token);
                    if (success) {
                        vscode.window.showInformationMessage('LaTeX compilation successful');

                        if (pdfViewer) {
                            const pdfPath = editor.document.uri.fsPath.replace(/\.(tex|latex)$/, '.pdf');
                            pdfViewer.reload(pdfPath);
                        }
                    } else {
                        vscode.window.showErrorMessage('LaTeX compilation failed. Check output for details.');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Compilation error: ${error}`);
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cloverleaf.syncTex', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active LaTeX document');
                return;
            }

            if (!pdfViewer) {
                vscode.window.showErrorMessage('PDF preview not open');
                return;
            }

            const position = editor.selection.active;
            const texFile = editor.document.uri.fsPath;
            const pdfFile = texFile.replace(/\.(tex|latex)$/, '.pdf');

            try {
                const pdfPosition = await syncTexManager.syncFromSource(
                    texFile,
                    position.line + 1,
                    position.character + 1,
                    pdfFile
                );

                if (pdfPosition) {
                    pdfViewer.scrollToPosition(pdfPosition);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`SyncTeX error: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cloverleaf.syncPdf', async (page: number, x: number, y: number) => {
            if (!pdfViewer || !pdfViewer.currentPdfPath) {
                vscode.window.showErrorMessage('No PDF loaded');
                return;
            }

            const pdfFile = pdfViewer.currentPdfPath;

            try {
                const sourcePosition = await syncTexManager.syncFromPdf(pdfFile, page, x, y);

                if (sourcePosition && sourcePosition.file) {
                    const doc = await vscode.workspace.openTextDocument(sourcePosition.file);
                    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

                    const position = new vscode.Position(
                        Math.max(0, sourcePosition.line - 1),
                        Math.max(0, sourcePosition.column - 1)
                    );

                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                } else {
                    vscode.window.showWarningMessage('Could not find source location for this position');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Reverse SyncTeX error: ${error}`);
            }
        })
    );

    const config = vscode.workspace.getConfiguration('cloverleaf');
    if (config.get<boolean>('autoCompile')) {
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                if (document.languageId === 'latex' || document.languageId === 'tex') {
                    const delay = config.get<number>('autoCompileDelay', 1000);

                    setTimeout(async () => {
                        try {
                            const success = await latexCompiler.compile(document.uri.fsPath);
                            if (success && pdfViewer) {
                                const pdfPath = document.uri.fsPath.replace(/\.(tex|latex)$/, '.pdf');
                                pdfViewer.reload(pdfPath);
                            }
                        } catch (error) {
                            console.error('Auto-compile error:', error);
                        }
                    }, delay);
                }
            })
        );
    }
}

export function deactivate() {
    if (pdfViewer) {
        pdfViewer.dispose();
    }
}