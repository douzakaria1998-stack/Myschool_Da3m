const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const allGroupsInExcel = new Set();
tab1.slice(1).forEach(r => {
  const grps = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  grps.forEach(g => allGroupsInExcel.add(g));
});

console.log('Groups in Excel Tab 1:', [...allGroupsInExcel].sort());
