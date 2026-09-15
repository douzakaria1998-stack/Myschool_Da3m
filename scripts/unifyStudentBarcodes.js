const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const data = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

// 1. Gather all unique students by normalized name
function normalizeName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Preserve existing STU- barcodes (e.g. STU-26866810)
const existingStuBarcodes = new Map();
const usedBarcodes = new Set();

for (const group of Object.values(data.groupData)) {
  for (const s of group.students || []) {
    const b = (s.barcode || '').trim().toUpperCase();
    if (b.startsWith('STU-')) {
      const norm = normalizeName(s.name);
      if (!existingStuBarcodes.has(norm)) {
        existingStuBarcodes.set(norm, b);
        usedBarcodes.add(b);
      }
    }
  }
}

// Collect all unique students across all groups
const uniqueStudents = [];
const studentNameToBarcode = new Map();

// First, assign preserved STU- barcodes
for (const [norm, b] of existingStuBarcodes.entries()) {
  studentNameToBarcode.set(norm, b);
}

// Next, assign sequential unique STU-26XXXXXX barcodes for all other students
let serialCounter = 1;

for (const group of Object.values(data.groupData)) {
  for (const s of group.students || []) {
    const norm = normalizeName(s.name);
    if (!norm) continue;

    if (!studentNameToBarcode.has(norm)) {
      // Find next unused barcode
      let candidate = '';
      while (true) {
        candidate = `STU-26${serialCounter.toString().padStart(6, '0')}`;
        serialCounter++;
        if (!usedBarcodes.has(candidate)) {
          usedBarcodes.add(candidate);
          break;
        }
      }
      studentNameToBarcode.set(norm, candidate);
      uniqueStudents.push({ name: s.name.trim(), barcode: candidate });
    }
  }
}

console.log(`Assigned unique permanent barcodes to ${studentNameToBarcode.size} unique students.`);

// Check specifically Abdallah Miloudi and Gheirissi Saif Eddine
const miloudiBarcode = studentNameToBarcode.get(normalizeName('عبد الله ميلودي'));
const gheirissiBarcode = studentNameToBarcode.get(normalizeName('غريسي سيف الدين'));
console.log('عبد الله ميلودي permanent barcode ->', miloudiBarcode);
console.log('غريسي سيف الدين permanent barcode ->', gheirissiBarcode);

// 2. Update all student records across all groups in groupData
let updatedStudentCount = 0;
for (const [gid, group] of Object.entries(data.groupData)) {
  for (const s of group.students || []) {
    const norm = normalizeName(s.name);
    if (norm && studentNameToBarcode.has(norm)) {
      s.barcode = studentNameToBarcode.get(norm);
      updatedStudentCount++;
    }
  }
}

console.log(`Updated barcode on all ${updatedStudentCount} student enrollments across all groups.`);

// 3. Save to initialData.json
fs.writeFileSync(initialDataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Saved updated initialData.json successfully.');

// 4. Sync to Supabase cloud
async function syncToSupabase() {
  const supabaseUrl = 'https://pogsnezjtcjiwpgpctqr.supabase.co';
  const supabaseKey = 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Syncing unified barcodes to Supabase...');
  const { error } = await supabase
    .from('center_data')
    .upsert({
      id: 'main',
      data: data,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Supabase sync error:', error);
  } else {
    console.log('Successfully synced unified unique barcodes to Supabase!');
  }
}

syncToSupabase();
