const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

function norm(s) {
  return (s || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ|ؤ/g, 'ء')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

function wordKey(s) {
  return norm(s).split(' ').sort().join(' ');
}

// 1. Get Tab 1 students
const students = tab1.slice(1).map(r => {
  let name = String(r[1]).trim();
  if (name === 'بله باسي حنس') name = 'بله باسي حسن'; // fix typo
  const count = r[2];
  const groups = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  return { num: r[0], name, count, groups };
});

// Map of canonical name -> student
const canonMap = new Map();
const canonByWordKey = new Map();
const canonByNorm = new Map();

students.forEach(s => {
  canonMap.set(s.name, s);
  canonByWordKey.set(wordKey(s.name), s);
  canonByNorm.set(norm(s.name), s);
});

// 2. Tab 2 existing variants
const existingVariantsMap = new Map(); // canonName -> Set of variants
tab2.slice(1).forEach(r => {
  let canon = String(r[0]).trim();
  if (canon === 'بله باسي حنس') canon = 'بله باسي حسن';
  const vs = String(r[1]).split('/').map(s => s.trim()).filter(Boolean);
  if (!existingVariantsMap.has(canon)) existingVariantsMap.set(canon, new Set());
  vs.forEach(v => existingVariantsMap.get(canon).add(v));
});

// 3. Scan all DB groups to find student matches and variants
const allDbEnrollments = [];
for (const gid in data.groupData) {
  const g = data.groupData[gid];
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    allDbEnrollments.push({ gid, rawName: s.name.trim(), barcode: s.barcode });
  });
}

// Map each enrollment to a Tab 1 student if applicable
const studentGroups = new Map(); // student -> Set of groups
students.forEach(s => {
  // start with existing groups in Tab 1
  studentGroups.set(s.name, new Set(s.groups));
});

// Map student -> Set of variants
const studentVariants = new Map();
existingVariantsMap.forEach((set, canon) => {
  if (canonMap.has(canon)) {
    studentVariants.set(canon, new Set(set));
  }
});

// Add bله باسي حنس -> بله باسي حسن
if (!studentVariants.has('بله باسي حسن')) studentVariants.set('بله باسي حسن', new Set());
studentVariants.get('بله باسي حسن').add('بله باسي حسن');
studentVariants.get('بله باسي حسن').add('بله باسي حنس');

allDbEnrollments.forEach(en => {
  const raw = en.rawName;
  let matchedStudent = null;

  // 1. Direct match
  if (canonMap.has(raw)) {
    matchedStudent = canonMap.get(raw);
  } else if (canonByNorm.has(norm(raw))) {
    matchedStudent = canonByNorm.get(norm(raw));
  } else {
    // 2. Check existing Tab 2 variants
    for (const [canon, vSet] of existingVariantsMap.entries()) {
      if (vSet.has(raw)) {
        matchedStudent = canonMap.get(canon);
        break;
      }
    }
  }

  // 3. Word permutation match (e.g. reversed first/last name)
  if (!matchedStudent && canonByWordKey.has(wordKey(raw))) {
    matchedStudent = canonByWordKey.get(wordKey(raw));
  }

  if (matchedStudent) {
    // Add group
    studentGroups.get(matchedStudent.name).add(en.gid);

    // If spelling differs from canonical, record as variant!
    if (raw !== matchedStudent.name) {
      if (!studentVariants.has(matchedStudent.name)) {
        studentVariants.set(matchedStudent.name, new Set([matchedStudent.name]));
      }
      studentVariants.get(matchedStudent.name).add(raw);
    }
  }
});

console.log('=== CONSOLIDATION SUMMARY ===');
console.log('Total students in Tab 1:', students.length);
console.log('Total students with recorded variants for Tab 2:', studentVariants.size);

// Print all variants that will be in Tab 2
console.log('\n--- TAB 2 ROWS TO BE GENERATED ---');
let t2Idx = 1;
const tab2Rows = [];
for (const [canon, vSet] of studentVariants.entries()) {
  const sortedVariants = [...vSet];
  // make sure canon is included if we follow the format "variant1 / variant2"
  if (!sortedVariants.includes(canon)) sortedVariants.unshift(canon);
  const variantStr = sortedVariants.join(' / ');
  tab2Rows.push([canon, variantStr]);
  console.log(`[${t2Idx++}] Canon: "${canon}" | Variants: "${variantStr}"`);
}
