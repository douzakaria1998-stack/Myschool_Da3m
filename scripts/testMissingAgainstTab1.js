const xlsx = require('xlsx');

const wb = xlsx.readFile('C:\\Users\\dell\\Downloads\\STU\\New folder (2)\\قائمة_الطلبة_والأفواج.xlsx');
const tab1 = xlsx.utils.sheet_to_json(wb.Sheets['قائمة الطلبة'], { header: 1, defval: '' });

const namesInTab1 = tab1.slice(1).map(r => String(r[1]).trim());

function normalize(s) {
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const testList = [
  "حنين ناقص", "خميدة ريان", "دباب نور الهدى", "دباب عبد المنعم", "عطية ملاك",
  "هميسي افراح", "خماس اكرام", "حليمة خماس", "المنور فلة", "جلايبة ملاك",
  "مقدود عبد الله", "بية سندس", "يوزغاية ملاك", "فرحات غالية", "مناصير علي",
  "زياد باسم", "سويد بشرى", "سعيد سارة", "حفصي بشرى", "عيساوي امل",
  "ضيف اليا", "عائشة زناي", "سويد ياسمين", "دقة غفران", "تامة نرجس",
  "تجيني عائشة", "احمودة منال", "ملاك حنيش", "حوامدي لجين"
];

console.log('Testing missing names against Tab 1:');
testList.forEach(name => {
  const normWords = normalize(name).split(' ').sort().join(' ');
  const match = namesInTab1.find(t1 => {
    const t1Words = normalize(t1).split(' ').sort().join(' ');
    return t1Words === normWords;
  });

  if (match) {
    console.log(`FOUND PERMUTATION: "${name}" <==> Tab1: "${match}"`);
  } else {
    // Check partial / typo
    const close = namesInTab1.filter(t1 => {
      const n1 = normalize(name);
      const n2 = normalize(t1);
      return (n1.includes(n2) || n2.includes(n1)) && Math.abs(n1.length - n2.length) <= 3;
    });
    if (close.length > 0) {
      console.log(`FOUND CLOSE: "${name}" <==> Tab1: ${close.join(', ')}`);
    } else {
      console.log(`NOT IN TAB 1 AT ALL: "${name}"`);
    }
  }
});
