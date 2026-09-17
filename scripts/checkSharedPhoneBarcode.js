const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

// Build a map of normalized student name -> phone, barcode
function norm(s) {
  return (s || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

const dbStudentInfo = new Map();
for (const gid in data.groupData) {
  const g = data.groupData[gid];
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const n = norm(s.name);
    if (!dbStudentInfo.has(n)) {
      dbStudentInfo.set(n, {
        rawName: s.name.trim(),
        phone: (s.phone || '').trim(),
        barcode: (s.barcode || '').trim(),
        groups: []
      });
    }
    dbStudentInfo.get(n).groups.push(gid);
    if (s.phone && !dbStudentInfo.get(n).phone) dbStudentInfo.get(n).phone = s.phone.trim();
    if (s.barcode && !dbStudentInfo.get(n).barcode) dbStudentInfo.get(n).barcode = s.barcode.trim();
  });
}

// Check Tab 1 students
const students = tab1.slice(1).map(r => {
  const name = String(r[1]).trim();
  const info = dbStudentInfo.get(norm(name)) || {};
  return {
    num: r[0],
    name,
    count: r[2],
    groups: r[3],
    phone: info.phone || '',
    barcode: info.barcode || ''
  };
});

console.log('--- CHECKING SHARED PHONES IN TAB 1 ---');
const phoneMap = new Map();
students.forEach(s => {
  if (s.phone && s.phone.length >= 8) {
    if (!phoneMap.has(s.phone)) phoneMap.set(s.phone, []);
    phoneMap.get(s.phone).push(s);
  }
});

for (const [phone, list] of phoneMap.entries()) {
  if (list.length > 1) {
    console.log(`Shared Phone ${phone}:`);
    list.forEach(s => console.log(`   [Row ${s.num}] "${s.name}" (${s.groups})`));
  }
}

console.log('\n--- CHECKING SHARED BARCODES IN TAB 1 ---');
const barcodeMap = new Map();
students.forEach(s => {
  if (s.barcode) {
    if (!barcodeMap.has(s.barcode)) barcodeMap.set(s.barcode, []);
    barcodeMap.get(s.barcode).push(s);
  }
});

for (const [barcode, list] of barcodeMap.entries()) {
  if (list.length > 1) {
    console.log(`Shared Barcode ${barcode}:`);
    list.forEach(s => console.log(`   [Row ${s.num}] "${s.name}" (${s.groups})`));
  }
}
