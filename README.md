# Cloverleaf

A VSCode/Cursor extension that brings Overleaf-like features to your local LaTeX editing experience. Get live PDF preview, automatic compilation, and bidirectional SyncTeX support.

## Features

- **Live PDF Preview**: View your PDF output side-by-side with your LaTeX source
- **Automatic Compilation**: Compile on save with configurable delay
- **Bidirectional SyncTeX**:
  - Forward sync: Jump from source to PDF location (Cmd+Shift+J)
  - Reverse sync: Cmd+Shift+Click in PDF to jump to source location
- **Integrated PDF Viewer**: Built-in PDF viewer with zoom controls and page navigation
- **Error Highlighting**: See compilation errors directly in your source files

## Requirements

- LaTeX distribution installed (TeX Live, MiKTeX, or MacTeX)
- `synctex` command available in PATH
- Node.js and npm for building the extension

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 in VSCode to launch a new Extension Development Host window
5. Open a `.tex` file to activate the extension

## Usage

### Commands

- **Cloverleaf: Show PDF Preview**: Opens the PDF preview panel
- **Cloverleaf: Compile Document** (Cmd+Shift+L): Compile the current document
- **Cloverleaf: Sync TeX to PDF** (Cmd+Shift+J): Jump from cursor position to PDF

### PDF Viewer Controls

- **Zoom In/Out**: Use the + and - buttons in the toolbar
- **Fit Page/Width**: Adjust zoom to fit the page or width
- **Reverse Sync**: Cmd+Shift+Click anywhere in the PDF to jump to the source

## Extension Settings

Configure the extension through VSCode settings:

- `cloverleaf.compiler`: LaTeX compiler to use (default: `pdflatex`)
- `cloverleaf.compilerArgs`: Compiler arguments (default: `["-synctex=1", "-interaction=nonstopmode"]`)
- `cloverleaf.autoCompile`: Enable automatic compilation on save (default: `true`)
- `cloverleaf.autoCompileDelay`: Delay before auto-compiling in milliseconds (default: `1000`)
- `cloverleaf.pdfViewer.zoom`: Default zoom level (auto, page-actual, page-fit, page-width)
- `cloverleaf.synctex.indicator`: Show visual indicator for SyncTeX jumps (default: `true`)

## Tips

1. **Use with LaTeX Workshop**: This extension complements LaTeX Workshop. Use LaTeX Workshop for syntax highlighting, snippets, and IntelliSense, while using Cloverleaf for live preview and SyncTeX.

2. **SyncTeX Files**: Make sure your LaTeX compiler generates `.synctex.gz` files. The `-synctex=1` flag is included by default.

3. **Project Structure**: The extension works best with single-file documents or projects where the main file is in the root directory.

## Troubleshooting

### PDF doesn't update after compilation
- Check the LaTeX Compiler output channel for errors
- Ensure the PDF file is being generated in the same directory as your `.tex` file

### SyncTeX not working
- Verify `synctex` is installed: run `synctex help` in terminal
- Check that `.synctex.gz` files are being generated
- Ensure you're using a compiler that supports SyncTeX

### Extension not activating
- Make sure you have a `.tex` or `.latex` file open
- Check the Extensions view to ensure the extension is enabled

## Development

To contribute or modify the extension:

1. Fork the repository
2. Make your changes
3. Run `npm run compile` to build
4. Test in Extension Development Host (F5)
5. Submit a pull request

## License

MIT