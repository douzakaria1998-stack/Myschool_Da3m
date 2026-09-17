const fs = require('fs');
const xlsx = require('xlsx');

const initialData = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

console.log('Comparing groups for students in Tab 1 vs initialData.json...');

// Map student name -> groups in initialData
const studentGroupsInitial = {};
Object.entries(initialData.groupData).forEach(([gId, sheet]) => {
  (sheet.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const name = s.name.trim();
    if (!studentGroupsInitial[name]) studentGroupsInitial[name] = new Set();
    studentGroupsInitial[name].add(gId);
  });
});

let matches = 0;
let groupDiffs = 0;

tab1.slice(1).forEach(r => {
  const name = String(r[1]).trim();
  const excelGroups = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const initGroups = studentGroupsInitial[name] ? [...studentGroupsInitial[name]] : [];

  const excelSet = new Set(excelGroups);
  const initSet = new Set(initGroups);

  const missingInExcel = initGroups.filter(g => !excelSet.has(g));
  const missingInInit = excelGroups.filter(g => !initSet.has(g));

  if (missingInExcel.length > 0 || missingInInit.length > 0) {
    groupDiffs++;
    if (groupDiffs <= 10) {
      console.log(`Student "${name}":`);
      console.log(`   Excel groups: [${excelGroups.join(', ')}]`);
      console.log(`   InitialData groups: [${initGroups.join(', ')}]`);
      console.log(`   Missing in Excel: [${missingInExcel.join(', ')}]`);
      console.log(`   Missing in InitialData: [${missingInInit.join(', ')}]`);
    }
  } else {
    matches++;
  }
});

console.log(`Total checked: ${tab1.length - 1}`);
console.log(`Exact group matches: ${matches}`);
console.log(`Differences: ${groupDiffs}`);
