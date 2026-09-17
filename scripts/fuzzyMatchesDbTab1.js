const fs = require('fs');
const xlsx = require('xlsx');

const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab1Names = tab1.slice(1).map(r => String(r[1]).trim());

function norm(s) {
  return (s || '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ|ؤ/g, 'ء')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Check remaining 215 names
const { dbStudents } = require('./findMissingStudentsMapping'); // we can write self-contained

const allDbNames = new Set();
for (const gid in data.groupData) {
  (data.groupData[gid].students || []).forEach(s => {
    if (s.name && !s.name.includes('المجموع')) allDbNames.add(s.name.trim());
  });
}

const tab1NormMap = new Map();
tab1Names.forEach(n => tab1NormMap.set(norm(n), n));

console.log('--- CHECKING FUZZY / TYPO MATCHES FOR ALL DB NAMES AGAINST TAB 1 ---');
const fuzzyMatches = [];

allDbNames.forEach(dbName => {
  const nDb = norm(dbName);
  if (tab1NormMap.has(nDb)) return; // exact/clean match

  const dbWords = nDb.split(' ').sort().join(' ');
  for (const [tNorm, tOrig] of tab1NormMap.entries()) {
    const tWords = tNorm.split(' ').sort().join(' ');
    if (dbWords === tWords) return; // word permutation already known

    // Check Levenshtein distance
    const dist = levenshtein(nDb, tNorm);
    if (dist <= 2 && Math.min(nDb.length, tNorm.length) >= 6) {
      fuzzyMatches.push({ dbName, tab1Name: tOrig, dist, type: 'EDIT_DIST_' + dist });
    }
  }
});

console.log(`Found ${fuzzyMatches.length} close fuzzy matches:`);
fuzzyMatches.forEach(m => {
  console.log(`DB: "${m.dbName}"  <==>  Tab 1: "${m.tab1Name}" (${m.type})`);
});
