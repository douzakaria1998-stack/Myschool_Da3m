const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const names = tab1.slice(1).map(r => ({
  num: r[0],
  name: String(r[1]).trim(),
  groups: String(r[3]).trim()
}));

function norm(s) {
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('Checking word-order permutations in Tab 1...');
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const k1 = norm(names[i].name).split(' ').sort().join(' ');
    const k2 = norm(names[j].name).split(' ').sort().join(' ');
    if (k1 === k2) {
      console.log(`Match: Row ${i+2} "${names[i].name}" [${names[i].groups}] <==> Row ${j+2} "${names[j].name}" [${names[j].groups}]`);
    }
  }
}
console.log('Done checking word-order permutations.');
