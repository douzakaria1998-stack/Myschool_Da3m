const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const tab1Names = tab1.slice(1).map(r => String(r[1]).trim());
console.log('Tab 1 total names:', tab1Names.length);

// Check if Tab 1 contains students from regular groups or only VIP, or what?
let vipOnly = 0;
let regularOnly = 0;
let both = 0;

tab1.slice(1).forEach(r => {
  const grps = String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const hasVip = grps.some(g => g.startsWith('BACV'));
  const hasReg = grps.some(g => g.startsWith('BAC') && !g.startsWith('BACV'));
  if (hasVip && hasReg) both++;
  else if (hasVip) vipOnly++;
  else if (hasReg) regularOnly++;
});

console.log(`Tab 1 breakdown:`);
console.log(`- Regular groups only: ${regularOnly}`);
console.log(`- VIP groups only: ${vipOnly}`);
console.log(`- Both: ${both}`);
