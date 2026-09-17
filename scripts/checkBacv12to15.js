const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

const tab1Names = new Set(tab1.slice(1).map(r => String(r[1]).trim()));
const variantMap = {};
tab2.slice(1).forEach(r => {
  const c = String(r[0]).trim();
  const vs = String(r[1]).split('/').map(s => s.trim());
  vs.forEach(v => variantMap[v] = c);
});

['BACV12', 'BACV13', 'BACV14', 'BACV15'].forEach(gid => {
  const g = data.groupData[gid];
  console.log('=== ' + gid + ' ===');
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const n = s.name.trim();
    const canon = variantMap[n] || n;
    const inTab1 = tab1Names.has(n) || tab1Names.has(canon);
    console.log('  ' + n + ' -> canon: ' + canon + ' | in Tab 1? ' + inTab1);
  });
});
