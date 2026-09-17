const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)';
const excelFile = path.join(excelDir, 'قائمة_الطلبة_والأفواج.xlsx');
const backupFile = path.join(excelDir, 'قائمة_الطلبة_والأفواج_backup.xlsx');
const parentExcelFile = 'C:\\Users\\dell\\Downloads\\STU\\قائمة_الطلبة_والأفواج.xlsx';

console.log('1. Creating backup of original Excel file...');
fs.copyFileSync(excelFile, backupFile);
console.log('Backup created at:', backupFile);

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile(excelFile);

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

// Group sorting helper: BAC01..BAC09, then BACV01..BACV15
function sortGroups(groupArr) {
  const gOrder = [
    'BAC01', 'BAC02', 'BAC03', 'BAC04', 'BAC05', 'BAC06', 'BAC07', 'BAC08', 'BAC09',
    'BACV01', 'BACV02', 'BACV03', 'BACV04', 'BACV05', 'BACV06', 'BACV07', 'BACV08',
    'BACV09', 'BACV10', 'BACV11', 'BACV12', 'BACV13', 'BACV14', 'BACV15'
  ];
  return [...new Set(groupArr)].sort((a, b) => {
    const idxA = gOrder.indexOf(a);
    const idxB = gOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

// 1. Process Tab 1 students
const students = tab1.slice(1).map((r, idx) => {
  let name = String(r[1]).trim();
  if (name === 'بله باسي حنس') name = 'بله باسي حسن'; // fix typo
  const groups = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  return {
    num: r[0] || (idx + 1),
    name,
    groups: new Set(groups)
  };
}).filter(s => s.name);

// Canonical lookup maps
const canonMap = new Map();
const canonByNorm = new Map();
const canonByWordKey = new Map();

students.forEach(s => {
  canonMap.set(s.name, s);
  canonByNorm.set(norm(s.name), s);
  canonByWordKey.set(wordKey(s.name), s);
});

// 2. Existing variants from Tab 2
const variantsMap = new Map(); // canonName -> Set of variants
tab2.slice(1).forEach(r => {
  let canon = String(r[0]).trim();
  if (canon === 'بله باسي حنس') canon = 'بله باسي حسن';
  const vs = String(r[1]).split('/').map(s => s.trim()).filter(Boolean);
  if (!variantsMap.has(canon)) variantsMap.set(canon, new Set());
  vs.forEach(v => variantsMap.get(canon).add(v));
});

// Ensure typo variant is recorded
if (!variantsMap.has('بله باسي حسن')) variantsMap.set('بله باسي حسن', new Set());
variantsMap.get('بله باسي حسن').add('بله باسي حسن');
variantsMap.get('بله باسي حسن').add('بله باسي حنس');

// 3. Scan all groups from initialData
for (const gid in data.groupData) {
  const g = data.groupData[gid];
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const raw = s.name.trim();

    let matched = null;
    if (canonMap.has(raw)) {
      matched = canonMap.get(raw);
    } else if (canonByNorm.has(norm(raw))) {
      matched = canonByNorm.get(norm(raw));
    } else {
      for (const [canon, vSet] of variantsMap.entries()) {
        if (vSet.has(raw)) {
          matched = canonMap.get(canon);
          break;
        }
      }
    }

    if (!matched && canonByWordKey.has(wordKey(raw))) {
      matched = canonByWordKey.get(wordKey(raw));
    }

    if (matched) {
      matched.groups.add(gid);
      if (raw !== matched.name) {
        if (!variantsMap.has(matched.name)) {
          variantsMap.set(matched.name, new Set([matched.name]));
        }
        variantsMap.get(matched.name).add(raw);
      }
    }
  });
}

// Build updated Tab 1
const newTab1Data = [
  ['#', 'الاسم واللقب', 'عدد الأفواج', 'الأفواج']
];

students.forEach((s, idx) => {
  const sorted = sortGroups([...s.groups]);
  newTab1Data.push([
    idx + 1,
    s.name,
    sorted.length,
    sorted.join('، ')
  ]);
});

// Build updated Tab 2
const newTab2Data = [
  ['الاسم في القائمة', 'الكتابات الموجودة في الأفواج (تم اعتبارها نفس التلميذ)']
];

// Sort Tab 2 by canonical name
const sortedCanonNames = [...variantsMap.keys()].sort((a, b) => a.localeCompare(b, 'ar'));

sortedCanonNames.forEach(canon => {
  const vSet = variantsMap.get(canon);
  const vList = [...vSet];
  // Ensure canon is first
  const remaining = vList.filter(v => v !== canon);
  const formattedVariants = [canon, ...remaining].join(' / ');
  newTab2Data.push([canon, formattedVariants]);
});

console.log(`Updated Tab 1 rows: ${newTab1Data.length - 1} students`);
console.log(`Updated Tab 2 rows: ${newTab2Data.length - 1} variations`);

// Create new workbook with clean formatting
const newWb = xlsx.utils.book_new();

const ws1 = xlsx.utils.aoa_to_sheet(newTab1Data);
ws1['!cols'] = [
  { wch: 6 },  // #
  { wch: 28 }, // الاسم واللقب
  { wch: 12 }, // عدد الأفواج
  { wch: 55 }  // الأفواج
];
xlsx.utils.book_append_sheet(newWb, ws1, 'قائمة الطلبة');

const ws2 = xlsx.utils.aoa_to_sheet(newTab2Data);
ws2['!cols'] = [
  { wch: 28 }, // الاسم في القائمة
  { wch: 65 }  // الكتابات الموجودة في الأفواج
];
xlsx.utils.book_append_sheet(newWb, ws2, 'أسماء مكتوبة بطرق مختلفة');

console.log('Writing updated workbook to:', excelFile);
xlsx.writeFile(newWb, excelFile);

if (fs.existsSync(path.dirname(parentExcelFile))) {
  console.log('Writing copy to:', parentExcelFile);
  xlsx.writeFile(newWb, parentExcelFile);
}

console.log('Excel update complete!');
