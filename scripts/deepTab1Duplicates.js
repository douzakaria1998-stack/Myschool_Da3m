const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });
const tab2 = xlsx.utils.sheet_to_json(wb.Sheets['أسماء مكتوبة بطرق مختلفة'], { header: 1, defval: '' });

const students = tab1.slice(1).map(r => ({
  num: r[0],
  name: String(r[1]).trim(),
  count: r[2],
  groups: String(r[3]).split(/[،,]/).map(s => s.trim()).filter(Boolean)
})).filter(s => s.name);

function cleanArabic(str) {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ئ|ؤ/g, 'ء')
    .replace(/[\u064B-\u065F]/g, '') // tashkeel
    .replace(/\s+/g, ' ')
    .trim();
}

function phonetic(str) {
  return cleanArabic(str)
    .replace(/[ذظض]/g, 'د')
    .replace(/ص/g, 'س')
    .replace(/ق/g, 'ك')
    .replace(/ث/g, 'ت')
    .replace(/ح/g, 'ه')
    .replace(/ع/g, 'ا');
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

console.log('--- CHECKING TAB 1 FOR CLOSE MATCHES ---');
for (let i = 0; i < students.length; i++) {
  for (let j = i + 1; j < students.length; j++) {
    const s1 = students[i];
    const s2 = students[j];
    const c1 = cleanArabic(s1.name);
    const c2 = cleanArabic(s2.name);

    // 1. Same words permuted
    const w1 = c1.split(' ').sort().join(' ');
    const w2 = c2.split(' ').sort().join(' ');
    if (w1 === w2) {
      console.log(`[PERMUTATION] Row ${s1.num} "${s1.name}" (${s1.groups}) <==> Row ${s2.num} "${s2.name}" (${s2.groups})`);
      continue;
    }

    // 2. Levenshtein <= 2
    const d = levenshtein(c1, c2);
    if (d <= 2 && Math.min(c1.length, c2.length) >= 6) {
      console.log(`[EDIT_DIST_${d}] Row ${s1.num} "${s1.name}" (${s1.groups}) <==> Row ${s2.num} "${s2.name}" (${s2.groups})`);
      continue;
    }

    // 3. Phonetic match
    const p1 = phonetic(s1.name);
    const p2 = phonetic(s2.name);
    if (p1 === p2 && p1.length >= 6) {
      console.log(`[PHONETIC] Row ${s1.num} "${s1.name}" (${s1.groups}) <==> Row ${s2.num} "${s2.name}" (${s2.groups})`);
      continue;
    }
    const pw1 = p1.split(' ').sort().join(' ');
    const pw2 = p2.split(' ').sort().join(' ');
    if (pw1 === pw2 && pw1.length >= 6) {
      console.log(`[PHONETIC_PERM] Row ${s1.num} "${s1.name}" (${s1.groups}) <==> Row ${s2.num} "${s2.name}" (${s2.groups})`);
      continue;
    }
  }
}
