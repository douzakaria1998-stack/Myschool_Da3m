const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

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

const excelNorms = new Set(tab1.slice(1).map(r => normalizeArabicName(String(r[1]))));

const notInExcel = [];
Object.entries(data.groupData).forEach(([gid, gSheet]) => {
  (gSheet.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const norm = normalizeArabicName(s.name);
    if (!excelNorms.has(norm)) {
      notInExcel.push({ name: s.name.trim(), group: gid });
    }
  });
});

console.log('Total enrollments not in Excel:', notInExcel.length);

// Group by name
const notInExcelByName = {};
notInExcel.forEach(e => {
  if (!notInExcelByName[e.name]) notInExcelByName[e.name] = [];
  notInExcelByName[e.name].push(e.group);
});

console.log('Unique student names not in Excel:', Object.keys(notInExcelByName).length);
console.log('Sample (first 30):');
Object.entries(notInExcelByName).slice(0, 30).forEach(([k, v]) => {
  console.log(`"${k}" -> [${v.join(', ')}]`);
});
