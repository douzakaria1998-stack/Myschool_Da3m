const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

// Normalization
function cleanArabic(str) {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ|ؤ/g, 'ء')
    .replace(/[\u064B-\u065F]/g, '') // tashkeel
    .replace(/\s+/g, ' ')
    .trim();
}

function wordKey(str) {
  return cleanArabic(str).split(' ').sort().join(' ');
}

// Tab 1 students
const tab1Students = tab1.slice(1).map(r => ({
  num: r[0],
  name: String(r[1]).trim(),
  count: r[2],
  groups: String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean)
})).filter(s => s.name);

const tab1NamesSet = new Set(tab1Students.map(s => s.name));
const tab1CleanMap = new Map(); // clean -> student
const tab1WordKeyMap = new Map(); // word sorted -> student

tab1Students.forEach(s => {
  tab1CleanMap.set(cleanArabic(s.name), s);
  tab1WordKeyMap.set(wordKey(s.name), s);
});

// Tab 2 existing variants
const variantToCanon = new Map();
tab2.slice(1).forEach(r => {
  const canon = String(r[0]).trim();
  const vs = String(r[1]).split('/').map(s => s.trim()).filter(Boolean);
  vs.forEach(v => variantToCanon.set(v, canon));
});

// All DB enrollments
const dbStudents = [];
for (const gid in data.groupData) {
  const g = data.groupData[gid];
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    dbStudents.push({
      groupId: gid,
      name: s.name.trim(),
      phone: s.phone,
      barcode: s.barcode
    });
  });
}

// Check every distinct raw name in DB
const distinctDbNames = [...new Set(dbStudents.map(s => s.name))];
console.log('Total distinct raw names in DB:', distinctDbNames.length);

const exactMatch = [];
const tab2Match = [];
const wordKeyMatch = [];
const noMatch = [];

distinctDbNames.forEach(rawName => {
  if (tab1NamesSet.has(rawName)) {
    exactMatch.push(rawName);
    return;
  }
  if (variantToCanon.has(rawName)) {
    tab2Match.push({ rawName, canon: variantToCanon.get(rawName) });
    return;
  }
  const wk = wordKey(rawName);
  if (tab1WordKeyMap.has(wk)) {
    wordKeyMatch.push({ rawName, matched: tab1WordKeyMap.get(wk).name });
    return;
  }
  noMatch.push(rawName);
});

console.log('Exact matches with Tab 1:', exactMatch.length);
console.log('Tab 2 variant matches:', tab2Match.length);
console.log('Word-order / permutation matches:', wordKeyMatch.length);
console.log('No direct match:', noMatch.length);

console.log('\n--- WORD-ORDER MATCHES (e.g. Reversed First/Last Name) ---');
wordKeyMatch.forEach(m => {
  console.log(`DB: "${m.rawName}"  ==>  Tab 1: "${m.matched}"`);
});

console.log('\n--- SAMPLE NO-MATCH NAMES (first 30) ---');
console.log(noMatch.slice(0, 30));
