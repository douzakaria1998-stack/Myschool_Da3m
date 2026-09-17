const fs = require('fs');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));

// Check how many students in the school
const allStudents = [];
data.groups.forEach(g => {
  const sheet = data.groupData[g.id];
  (sheet?.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    allStudents.push({
      group: g.id,
      name: s.name.trim(),
      phone: (s.phone || '').trim(),
      barcode: (s.barcode || '').trim()
    });
  });
});

console.log('Total students across all groups:', allStudents.length);

// Let's check how many students in BAC01..BAC09
const regularStus = allStudents.filter(s => s.group.startsWith('BAC') && !s.group.startsWith('BACV'));
console.log('Regular group enrollments:', regularStus.length);

const vipStus = allStudents.filter(s => s.group.startsWith('BACV'));
console.log('VIP group enrollments:', vipStus.length);
