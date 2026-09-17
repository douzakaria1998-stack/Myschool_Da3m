const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const excelNames = tab1.slice(1).map(r => String(r[1]).trim());
const excelSet = new Set(excelNames);

const bac01Stus = data.groupData['BAC01'].students.filter(s => s.name && !s.name.includes('المجموع'));

console.log(`BAC01 total students: ${bac01Stus.length}`);
console.log('Students in BAC01 not directly in Excel Tab 1:');
bac01Stus.forEach((s, idx) => {
  const name = s.name.trim();
  if (!excelSet.has(name)) {
    console.log(`[${idx + 1}] "${name}"`);
  }
});
