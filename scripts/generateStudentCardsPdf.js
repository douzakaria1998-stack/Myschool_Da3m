const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const xlsx = require('xlsx');
const { CODE128 } = require('jsbarcode/bin/barcodes/CODE128');

const excelPath = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx';
const outputDir = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)';
const pdfOutputPath = path.join(outputDir, 'بطاقات_الطلبة_A4.pdf');
const parentPdfOutputPath = 'C:\\Users\\dell\\Downloads\\STU\\بطاقات_الطلبة_A4.pdf';

console.log('1. Reading student data from Excel Tab 1...');
const wb = xlsx.readFile(excelPath);
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

// Load initialData.json to retrieve official barcodes
const dbData = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));

function norm(s) {
  return (s || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

function wordKey(s) {
  return norm(s).split(' ').sort().join(' ');
}

// Map barcodes from DB
const barcodeByNorm = new Map();
const barcodeByWordKey = new Map();

for (const gid in dbData.groupData) {
  (dbData.groupData[gid].students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع') || !s.barcode) return;
    const n = norm(s.name);
    const wk = wordKey(s.name);
    if (!barcodeByNorm.has(n)) barcodeByNorm.set(n, s.barcode.trim());
    if (!barcodeByWordKey.has(wk)) barcodeByWordKey.set(wk, s.barcode.trim());
  });
}

// Process 322 students in order
const students = tab1.slice(1).map((r, idx) => {
  const num = r[0] || (idx + 1);
  const name = String(r[1]).trim();
  const n = norm(name);
  const wk = wordKey(name);
  let barcode = barcodeByNorm.get(n) || barcodeByWordKey.get(wk);
  if (!barcode) {
    barcode = `STU-2700${(idx + 1).toString().padStart(4, '0')}`;
  }
  return { num, name, barcode };
}).filter(s => s.name);

console.log(`Total students to print: ${students.length}`);

// Load Logo as base64 Data URI to guarantee 100% reliable rendering in Chrome headless print
const logoPath = path.resolve('public/my_school_logo_white.svg');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const logoDataUri = `data:image/svg+xml;base64,${logoBase64}`;

// Function to generate pure vector CODE128 SVG for each barcode
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

// Function to render a single student card HTML
function renderCardHtml(student) {
  const barcodeSvg = generateBarcodeSvg(student.barcode);

  return `
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
    <!-- Header Banner Accent with ripple effect and solid vibrant orange background -->
    <div style="
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 24mm;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
      background: linear-gradient(135deg, #ff7a18 0%, #f26322 45%, #d94b08 100%) !important;
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
          ${student.name}
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
        ${barcodeSvg}
      </div>
    </div>
  </div>`;
}

// Group into pages of 10
const pages = [];
for (let i = 0; i < students.length; i += 10) {
  pages.push(students.slice(i, i + 10));
}
console.log(`Total A4 pages: ${pages.length}`);

// Generate full HTML document with A4 10-cards-per-page grid & cut guides
const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>بطاقات الطلبة A4</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: A4 portrait;
      margin: 3mm 0mm !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    }

    .a4-page {
      width: 210mm;
      max-width: 210mm;
      height: 291mm;
      max-height: 291mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      page-break-inside: avoid;
      break-inside: avoid;
      break-after: page;
      margin: 0 auto;
      overflow: hidden;
      padding: 2mm 0;
    }

    .a4-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .a4-grid {
      display: grid;
      grid-template-columns: repeat(2, 85.6mm);
      grid-template-rows: repeat(5, 54mm);
      grid-gap: 2.2mm 9mm;
      justify-content: center;
      align-content: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .a4-cell {
      position: relative;
      width: 85.6mm;
      height: 54mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Cutting guide crop marks */
    .a4-guide {
      position: absolute;
      inset: -1.5px;
      border: 0.5px dashed #cbd5e1;
      border-radius: 3.5mm;
      pointer-events: none;
      z-index: 10;
    }

    .a4-card-scaler {
      width: 85.6mm;
      height: 54mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .page-footer {
      margin-top: 1.5mm;
      font-size: 6.5pt;
      color: #94a3b8;
      font-family: 'Cairo', sans-serif;
      text-align: center;
    }
  </style>
</head>
<body>
  ${pages.map((pageCards, pageIdx) => `
    <div class="a4-page">
      <div class="a4-grid">
        ${pageCards.map((student) => `
          <div class="a4-cell">
            <div class="a4-guide"></div>
            <div class="a4-card-scaler">
              ${renderCardHtml(student)}
            </div>
          </div>
        `).join('\n')}
      </div>
      <div class="page-footer">
        مدرسة ماي سكول لتعليم اللغات — بطاقات الطلبة (صفحة ${pageIdx + 1} من ${pages.length})
      </div>
    </div>
  `).join('\n')}
</body>
</html>`;

const tempHtmlPath = path.resolve('temp_cards_a4.html');
console.log('Writing temporary HTML to:', tempHtmlPath);
fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

console.log('Rendering PDF via Google Chrome headless...');
const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const profile = 'C:\\Users\\dell\\AppData\\Local\\Temp\\chrome-pdf-cards-vibrant';
const cmd = `${chrome} --headless=new --no-sandbox --disable-gpu --user-data-dir="${profile}" --run-all-compositor-stages-before-draw --virtual-time-budget=3000 --no-pdf-header-footer --print-to-pdf="${pdfOutputPath}" "${tempHtmlPath}"`;

execSync(cmd, { stdio: 'inherit' });

console.log('PDF generated at:', pdfOutputPath);
console.log('File size:', fs.statSync(pdfOutputPath).size, 'bytes');

// Copy to parent folder
console.log('Copying to parent directory:', parentPdfOutputPath);
fs.copyFileSync(pdfOutputPath, parentPdfOutputPath);

// Clean up temporary HTML
if (fs.existsSync(tempHtmlPath)) {
  fs.unlinkSync(tempHtmlPath);
}

console.log('All student cards successfully exported to PDF with vibrant orange header and crisp logo (10 cards per page)!');
