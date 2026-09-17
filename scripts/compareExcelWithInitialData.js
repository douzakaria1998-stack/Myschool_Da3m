const fs = require('fs');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));

console.log('Center Name:', data.centerName);
console.log('Cycle:', data.cycle);
console.log('Total Groups:', data.groups.length);

const allStudents = [];
const groupMap = {};

Object.entries(data.groupData).forEach(([gId, sheet]) => {
  (sheet.students || []).forEach(s => {
    // filter out summary row if any
    if (s.name && !s.name.includes('المجموع') && !s.name.includes('العدد الإجمالي')) {
      allStudents.push({
        groupId: gId,
        rowId: s.rowId,
        name: s.name.trim(),
        phone: s.phone,
        barcode: s.barcode
      });
      if (!groupMap[s.name.trim()]) groupMap[s.name.trim()] = [];
      groupMap[s.name.trim()].push(gId);
    }
  });
});

console.log('Total student enrollment entries across all groups:', allStudents.length);
console.log('Unique raw names in initialData.json:', Object.keys(groupMap).length);

// Compare with Tab 1 names in Excel
const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab1Names = tab1.slice(1).map(r => String(r[1]).trim()).filter(Boolean);

console.log('Total students in Excel Tab 1:', tab1Names.length);

// Check differences between initialData unique names and Excel Tab 1
const initialNamesSet = new Set(Object.keys(groupMap));
const excelNamesSet = new Set(tab1Names);

const inInitialNotExcel = [...initialNamesSet].filter(n => !excelNamesSet.has(n));
const inExcelNotInitial = [...excelNamesSet].filter(n => !initialNamesSet.has(n));

console.log('Names in initialData but NOT in Excel Tab 1:', inInitialNotExcel.length);
console.log('Sample in initialData not Excel:', inInitialNotExcel.slice(0, 30));

console.log('Names in Excel Tab 1 but NOT in initialData:', inExcelNotInitial.length);
console.log('Sample in Excel not initialData:', inExcelNotInitial.slice(0, 30));
