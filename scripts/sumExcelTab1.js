const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

let sumCount = 0;
let totalEnrollmentsInColD = 0;

tab1.slice(1).forEach(r => {
  const count = Number(r[2]) || 0;
  const grps = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  sumCount += count;
  totalEnrollmentsInColD += grps.length;
});

console.log('Sum of Column C (عدد الأفواج):', sumCount);
console.log('Total group occurrences in Column D:', totalEnrollmentsInColD);
