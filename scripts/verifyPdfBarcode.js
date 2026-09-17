const fs = require('fs');
const zlib = require('zlib');
const { execSync } = require('child_process');
const path = require('path');

const jsBarcodeScript = fs.readFileSync('node_modules/jsbarcode/dist/JsBarcode.all.min.js', 'utf8');
const htmlContent = `<html><head><script>${jsBarcodeScript}</script></head><body><svg id="b"></svg><script>JsBarcode("#b", "STU-27000101", {format: "CODE128"});</script></body></html>`;
fs.writeFileSync('t.html', htmlContent);

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const cmd = `${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="C:\\Users\\dell\\AppData\\Local\\Temp\\ch-test" --virtual-time-budget=2000 --no-pdf-header-footer --print-to-pdf="C:\\Users\\dell\\Desktop\\Da3m\\t.pdf" "C:\\Users\\dell\\Desktop\\Da3m\\t.html"`;
execSync(cmd);

const pdf = fs.readFileSync('t.pdf');
let found = false;
let idx = 0;
while ((idx = pdf.indexOf('stream', idx)) !== -1) {
  const start = idx + 6;
  const end = pdf.indexOf('endstream', start);
  if (end !== -1) {
    let slice = pdf.slice(start, end);
    if (slice[0] === 13 && slice[1] === 10) slice = slice.slice(2);
    else if (slice[0] === 10) slice = slice.slice(1);
    try {
      const decomp = zlib.inflateSync(slice).toString();
      if (decomp.includes('STU-27000101')) found = true;
    } catch(e) {}
  }
  idx = end + 9;
}
console.log('Decompressed stream contains STU-27000101?', found);
fs.unlinkSync('t.html');
fs.unlinkSync('t.pdf');
