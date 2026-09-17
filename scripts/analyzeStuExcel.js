const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const fullPath = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx';
const workbook = xlsx.readFile(fullPath);

console.log('=== ALL ROWS IN TAB 2 (أسماء مكتوبة بطرق مختلفة) ===');
const tab2 = xlsx.utils.sheet_to_json(workbook.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });
tab2.forEach((row, i) => {
  console.log(`${i}: ${JSON.stringify(row)}`);
});

console.log('\n=== CHECK DUPLICATE NAMES IN TAB 1 (قائمة الطلبة) ===');
const tab1 = xlsx.utils.sheet_to_json(workbook.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const nameCounts = {};
tab1.slice(1).forEach((row, i) => {
  const name = String(row[1] || '').trim();
  if (!name) return;
  if (!nameCounts[name]) nameCounts[name] = [];
  nameCounts[name].push({ rowIndex: i + 2, num: row[0], groups: row[3], count: row[2] });
});

const duplicates = Object.entries(nameCounts).filter(([k, v]) => v.length > 1);
console.log('Duplicates in Tab 1 (exact match):', duplicates.length);
duplicates.forEach(([k, v]) => console.log(k, v));

console.log('\n=== CHECK NEAR-DUPLICATES / NORMALIZED DUPLICATES IN TAB 1 ===');
const normalize = (str) => {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
};

const normCounts = {};
tab1.slice(1).forEach((row, i) => {
  const name = String(row[1] || '').trim();
  if (!name) return;
  const norm = normalize(name);
  if (!normCounts[norm]) normCounts[norm] = [];
  normCounts[norm].push({ original: name, rowIndex: i + 2, num: row[0], groups: row[3], count: row[2] });
});

const normDuplicates = Object.entries(normCounts).filter(([k, v]) => v.length > 1);
console.log('Normalized duplicates in Tab 1:', normDuplicates.length);
normDuplicates.forEach(([k, v]) => console.log(k, v));
