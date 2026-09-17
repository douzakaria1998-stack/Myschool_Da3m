const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4; margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  </style>
</head>
<body>
  <!-- Test 1: SVG gradient with url(#g) -->
  <svg width="300" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff7a18"/>
        <stop offset="100%" stop-color="#d94b08"/>
      </linearGradient>
    </defs>
    <rect width="300" height="100" fill="url(#g)"/>
  </svg>

  <!-- Test 2: CSS gradient background -->
  <div style="width: 300px; height: 100px; background: linear-gradient(135deg, #ff7a18 0%, #f26322 45%, #d94b08 100%);">
    CSS Gradient
  </div>
</body>
</html>`;

const pdfPath = path.resolve('test_grad.pdf');
const htmlPath = path.resolve('test_grad.html');
fs.writeFileSync(htmlPath, html);
const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const profile = 'C:\\Users\\dell\\AppData\\Local\\Temp\\test-grad';
execSync(`${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="${profile}" --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`);

const pdf = fs.readFileSync(pdfPath);
console.log('PDF created! Size:', pdf.length);
