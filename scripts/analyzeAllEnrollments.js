const fs = require('fs');

const data = JSON.parse(fs.readFileSync('c:/Users/dell/Desktop/Da3m/src/data/initialData.json', 'utf8'));

// Extract all raw enrollments
const allEnrollments = [];
data.groups.forEach(g => {
  const sheet = data.groupData[g.id];
  (sheet?.students || []).forEach(s => {
    if (!s.name || s.name.includes('المجموع')) return;
    allEnrollments.push({
      groupId: g.id,
      name: s.name.trim(),
      phone: s.phone || '',
      barcode: s.barcode || ''
    });
  });
});

console.log('Total enrollments:', allEnrollments.length);

// Normalization function
function normalize(str) {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ|ؤ/g, 'ء')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token sorted key
function tokenKey(str) {
  return normalize(str).split(' ').filter(Boolean).sort().join(' ');
}

// Group by exact raw name
const byRawName = {};
allEnrollments.forEach(e => {
  if (!byRawName[e.name]) byRawName[e.name] = [];
  byRawName[e.name].push(e);
});
console.log('Distinct raw names:', Object.keys(byRawName).length);

// Group by normalized name
const byNorm = {};
allEnrollments.forEach(e => {
  const norm = normalize(e.name);
  if (!byNorm[norm]) byNorm[norm] = [];
  byNorm[norm].push(e);
});
console.log('Distinct normalized names:', Object.keys(byNorm).length);

// Group by token-sorted key (e.g. "أنفال بن موسى" vs "بن موسى أنفال")
const byToken = {};
allEnrollments.forEach(e => {
  const tk = tokenKey(e.name);
  if (!byToken[tk]) byToken[tk] = [];
  byToken[tk].push(e);
});
console.log('Distinct token-sorted names (handles reversed first/last name):', Object.keys(byToken).length);

// Also compare with phones!
const byPhone = {};
allEnrollments.forEach(e => {
  const cleanPhone = String(e.phone).replace(/\D/g, '');
  if (cleanPhone.length >= 9) {
    if (!byPhone[cleanPhone]) byPhone[cleanPhone] = new Set();
    byPhone[cleanPhone].add(e.name);
  }
});

const samePhoneDiffNames = Object.entries(byPhone).filter(([p, names]) => names.size > 1);
console.log('Phone numbers shared by different name spellings:', samePhoneDiffNames.length);
samePhoneDiffNames.slice(0, 15).forEach(([p, names]) => {
  console.log(`Phone ${p}:`, [...names]);
});
