const fs = require('fs');
const path = require('path');

try {
  const files = ['dist/html2canvas.js', 'dist/html2canvas.esm.js'];
  for (const f of files) {
    const p = path.join(process.cwd(), 'node_modules', 'html2canvas', f);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      if (c.includes('unsupported color function')) {
        const patched = c.split('\n').map((l) =>
          l.includes('unsupported color function') ? '                return COLORS.TRANSPARENT;' : l
        ).join('\n');
        fs.writeFileSync(p, patched, 'utf8');
      }
    }
  }
} catch (err) {
  // Gracefully ignore patching errors during install
}
process.exit(0);
