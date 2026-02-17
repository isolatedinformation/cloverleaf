import * as vscode from 'vscode';
import * as child_process from 'child_process';
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
            // Using spawn to avoid shell command injection
            const args = ['view', '-i', `${line}:${column}:${texFile}`, '-o', pdfFile];
            const process = child_process.spawn('synctex', args);
            
            let stdout = '';
            process.stdout.on('data', (data) => { stdout += data; });

            process.on('close', (code) => {
                if (code !== 0) {
                    console.error(`SyncTeX process exited with code ${code}`);
                    resolve(null);
                    return;
                }

                const pageMatch = stdout.match(/Page:(\d+)/);
                const xMatch = stdout.match(/x:([0-9.]+)/);
                const yMatch = stdout.match(/y:([0-9.]+)/);

                if (pageMatch && xMatch && yMatch) {
                    resolve({
                        page: parseInt(pageMatch[1]),
                        x: parseFloat(xMatch[1]),
                        y: parseFloat(yMatch[1])
                    });
                } else {
                    resolve(null);
                }
            });

            process.on('error', (err) => {
                console.error(`Failed to start SyncTeX: ${err}`);
                reject(err);
            });
        });
    }

    async syncFromPdf(pdfFile: string, page: number, x: number, y: number): Promise<SourcePosition | null> {
        return new Promise((resolve, reject) => {
            // Using spawn to avoid shell command injection
            const args = ['edit', '-o', `${page}:${x}:${y}:${pdfFile}`];
            const process = child_process.spawn('synctex', args);
            
            let stdout = '';
            process.stdout.on('data', (data) => { stdout += data; });

            process.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Reverse SyncTeX process exited with code ${code}`);
                    resolve(null);
                    return;
                }

                const inputMatch = stdout.match(/Input:(.+)/);
                const lineMatch = stdout.match(/Line:(\d+)/);
                const columnMatch = stdout.match(/Column:(-?\d+)/);

                if (inputMatch && lineMatch) {
                    resolve({
                        file: inputMatch[1].trim(),
                        line: parseInt(lineMatch[1]),
                        column: columnMatch ? Math.max(0, parseInt(columnMatch[1])) : 0
                    });
                } else {
                    resolve(null);
                }
            });

            process.on('error', (err) => {
                console.error(`Failed to start Reverse SyncTeX: ${err}`);
                reject(err);
            });
        });
    }
}