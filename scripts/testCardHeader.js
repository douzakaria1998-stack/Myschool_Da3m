const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CODE128 } = require('jsbarcode/bin/barcodes/CODE128');

const logoBase64 = fs.readFileSync('public/my_school_logo_white.svg').toString('base64');
const logoDataUri = `data:image/svg+xml;base64,${logoBase64}`;

function generateBarcodeSvg(barcodeText, width = 1.45, height = 34) {
  const b = new CODE128(barcodeText, { text: barcodeText });
  const encoded = b.encode();
  const binary = encoded.data;
  let rects = '';
  const barWidth = width;
  const totalWidth = binary.length * barWidth;
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      rects += `<rect x="${(i * barWidth).toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="#000000"/>`;
    }
  }
  return `<svg viewBox="0 0 ${totalWidth.toFixed(2)} ${height + 13}" style="width: 100%; max-height: 13.5mm; display: block;" xmlns="http://www.w3.org/2000/svg">
    ${rects}
    <text x="${(totalWidth / 2).toFixed(2)}" y="${height + 10.5}" text-anchor="middle" font-family="monospace" font-size="9" font-weight="bold" fill="#000000">${barcodeText}</text>
  </svg>`;
}

const cardHtml = `
  <div class="pvc-card" style="
    width: 85.6mm;
    height: 54mm;
    min-width: 85.6mm;
    min-height: 54mm;
    box-sizing: border-box;
    border-radius: 3.18mm;
    background-color: #fffdfa;
    background-image: radial-gradient(circle at 90% 10%, #fff7ed 0%, #fffdfa 70%);
    border: 1px solid #fed7aa;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 3mm 3.8mm 2.8mm 3.8mm;
    direction: rtl;
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    color: #0f172a;
    user-select: none;
  ">
    <!-- Header Banner Accent with ripple effect -->
    <div style="
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 24mm;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
      background: linear-gradient(135deg, #ff7a18 0%, #f26322 45%, #d94b08 100%);
      border-radius: 0 0 16% 16% / 0 0 12mm 12mm;
    ">
      <svg viewBox="0 0 324 90" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
        <circle cx="295" cy="8" r="14" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="1.2" />
        <circle cx="295" cy="8" r="26" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.2" />
        <circle cx="295" cy="8" r="39" fill="none" stroke="rgba(255,255,255,0.26)" stroke-width="1.2" />
        <circle cx="295" cy="8" r="53" fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="1.2" />
        <circle cx="295" cy="8" r="68" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.2" />
        <circle cx="295" cy="8" r="84" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.2" />
      </svg>
    </div>

    <!-- Header Content: Logo, Institution, Subtitle -->
    <div style="
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-top: 0.2mm;
    ">
      <div style="display: flex; justify-content: center; margin-bottom: 0.5mm;">
        <img src="${logoDataUri}" alt="My School" style="height: 7.5mm; width: auto; max-height: 32px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));" />
      </div>
      <div style="
        font-size: 8.4pt;
        font-weight: 900;
        color: #ffffff;
        line-height: 1.15;
        letter-spacing: -0.1px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
      ">
        مدرسة ماي سكول لتعليم اللغات
      </div>
      <div style="
        font-size: 5.6pt;
        color: #ffffff;
        font-weight: 800;
        margin-top: 0.4mm;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        opacity: 0.95;
      ">
        <span>بطاقة التلميذ المعتمدة</span>
        <span style="opacity: 0.75;">|</span>
        <span>2026/2027</span>
      </div>
    </div>

    <!-- White Inner Container with Student Name & Barcode -->
    <div style="
      position: relative;
      z-index: 2;
      background-color: #ffffff;
      border-radius: 2.6mm;
      border: 1px solid #fed7aa;
      box-shadow: 0 3px 10px rgba(242, 99, 34, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
      padding: 2.2mm 3.2mm 1.6mm 3.2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 25.5mm;
      box-sizing: border-box;
    ">
      <!-- Name line & Verified chip -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="
          font-size: 11.5pt;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 58mm;
        ">
          ضحى نغموش علي
        </div>
        <span style="
          font-size: 5.2pt;
          font-weight: 800;
          color: #c2410c;
          background-color: #fff7ed;
          border: 0.5px solid #fed7aa;
          padding: 0.4mm 1.5mm;
          border-radius: 1.2mm;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          white-space: nowrap;
        ">
          <span>معتمد ✓</span>
        </span>
      </div>

      <!-- Barcode vector SVG -->
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 0.2mm;
        background-color: #ffffff;
      ">
        ${generateBarcodeSvg('STU-27000101')}
      </div>
    </div>
  </div>`;

const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4 portrait; margin: 3mm 0mm !important; }
    body { font-family: 'Cairo', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
  </style>
</head>
<body>
  ${cardHtml}
</body>
</html>`;

fs.writeFileSync('test_single_card.html', html, 'utf8');
const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const profile = 'C:\\Users\\dell\\AppData\\Local\\Temp\\test-card';
const pdfPath = path.resolve('test_single_card.pdf');
const htmlPath = path.resolve('test_single_card.html');

execSync(`${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="${profile}" --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`);
console.log('Single card PDF created! Size:', fs.statSync(pdfPath).size);

const shotPath = path.resolve('test_card.png');
execSync(`${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="${profile}" --window-size=600,400 --screenshot="${shotPath}" "${htmlPath}"`);
console.log('Screenshot created! Size:', fs.statSync(shotPath).size);
