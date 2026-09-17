const fs = require('fs');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));

console.log('Group student counts in initialData.json:');
let total = 0;
data.groups.forEach(g => {
  const sheet = data.groupData[g.id];
  const stus = (sheet?.students || []).filter(s => s.name && !s.name.includes('المجموع'));
  total += stus.length;
  console.log(`${g.id}: ${stus.length} students`);
});
console.log('Total enrollments:', total);
