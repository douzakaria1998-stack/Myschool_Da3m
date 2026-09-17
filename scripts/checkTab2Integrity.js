const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

console.log('--- ALL ROWS OF TAB 2 ---');
const allVariants = new Map();

tab2.slice(1).forEach((r, idx) => {
  const canon = String(r[0]).trim();
  const variants = String(r[1]).split('/').map(s => s.trim()).filter(Boolean);
  console.log(`${idx + 1}. Canon: "${canon}" | Raw: "${r[1]}"`);
  
  // check if canon is in Tab 1
  const tab1Row = tab1.slice(1).find(t1 => String(t1[1]).trim() === canon);
  if (!tab1Row) {
    console.log(`   *** WARNING: Canon "${canon}" NOT FOUND in Tab 1! ***`);
  }

  // check if any variant is also in Tab 1 under another row
  variants.forEach(v => {
    if (v !== canon) {
      const vInTab1 = tab1.slice(1).find(t1 => String(t1[1]).trim() === v);
      if (vInTab1) {
        console.log(`   *** WARNING: Variant "${v}" ALSO EXISTS as a separate student in Tab 1 (Row ${vInTab1[0]})! ***`);
      }
    }

    if (allVariants.has(v)) {
      console.log(`   *** WARNING: Variant "${v}" is repeated! Also in entry ${allVariants.get(v)} ***`);
    } else {
      allVariants.set(v, idx + 1);
    }
  });
});
