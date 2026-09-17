const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

tab2.slice(1).forEach(r => {
  if (String(r[0]).includes('حفصي') || String(r[1]).includes('حفصي')) {
    console.log(r);
  }
});
console.log('Done checking Tab 2 for Hafsi.');
