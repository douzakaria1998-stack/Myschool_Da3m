const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
console.log('Props:', wb.Props);
console.log('Custprops:', wb.Custprops);
