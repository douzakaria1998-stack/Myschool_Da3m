const fs = require('fs');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));

// 1. Gather all student enrollments from all 24 groups
const enrollments = [];
data.groups.forEach(g => {
  const sheet = data.groupData[g.id];
  (sheet?.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    enrollments.push({
      groupId: g.id,
      rowId: s.rowId,
      name: s.name.trim(),
      phone: (s.phone || '').trim(),
      barcode: (s.barcode || '').trim()
    });
  });
});

console.log(`Total student enrollments in database: ${enrollments.length}`);

// Let's also read Tab 1 and Tab 2 from the Excel file in Downloads
const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

console.log(`Excel Tab 1 rows: ${tab1.length}`);
console.log(`Excel Tab 2 rows: ${tab2.length}`);

// Check all names in Tab 2
const currentTab2 = tab2.slice(1).map(r => ({
  canonical: String(r[0]).trim(),
  variantsStr: String(r[1]).trim(),
  variants: String(r[1]).split('/').map(s => s.trim()).filter(Boolean)
}));

console.log('Current Tab 2 entries:', currentTab2.length);
