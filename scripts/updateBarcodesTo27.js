const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
let content = fs.readFileSync(filePath, 'utf8');

const matches = (content.match(/"STU-26/g) || []).length;
console.log('Matches found:', matches);

content = content.replace(/"STU-26/g, '"STU-27');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated initialData.json successfully to STU-27!');
