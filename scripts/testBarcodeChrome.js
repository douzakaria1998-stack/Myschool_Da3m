const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const jsBarcodeScript = fs.readFileSync('node_modules/jsbarcode/dist/JsBarcode.all.min.js', 'utf8');

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>${jsBarcodeScript}</script>
</head>
<body>
  <h1>Barcode Test</h1>
  <svg id="barcode"></svg>
  <script>
    JsBarcode("#barcode", "STU-27000101", {
      format: "CODE128",
      width: 2,
      height: 40,
      displayValue: true
    });
  </script>
</body>
</html>`;

const htmlPath = path.resolve('test_barcode_print.html');
const pdfPath = path.resolve('test_barcode_print.pdf');
const profile = 'C:\\Users\\dell\\AppData\\Local\\Temp\\chrome-headless-test';

fs.writeFileSync(htmlPath, htmlContent);

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const cmd = `${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="${profile}" --run-all-compositor-stages-before-draw --virtual-time-budget=2000 --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;

execSync(cmd);
console.log('PDF created! Size:', fs.statSync(pdfPath).size);

// Read PDF and check if barcode or text STU-27000101 is in it
const pdfBuf = fs.readFileSync(pdfPath);
console.log('Contains STU-27000101?', pdfBuf.includes(Buffer.from('STU-27000101')));

if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
