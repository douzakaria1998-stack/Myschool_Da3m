const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve('test_print.html');
const pdfPath = path.resolve('test_print.pdf');
const profile = 'C:\\Users\\dell\\AppData\\Local\\Temp\\chrome-headless-test';

fs.writeFileSync(htmlPath, '<html><body><h1>Test Print to PDF</h1></body></html>');
const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const cmd = `${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="${profile}" --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;

console.log('Running cmd:', cmd);
execSync(cmd);
console.log('PDF created! Size:', fs.statSync(pdfPath).size);

if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
