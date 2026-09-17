const fs = require('fs');
const xlsx = require('xlsx');

const fullPath = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx';
const workbook = xlsx.readFile(fullPath);

const tab1 = xlsx.utils.sheet_to_json(workbook.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(workbook.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

console.log('Tab 1 total rows:', tab1.length);
console.log('Tab 2 total rows:', tab2.length);

// Let's print all rows of Tab 2 in detail
console.log('\n--- TAB 2 DETAILS ---');
tab2.slice(1).forEach((r, idx) => {
  console.log(`[${idx + 1}] Main Name: "${r[0]}" | Variants: "${r[1]}"`);
});

// Let's check which of the Tab 2 names exist in Tab 1
console.log('\n--- CHECK TAB 2 IN TAB 1 ---');
const tab1Names = new Set(tab1.slice(1).map(r => String(r[1]).trim()));
tab2.slice(1).forEach((r, idx) => {
  const mainName = String(r[0]).trim();
  const exists = tab1Names.has(mainName);
  const variants = String(r[1]).split('/').map(s => s.trim());
  const variantsInTab1 = variants.filter(v => v !== mainName && tab1Names.has(v));
  if (!exists || variantsInTab1.length > 0) {
    console.log(`Row ${idx + 2}: "${mainName}" in Tab1? ${exists}. Other variants in Tab1:`, variantsInTab1);
  }
});
