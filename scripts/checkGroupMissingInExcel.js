const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

// Build map of variant -> canonical name from Tab 2
const variantMap = {};
tab2.slice(1).forEach(r => {
  const canonical = String(r[0]).trim();
  const variants = String(r[1]).split('/').map(s => s.trim()).filter(Boolean);
  variants.forEach(v => {
    variantMap[v] = canonical;
  });
});

const excelNames = new Set(tab1.slice(1).map(r => String(r[1]).trim()));

console.log('--- CHECKING STUDENTS PER GROUP IN INITIALDATA VS EXCEL ---');
data.groups.forEach(g => {
  const sheet = data.groupData[g.id];
  const stus = (sheet?.students || []).filter(s => s.name && !s.name.includes('المجموع'));
  let inExcelCount = 0;
  let missing = [];
  stus.forEach(s => {
    const rawName = s.name.trim();
    const canon = variantMap[rawName] || rawName;
    if (excelNames.has(canon) || excelNames.has(rawName)) {
      inExcelCount++;
    } else {
      missing.push(rawName);
    }
  });
  console.log(`${g.id} (${stus.length} students): ${inExcelCount} found in Excel, ${missing.length} missing.`);
  if (missing.length > 0 && missing.length <= 10) {
    console.log(`   Missing:`, missing);
  } else if (missing.length > 10) {
    console.log(`   Sample missing (first 5):`, missing.slice(0, 5));
  }
});
