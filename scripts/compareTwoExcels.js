const fs = require('fs');

const f1 = 'C:\\Users\\dell\\Downloads\\STU\\قائمة_الطلبة_والأفواج.xlsx';
const f2 = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx';

const stat1 = fs.statSync(f1);
const stat2 = fs.statSync(f2);

console.log('f1 size:', stat1.size, 'mtime:', stat1.mtime);
console.log('f2 size:', stat2.size, 'mtime:', stat2.mtime);

const b1 = fs.readFileSync(f1);
const b2 = fs.readFileSync(f2);
console.log('Exact binary match?', b1.equals(b2));
