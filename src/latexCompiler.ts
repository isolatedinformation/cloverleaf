import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class LatexCompiler {
    private outputChannel: vscode.OutputChannel;
    private compilationProcess: child_process.ChildProcess | null = null;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('LaTeX Compiler');
    }

    async compile(texFile: string, cancellationToken?: vscode.CancellationToken): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('cloverleaf');
        const compiler = config.get<string>('compiler', 'pdflatex');
        const compilerArgs = config.get<string[]>('compilerArgs', ['-synctex=1', '-interaction=nonstopmode']);
        
        const texDir = path.dirname(texFile);
        const texFileName = path.basename(texFile);
        
        this.outputChannel.clear();
        this.outputChannel.show();
        
        return new Promise((resolve, reject) => {
            const args = [...compilerArgs, texFileName];
            
            this.outputChannel.appendLine(`Compiling ${texFileName} with ${compiler}...`);
            this.outputChannel.appendLine(`Command: ${compiler} ${args.join(' ')}`);
            this.outputChannel.appendLine(`Working directory: ${texDir}`);
            this.outputChannel.appendLine('---');
            
            this.compilationProcess = child_process.spawn(compiler, args, {
                cwd: texDir,
                shell: true
            });

            let outputBuffer = '';

            this.compilationProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                outputBuffer += text;
                this.outputChannel.append(text);
            });

            this.compilationProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                outputBuffer += text;
                this.outputChannel.append(text);
            });

            if (cancellationToken) {
                cancellationToken.onCancellationRequested(() => {
                    if (this.compilationProcess) {
                        this.compilationProcess.kill();
                        this.outputChannel.appendLine('\nCompilation cancelled by user.');
                    }
                });
            }

            this.compilationProcess.on('error', (error) => {
                this.outputChannel.appendLine(`\nError starting compiler: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to start ${compiler}: ${error.message}`);
                resolve(false);
            });

            this.compilationProcess.on('close', (code) => {
                this.compilationProcess = null;
                
                if (code === 0) {
                    this.outputChannel.appendLine('\n✓ Compilation completed successfully.');
                    
                    const pdfFile = texFile.replace(/\.(tex|latex)$/, '.pdf');
                    if (fs.existsSync(pdfFile)) {
                        resolve(true);
                    } else {
                        this.outputChannel.appendLine('\n⚠ PDF file not found after compilation.');
                        resolve(false);
                    }
                } else if (code === null) {
                    this.outputChannel.appendLine('\n✗ Compilation was cancelled.');
                    resolve(false);
                } else {
                    this.outputChannel.appendLine(`\n✗ Compilation failed with exit code ${code}.`);
                    
                    const errors = this.parseErrors(outputBuffer);
                    if (errors.length > 0) {
                        this.showCompilationErrors(errors, texFile);
                    }
                    
                    resolve(false);
                }
            });
        });
    }

    private parseErrors(output: string): CompilationError[] {
        const errors: CompilationError[] = [];
        const lines = output.split('\n');
        
        const errorRegex = /^(.+):(\d+):\s*(.+)$/;
        const latexErrorRegex = /^!\s+(.+)$/;
        let currentError: CompilationError | null = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('!')) {
                const match = line.match(latexErrorRegex);
                if (match) {
                    currentError = {
                        message: match[1],
                        file: '',
                        line: 0,
                        severity: vscode.DiagnosticSeverity.Error
                    };
                    
                    if (i + 1 < lines.length && lines[i + 1].startsWith('l.')) {
                        const lineMatch = lines[i + 1].match(/^l\.(\d+)/);
                        if (lineMatch) {
                            currentError.line = parseInt(lineMatch[1]);
                        }
                    }
                    
                    errors.push(currentError);
                }
            }
            
            const match = line.match(errorRegex);
            if (match) {
                errors.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    message: match[3],
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
            
            if (line.includes('Warning:') || line.includes('warning:')) {
                const warnMatch = line.match(/Warning:\s*(.+)$/i);
                if (warnMatch) {
                    errors.push({
                        file: '',
                        line: 0,
                        message: warnMatch[1],
                        severity: vscode.DiagnosticSeverity.Warning
                    });
                }
            }
        }
        
        return errors;
    }

    private showCompilationErrors(errors: CompilationError[], mainFile: string) {
        const diagnosticCollection = vscode.languages.createDiagnosticCollection('latex');
        const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
        
        for (const error of errors) {
            const file = error.file || mainFile;
            const uri = vscode.Uri.file(path.isAbsolute(file) ? file : path.join(path.dirname(mainFile), file));
            
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(
                    Math.max(0, error.line - 1), 0,
                    Math.max(0, error.line - 1), Number.MAX_VALUE
                ),
                error.message,
                error.severity
            );
            
            const diagnostics = diagnosticsMap.get(uri.toString()) || [];
            diagnostics.push(diagnostic);
            diagnosticsMap.set(uri.toString(), diagnostics);
        }
        
        diagnosticsMap.forEach((diagnostics, uriString) => {
            diagnosticCollection.set(vscode.Uri.parse(uriString), diagnostics);
        });
        
        setTimeout(() => {
            diagnosticCollection.clear();
            diagnosticCollection.dispose();
        }, 30000);
    }

    dispose() {
        if (this.compilationProcess) {
            this.compilationProcess.kill();
        }
        this.outputChannel.dispose();
    }
}

interface CompilationError {
    file: string;
    line: number;
    message: string;
    severity: vscode.DiagnosticSeverity;
}