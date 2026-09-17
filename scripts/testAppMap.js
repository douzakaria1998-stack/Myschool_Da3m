const fs = require('fs');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));

function normalizeArabicName(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

const map = new Map();

Object.entries(data.groupData).forEach(([gid, gSheet]) => {
  (gSheet.students || []).forEach((s) => {
    if (!s.name || !s.name.trim() || s.name.includes('المجموع')) return;
    const cleanName = s.name.trim();
    const norm = normalizeArabicName(cleanName);
    const key = norm || cleanName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        name: cleanName,
        phone: s.phone || '',
        barcode: s.barcode || '',
        groups: []
      });
    }

    const entry = map.get(key);
    entry.groups.push(gid);
  });
});

console.log('Total unified students from app logic:', map.size);

// Check if all 322 students in Excel are in this map
const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

let foundInMap = 0;
let notFoundInMap = 0;

tab1.slice(1).forEach(r => {
  const name = String(r[1]).trim();
  const norm = normalizeArabicName(name);
  if (map.has(norm)) {
    foundInMap++;
  } else {
    notFoundInMap++;
    console.log('Not in map:', name);
  }
});

console.log(`Excel Tab 1 students: ${tab1.length - 1}`);
console.log(`Found in app map: ${foundInMap}, Not found: ${notFoundInMap}`);
