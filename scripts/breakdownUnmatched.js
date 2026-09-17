const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab1Names = tab1.slice(1).map(r => String(r[1]).trim());

// Check which groups those 215 students belong to
const notInTab1ByGroup = {};

for (const gid in data.groupData) {
  const g = data.groupData[gid];
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const n = s.name.trim();
    // Check if directly in Tab 1
    if (!tab1Names.includes(n)) {
      if (!notInTab1ByGroup[gid]) notInTab1ByGroup[gid] = [];
      notInTab1ByGroup[gid].push(n);
    }
  });
}

console.log('Students in initialData but not in Tab 1 (by group):');
for (const gid in notInTab1ByGroup) {
  console.log(`${gid}: ${notInTab1ByGroup[gid].length} names`);
}
