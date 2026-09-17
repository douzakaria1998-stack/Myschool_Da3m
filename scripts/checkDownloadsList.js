const fs = require('fs');
const path = require('path');

const filesNeeded = 'C:\\Users\\dell\\Downloads\\Files needed';
try {
  const f = fs.readdirSync(filesNeeded);
  console.log('Files needed:', f);
} catch (e) {
  console.log(e.message);
}

const stu = 'C:\\Users\\dell\\Downloads\\STU';
try {
  const f2 = fs.readdirSync(stu);
  console.log('STU:', f2);
} catch (e) {
  console.log(e.message);
}
