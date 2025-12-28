import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { PdfViewerPanel } from './pdfViewer';

export interface SyncTexPosition {
    page: number;
    x: number;
    y: number;
}

export interface SourcePosition {
    file: string;
    line: number;
    column: number;
}

export class SyncTexManager {
    private pdfViewer: PdfViewerPanel | undefined;

    setPdfViewer(viewer: PdfViewerPanel) {
        this.pdfViewer = viewer;
    }

    async syncFromSource(texFile: string, line: number, column: number, pdfFile: string): Promise<SyncTexPosition | null> {
        return new Promise((resolve, reject) => {
            const synctexFile = pdfFile.replace(/\.pdf$/, '.synctex.gz');
            
            const command = `synctex view -i "${line}:${column}:${texFile}" -o "${pdfFile}"`;
            
            child_process.exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`SyncTeX error: ${error}`);
                    reject(error);
                    return;
                }

                const pageMatch = stdout.match(/Page:(\d+)/);
                const xMatch = stdout.match(/x:([0-9.]+)/);
                const yMatch = stdout.match(/y:([0-9.]+)/);

                if (pageMatch && xMatch && yMatch) {
                    const position: SyncTexPosition = {
                        page: parseInt(pageMatch[1]),
                        x: parseFloat(xMatch[1]),
                        y: parseFloat(yMatch[1])
                    };
                    resolve(position);
                } else {
                    console.log('SyncTeX output:', stdout);
                    resolve(null);
                }
            });
        });
    }

    async syncFromPdf(pdfFile: string, page: number, x: number, y: number): Promise<SourcePosition | null> {
        return new Promise((resolve, reject) => {
            // synctex edit expects: -o page:x:y:file
            const command = `synctex edit -o "${page}:${x}:${y}:${pdfFile}"`;
            
            child_process.exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Reverse SyncTeX error: ${error}`);
                    reject(error);
                    return;
                }

                const inputMatch = stdout.match(/Input:(.+)/);
                const lineMatch = stdout.match(/Line:(\d+)/);
                const columnMatch = stdout.match(/Column:(-?\d+)/);

                if (inputMatch && lineMatch) {
                    const position: SourcePosition = {
                        file: inputMatch[1].trim(),
                        line: parseInt(lineMatch[1]),
                        column: columnMatch ? Math.max(0, parseInt(columnMatch[1])) : 0
                    };
                    resolve(position);
                } else {
                    console.log('Reverse SyncTeX output:', stdout);
                    resolve(null);
                }
            });
        });
    }

    private parseSyncTexOutput(output: string): any {
        const lines = output.split('\n');
        const result: any = {};

        for (const line of lines) {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
                result[key.toLowerCase()] = value;
            }
        }

        return result;
    }
}