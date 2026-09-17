const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const names = ['حميدة ريان', 'تجاني عائشة', 'ضيف ايلياء'];
tab1.slice(1).forEach(r => {
  if (names.includes(String(r[1]).trim())) {
    console.log(r);
  }
});
