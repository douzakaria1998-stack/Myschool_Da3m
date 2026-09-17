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

console.log(`Total students in Tab 1: ${students.length}`);

// Normalization function
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

function wordsSet(str) {
  return new Set(cleanArabic(str).split(' ').filter(Boolean));
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

console.log('\n--- FINDING POTENTIAL DUPLICATES IN TAB 1 ---');

const pairs = [];
for (let i = 0; i < students.length; i++) {
  for (let j = i + 1; j < students.length; j++) {
    const s1 = students[i];
    const s2 = students[j];
    const c1 = cleanArabic(s1.name);
    const c2 = cleanArabic(s2.name);

    // Check exact clean match
    if (c1 === c2) {
      pairs.push({ type: 'EXACT_CLEAN', s1, s2 });
      continue;
    }

    // Check reversed words (e.g. "فرحات علي عماد الدين" vs "عماد الدين فرحات")
    const w1 = c1.split(' ').sort().join(' ');
    const w2 = c2.split(' ').sort().join(' ');
    if (w1 === w2) {
      pairs.push({ type: 'SAME_WORDS_PERMUTED', s1, s2 });
      continue;
    }

    // Check word subset (one is subset of other e.g. "محمد كريم" vs "محمد كريم زلاسي")
    const set1 = wordsSet(s1.name);
    const set2 = wordsSet(s2.name);
    let isSubset = true;
    for (const w of set1) {
      if (!set2.has(w)) { isSubset = false; break; }
    }
    if (isSubset && set1.size >= 2) {
      pairs.push({ type: 'SUBSET_NAME', s1, s2 });
      continue;
    }
    let isSubset2 = true;
    for (const w of set2) {
      if (!set1.has(w)) { isSubset2 = false; break; }
    }
    if (isSubset2 && set2.size >= 2) {
      pairs.push({ type: 'SUBSET_NAME', s1, s2 });
      continue;
    }

    // Check small edit distance (1 or 2 chars typo)
    const dist = levenshtein(c1, c2);
    if (dist <= 2 && Math.min(c1.length, c2.length) >= 6) {
      pairs.push({ type: 'TYPO_EDIT_DIST_' + dist, s1, s2 });
      continue;
    }
  }
}

console.log(`Found ${pairs.length} potential duplicate pairs in Tab 1:`);
pairs.forEach((p, idx) => {
  console.log(`\n[${idx + 1}] (${p.type}):`);
  console.log(`   A: "${p.s1.name}" (Groups: ${p.s1.groups.join(', ')})`);
  console.log(`   B: "${p.s2.name}" (Groups: ${p.s2.groups.join(', ')})`);
});
