import * as vscode from 'vscode';
import { PdfViewerPanel } from './pdfViewer';
import { LatexCompiler } from './latexCompiler';
import { SyncTexManager } from './synctex';

let pdfViewer: PdfViewerPanel | undefined;
let latexCompiler: LatexCompiler;
let syncTexManager: SyncTexManager;
let lastCompiledFile: string | undefined;

function findLatexEditor(): vscode.TextEditor | undefined {
    // First check active editor
    const active = vscode.window.activeTextEditor;
    if (active && (active.document.languageId === 'latex' || active.document.languageId === 'tex')) {
        return active;
    }

    // Then check visible editors
    for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.languageId === 'latex' || editor.document.languageId === 'tex') {
            return editor;
        }
    }

    return undefined;
}

function findLatexDocument(): string | undefined {
    // Try to find any open .tex document
    for (const doc of vscode.workspace.textDocuments) {
        if ((doc.languageId === 'latex' || doc.languageId === 'tex') && !doc.isUntitled) {
            return doc.uri.fsPath;
        }
    }
    return undefined;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Cloverleaf extension is now active!');

    latexCompiler = new LatexCompiler();
    syncTexManager = new SyncTexManager();

    context.subscriptions.push(
        vscode.commands.registerCommand('cloverleaf.showPdfPreview', () => {
            let texPath: string | undefined;

            // Try to find a LaTeX editor
            const editor = findLatexEditor();
            if (editor) {
                texPath = editor.document.uri.fsPath;
            } else {
                // Try to find any LaTeX document
                texPath = findLatexDocument();
            }

            // Fallback to last compiled file
            if (!texPath && lastCompiledFile) {
                texPath = lastCompiledFile;
            }

            if (!texPath) {
                vscode.window.showErrorMessage('No LaTeX document found. Please open a .tex file.');
                return;
            }

            const pdfPath = texPath.replace(/\.(tex|latex)$/i, '.pdf');

            if (!pdfViewer) {
                pdfViewer = new PdfViewerPanel(context.extensionUri);
                pdfViewer.onDidDispose(() => {
                    pdfViewer = undefined;
                    console.log('PDF viewer disposed');
                });
            }

            pdfViewer.reveal(vscode.ViewColumn.Beside);
            pdfViewer.loadPdf(pdfPath);

            // Always register pdfViewer with syncTexManager
            syncTexManager.setPdfViewer(pdfViewer);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cloverleaf.compile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || (editor.document.languageId !== 'latex' && editor.document.languageId !== 'tex')) {
                vscode.window.showErrorMessage('No active LaTeX document');
                return;
            }

            const texPath = editor.document.uri.fsPath;
            lastCompiledFile = texPath;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Compiling LaTeX document...",
                cancellable: true
            }, async (progress, token) => {
                try {
                    const success = await latexCompiler.compile(texPath, token);
                    if (success) {
                        vscode.window.showInformationMessage('LaTeX compilation successful');

                        if (pdfViewer) {
                            const pdfPath = texPath.replace(/\.(tex|latex)$/i, '.pdf');
                            pdfViewer.reload(pdfPath);
                            // Re-register after reload in case viewer was recreated
                            syncTexManager.setPdfViewer(pdfViewer);
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
            if (!editor || (editor.document.languageId !== 'latex' && editor.document.languageId !== 'tex')) {
                vscode.window.showErrorMessage('No active LaTeX document');
                return;
            }

            if (!pdfViewer) {
                vscode.window.showErrorMessage('PDF preview not open. Use "Cloverleaf: Show PDF Preview" first.');
                return;
            }

            // Ensure pdfViewer is registered (in case it was recreated)
            syncTexManager.setPdfViewer(pdfViewer);

            const position = editor.selection.active;
            const texFile = editor.document.uri.fsPath;
            const pdfFile = texFile.replace(/\.(tex|latex)$/i, '.pdf');

            try {
                const pdfPosition = await syncTexManager.syncFromSource(
                    texFile,
                    position.line + 1,
                    position.character + 1,
                    pdfFile
                );

                if (pdfPosition) {
                    pdfViewer.scrollToPosition(pdfPosition);
                } else {
                    vscode.window.showWarningMessage('SyncTeX could not find corresponding PDF location. Ensure the document is compiled with -synctex=1');
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
                    lastCompiledFile = document.uri.fsPath;

                    setTimeout(async () => {
                        try {
                            const success = await latexCompiler.compile(document.uri.fsPath);
                            if (success && pdfViewer) {
                                const pdfPath = document.uri.fsPath.replace(/\.(tex|latex)$/i, '.pdf');
                                pdfViewer.reload(pdfPath);
                                // Re-register after auto-compile reload
                                syncTexManager.setPdfViewer(pdfViewer);
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