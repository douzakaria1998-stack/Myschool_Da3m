const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const namesToCheck = ['زروق آمنة', 'ابراهيم زقب', 'اريج بن عمر', 'جاب الله الهادي'];
tab1.slice(1).forEach(r => {
  if (namesToCheck.includes(String(r[1]).trim())) {
    console.log(r);
  }
});
