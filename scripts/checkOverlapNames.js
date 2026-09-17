const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const students = tab1.slice(1).map(r => ({
  num: r[0],
  name: String(r[1]).trim(),
  count: r[2],
  groups: String(r[3]).trim()
}));

function norm(s) {
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('--- CHECKING SIMILAR NAMES IN TAB 1 ---');
for (let i = 0; i < students.length; i++) {
  for (let j = i + 1; j < students.length; j++) {
    const s1 = students[i];
    const s2 = students[j];
    const n1 = norm(s1.name);
    const n2 = norm(s2.name);

    const words1 = n1.split(' ');
    const words2 = n2.split(' ');

    // Check if words overlap significantly
    const common = words1.filter(w => words2.includes(w) && w.length > 2);
    if (common.length >= 2) {
      console.log(`Common [${common.join(', ')}]:`);
      console.log(`   [Row ${s1.num}] "${s1.name}" (${s1.groups})`);
      console.log(`   [Row ${s2.num}] "${s2.name}" (${s2.groups})`);
    }
  }
}
