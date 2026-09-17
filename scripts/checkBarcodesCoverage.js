const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

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

// Map from initialData
const barcodeByNorm = new Map();
const barcodeByWordKey = new Map();

for (const gid in data.groupData) {
  (data.groupData[gid].students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع') || !s.barcode) return;
    const n = norm(s.name);
    const wk = wordKey(s.name);
    if (!barcodeByNorm.has(n)) barcodeByNorm.set(n, s.barcode);
    if (!barcodeByWordKey.has(wk)) barcodeByWordKey.set(wk, s.barcode);
  });
}

let withBarcode = 0;
let withoutBarcode = 0;

tab1.slice(1).forEach(r => {
  let name = String(r[1]).trim();
  if (name === 'بله باسي حنس') name = 'بله باسي حسن';
  const n = norm(name);
  const wk = wordKey(name);
  const bc = barcodeByNorm.get(n) || barcodeByWordKey.get(wk);
  if (bc) {
    withBarcode++;
  } else {
    withoutBarcode++;
    console.log('No barcode in DB for:', name);
  }
});

console.log({ withBarcode, withoutBarcode });
