# Cloverleaf - Usage Guide

## SyncTeX: Forward and Backward Synchronization

Cloverleaf provides **bidirectional synchronization** between your LaTeX source code and PDF output.

### Forward Sync (TeX → PDF)

**How it works:** Jump from a line in your LaTeX code to the corresponding location in the PDF.

**Steps:**
1. Position your cursor on a line in the `.tex` file
2. Press `Ctrl+Shift+J` (or `Cmd+Shift+J` on Mac)
3. A **yellow rectangle** will flash in the PDF showing the corresponding location

**Tip:** Works from any line, even inside equations, figures, or sections!

---

### Backward Sync (PDF → TeX)

**How it works:** Click on the PDF to jump to the corresponding line in your LaTeX source.

**IMPORTANT: The PDF is NOT text-selectable!**

The PDF is rendered on an HTML canvas, which means:
- ❌ You **cannot** select text in the PDF
- ❌ You **cannot** copy text from the PDF  
- ✅ You **can** click to navigate to source

**Steps:**
1. Hold down `Ctrl+Shift` (or `Cmd+Shift` on Mac)
2. **Click** on any location in the PDF
3. Your cursor will jump to the corresponding line in the `.tex` file

**Not working?** Make sure you:
- Hold **both** `Ctrl` and `Shift` keys **before** clicking
- Don't try to drag or select - just a single **click**
- Have compiled with `-synctex=1` (default in Cloverleaf)

---

## Complete Workflow Example

### Scenario: Editing a Document

1. **Open your LaTeX file** (`main.tex`)
2. **Show PDF Preview**:
   - Click the preview button in the editor toolbar, OR
   - Command Palette → "Cloverleaf: Show PDF Preview"
3. **Edit your code**
4. **Save** (`Ctrl+S`) - PDF updates automatically
5. **Jump to PDF location**:
   - Place cursor on a line
   - Press `Ctrl+Shift+J`
   - See the yellow flash in the PDF
6. **Jump back to code**:
   - Hold `Ctrl+Shift`
   - Click on the PDF
   - Editor jumps to that line

---

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Compile Document | `Ctrl+Shift+L` | `Cmd+Shift+L` |
| Forward Sync (TeX → PDF) | `Ctrl+Shift+J` | `Cmd+Shift+J` |
| Backward Sync (PDF → TeX) | `Ctrl+Shift+Click` | `Cmd+Shift+Click` |
| Save & Auto-compile | `Ctrl+S` | `Cmd+S` |

---

## PDF Viewer Controls

### Toolbar Buttons

- **`-` and `+`**: Zoom out / Zoom in
- **Fit Page**: Scale PDF to fit the full page height
- **Fit Width**: Scale PDF to fit the window width
- **🌙 / ☀️**: Toggle dark mode (inverts PDF colors)

### Dark Mode

Cloverleaf includes a **dark mode** for PDF viewing:
- Enabled by default for comfortable nighttime reading
- Uses CSS filters to invert colors: white background → dark, black text → white
- Click the moon/sun icon to toggle
- Your preference is saved across sessions

---

## Common Issues

### "The PDF is not selectable, how do I sync?"

**This is by design.** The PDF is rendered on an HTML `<canvas>` element, not as text layers.

- To **copy text**: Open the actual PDF file externally
- To **sync to code**: Use `Ctrl+Shift+Click` (don't select, just click)

### Backward sync doesn't work

**Checklist:**
1. Are you holding `Ctrl+Shift` **before** clicking?
2. Is the yellow flash appearing? (Forward sync working = SyncTeX is active)
3. Does the file have a `.synctex.gz` file in the same folder?
4. Did you compile with `-synctex=1`? (Check settings: `cloverleaf.compilerArgs`)

### Forward sync (`Ctrl+Shift+J`) doesn't work

**Solutions:**
1. Make sure you're in a `.tex` file (check bottom-right of VSCodium: should say "LaTeX")
2. Compile the document first (`Ctrl+Shift+L`)
3. Open the PDF preview
4. Try using Command Palette → "Cloverleaf: Sync TeX to PDF"
5. If that works but shortcut doesn't, check VSCodium keyboard shortcut conflicts

### Zoom buttons cause errors

Update to the latest version - this bug was fixed in recent commits.

---

## Advanced Tips

### Multi-file Projects

For projects with multiple `.tex` files (using `\input` or `\include`):

1. Always compile the **main file** (the one with `\documentclass`)
2. SyncTeX works from any included file
3. The extension uses the main file's PDF for preview

### Performance

If compilation is slow:

- Increase `cloverleaf.autoCompileDelay` (default: 1000ms)
- Disable `cloverleaf.autoCompile` and compile manually
- Use a faster compiler (e.g., `lualatex` instead of `pdflatex`)

### Custom Compiler Arguments

Edit settings:
```json
{
  "cloverleaf.compiler": "xelatex",
  "cloverleaf.compilerArgs": [
    "-synctex=1",
    "-interaction=nonstopmode",
    "-shell-escape"  // for minted, etc.
  ]
}
```

---

## Still Having Issues?

Open an issue at: https://github.com/g-alfieri/cloverleaf/issues

Include:
- Your operating system (Windows/macOS/Linux)
- VSCodium version
- LaTeX distribution (MiKTeX/TeX Live/MacTeX)
- Error messages from the "LaTeX Compiler" output channel
- Whether `synctex --version` works in your terminal