const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

// Build a map of student name in initialData -> list of groups
const studentInInitial = {};
for (const gid in data.groupData) {
  const g = data.groupData[gid];
  (g.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    const name = s.name.trim();
    if (!studentInInitial[name]) studentInInitial[name] = [];
    studentInInitial[name].push(gid);
  });
}

// Map of Tab 1 students
const tab1Map = {};
tab1.slice(1).forEach(r => {
  const name = String(r[1]).trim();
  const count = r[2];
  const groups = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  tab1Map[name] = { count, groups };
});

console.log('=== AUDITING TAB 2 ENTRIES AGAINST INITIALDATA & TAB 1 ===');
tab2.slice(1).forEach((r, idx) => {
  const canon = String(r[0]).trim();
  const variants = String(r[1]).split('/').map(s => s.trim()).filter(Boolean);
  
  // Find all groups where canon or any variant appears in initialData
  const actualGroups = new Set();
  const foundVariants = {};
  variants.forEach(v => {
    if (studentInInitial[v]) {
      foundVariants[v] = studentInInitial[v];
      studentInInitial[v].forEach(g => actualGroups.add(g));
    }
  });

  const tab1Entry = tab1Map[canon];
  const tab1Groups = tab1Entry ? tab1Entry.groups : [];

  const missingInTab1 = [...actualGroups].filter(g => !tab1Groups.includes(g));
  const extraInTab1 = tab1Groups.filter(g => !actualGroups.has(g));

  console.log(`[${idx + 1}] Canon: '${canon}'`);
  console.log(`    Variants in Tab 2:`, variants);
  console.log(`    Found in DB:`, foundVariants);
  console.log(`    Actual total DB groups: [${[...actualGroups].join(', ')}] (${actualGroups.size})`);
  console.log(`    Recorded in Tab 1: [${tab1Groups.join(', ')}] (${tab1Groups.length})`);
  if (missingInTab1.length > 0) {
    console.log(`    *** MISSING IN TAB 1: [${missingInTab1.join(', ')}] ***`);
  }
  if (extraInTab1.length > 0) {
    console.log(`    *** EXTRA IN TAB 1: [${extraInTab1.join(', ')}] ***`);
  }
});
