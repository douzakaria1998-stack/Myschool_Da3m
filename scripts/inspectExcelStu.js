const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dirPath = 'C:\\Users\\dell\\Downloads\\STU\\New folder (2)';
const files = fs.readdirSync(dirPath);
console.log('Files in directory:', files);

const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
if (!excelFile) {
  console.log('No excel file found!');
  process.exit(1);
}

const fullPath = path.join(dirPath, excelFile);
console.log('Reading Excel file:', fullPath);

const workbook = xlsx.readFile(fullPath);
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach((sheetName, index) => {
  console.log(`\n--- TAB ${index + 1}: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log(`Total Rows: ${jsonData.length}`);
  console.log('First 15 rows:');
  console.log(jsonData.slice(0, 15));
});
