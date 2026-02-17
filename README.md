# Cloverleaf

A VSCode/VSCodium extension that brings Overleaf-like features to your local LaTeX editing experience. Get live PDF preview, automatic compilation, and bidirectional SyncTeX support.

## Features

- **Live PDF Preview**: View your PDF output side-by-side with your LaTeX source
- **Automatic Compilation**: Compile on save with configurable delay
- **Dark Mode PDF Viewer**: Toggle dark mode for comfortable reading (enabled by default)
- **Bidirectional SyncTeX**:
  - Forward sync: Jump from source to PDF location (`Ctrl+Shift+J` / `Cmd+Shift+J`)
  - Reverse sync: `Ctrl+Shift+Click` (or `Cmd+Shift+Click`) in PDF to jump to source
- **Integrated PDF Viewer**: Built-in PDF viewer with zoom controls and page navigation
- **Error Highlighting**: See compilation errors directly in your source files

## Requirements

### General
- LaTeX distribution installed:
  - **Windows**: [MiKTeX](https://miktex.org/download) or [TeX Live](https://www.tug.org/texlive/)
  - **macOS**: [MacTeX](https://www.tug.org/mactex/)
  - **Linux**: TeX Live (usually available in package manager)
- Node.js and npm for building the extension

### Windows-Specific Setup

#### MikTeX SyncTeX Configuration

MikTeX includes the `synctex` command, but it may not be in your system PATH by default.

**Option 1: Add MikTeX to PATH (Recommended)**

1. Open Windows Settings → System → About → Advanced system settings
2. Click "Environment Variables"
3. Under "System variables" (or "User variables"), find "Path" and click "Edit"
4. Add the MikTeX binaries directory:
   - Default location: `C:\Program Files\MiKTeX\miktex\bin\x64\`
   - Or check your MikTeX installation folder
5. Click "OK" on all dialogs
6. **Restart VSCodium/VSCode** for changes to take effect
7. Verify in terminal: `synctex --version`

**Option 2: Use Full Path**

If you don't want to modify PATH, you can configure the extension to use the full path to synctex (future feature).

#### Verifying SyncTeX

Open a terminal (PowerShell or CMD) and run:
```bash
synctex --version
```

You should see output like:
```
This is SyncTeX command line utility, version 1.5
```

If you get "'synctex' is not recognized", follow Option 1 above.

## Installation

### From VSIX (Recommended)

1. Download the latest `.vsix` file from releases
2. Open VSCodium/VSCode
3. Go to Extensions view (`Ctrl+Shift+X`)
4. Click "..." → "Install from VSIX"
5. Select the downloaded `.vsix` file

### From Source

1. Clone this repository: `git clone https://github.com/g-alfieri/cloverleaf.git`
2. Navigate to folder: `cd cloverleaf`
3. Install dependencies: `npm install`
4. Compile: `npm run compile`
5. Package: `npx @vscode/vsce package`
6. Install the generated `.vsix` file

## Usage

### Commands

- **Cloverleaf: Show PDF Preview**: Opens the PDF preview panel
- **Cloverleaf: Compile Document** (`Ctrl+Shift+L` / `Cmd+Shift+L`): Compile the current document
- **Cloverleaf: Sync TeX to PDF** (`Ctrl+Shift+J` / `Cmd+Shift+J`): Jump from cursor position to PDF

### PDF Viewer Controls

- **Zoom In/Out**: Use the `+` and `-` buttons in the toolbar
- **Fit Page/Width**: Adjust zoom to fit the page or width
- **Dark Mode**: Click the moon/sun icon to toggle dark mode (inverts PDF colors)
- **Reverse Sync**: `Ctrl+Shift+Click` (or `Cmd+Shift+Click`) anywhere in the PDF to jump to the source

### Workflow Example

1. Open a `.tex` file in VSCodium
2. Click the "Show PDF Preview" button in the editor toolbar
3. The PDF will automatically update when you save (`Ctrl+S`)
4. Position cursor in TeX code and press `Ctrl+Shift+J` to highlight that position in PDF
5. Click (with `Ctrl+Shift` held) on the PDF to jump back to the corresponding source line

## Extension Settings

Configure the extension through VSCode settings (`File` → `Preferences` → `Settings`):

- `cloverleaf.compiler`: LaTeX compiler to use (default: `pdflatex`)
  - Options: `pdflatex`, `xelatex`, `lualatex`
- `cloverleaf.compilerArgs`: Compiler arguments
  - Default: `["-synctex=1", "-interaction=nonstopmode"]`
  - **Important**: `-synctex=1` is required for forward/backward sync
- `cloverleaf.autoCompile`: Enable automatic compilation on save (default: `true`)
- `cloverleaf.autoCompileDelay`: Delay before auto-compiling in milliseconds (default: `1000`)
- `cloverleaf.pdfViewer.zoom`: Default zoom level (auto, page-actual, page-fit, page-width)
- `cloverleaf.synctex.indicator`: Show visual indicator for SyncTeX jumps (default: `true`)

## Tips

1. **Use with LaTeX Workshop**: This extension complements LaTeX Workshop. Use LaTeX Workshop for syntax highlighting, snippets, and IntelliSense, while using Cloverleaf for live preview and SyncTeX.

2. **SyncTeX Files**: Make sure your LaTeX compiler generates `.synctex.gz` files. The `-synctex=1` flag is included by default.

3. **Project Structure**: The extension works best with single-file documents or projects where the main file is in the root directory.

4. **Dark Mode**: The PDF dark mode uses CSS filters to invert colors. If you prefer the original PDF colors, simply click the sun icon in the toolbar.

5. **Multi-file Projects**: For projects with multiple `.tex` files, make sure to compile the main file that includes others via `\input` or `\include`.

## Troubleshooting

### PDF doesn't update after compilation
- Check the "LaTeX Compiler" output channel in VSCodium for errors
- Ensure the PDF file is being generated in the same directory as your `.tex` file
- Try manually running the compile command: `Ctrl+Shift+L`

### SyncTeX not working on Windows
- Verify `synctex` is accessible: Open PowerShell and run `synctex --version`
- If not found, add MikTeX binaries to PATH (see Windows Setup above)
- Check that `.synctex.gz` files are being generated in your project folder
- Ensure `-synctex=1` is in your compiler arguments
- **Restart VSCodium** after modifying PATH

### Zoom buttons cause errors
- Update to the latest version (this bug was fixed)
- If still occurring, try reloading the window: `Ctrl+R`

### PDF viewer shows "401 Unauthorized" or blank
- This was a VSCodium-specific issue with `localResourceRoots`
- Update to the latest version (fixed in recent commits)

### Reverse sync (PDF → TeX) not working
- Remember to hold `Ctrl+Shift` (or `Cmd+Shift` on Mac) while clicking
- A simple click without modifiers won't trigger sync
- Yellow highlight should appear briefly when sync is successful

### Extension not activating
- Make sure you have a `.tex` or `.latex` file open
- Check the Extensions view to ensure the extension is enabled
- Try reloading the window: `Ctrl+R`

### Compilation freezes or is very slow
- Check if your LaTeX document has infinite loops or errors
- Increase `cloverleaf.autoCompileDelay` to avoid rapid recompilations
- Disable `cloverleaf.autoCompile` and compile manually when needed

## Development

To contribute or modify the extension:

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/cloverleaf.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Compile: `npm run compile`
6. Test in Extension Development Host (press `F5`)
7. Create a pull request

### Building VSIX

```bash
npm install
npm run compile
npx @vscode/vsce package
```

This generates a `.vsix` file you can install or distribute.

## Known Issues

- Multi-file projects require the main file to be open for compilation
- Some LaTeX packages may cause SyncTeX to provide approximate positions
- PDF text selection is not available (rendered on canvas)

## Roadmap

- [ ] Support for multi-file projects with root file detection
- [ ] Configurable SyncTeX path for Windows
- [ ] Integration with LaTeX Workshop's recipe system
- [ ] PDF text layer for selection and search
- [ ] Inverse search from external PDF viewers

## License

MIT

## Credits

Originally created by [Varun Seshadri](https://github.com/isolatedinformation).
Forked and enhanced with dark mode, security fixes, and improved stability.