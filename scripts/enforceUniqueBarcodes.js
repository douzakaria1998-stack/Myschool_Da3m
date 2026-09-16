const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const data = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

function norm(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// 1. Gather all student names and barcode frequencies
const nameBarcodeFrequency = new Map();

for (const group of Object.values(data.groupData || {})) {
  for (const s of group.students || []) {
    const n = norm(s.name);
    let b = (s.barcode || '').trim().toUpperCase();
    if (!n || !b) continue;

    // Normalize STU-26 to STU-27
    if (b.startsWith('STU-26')) {
      b = 'STU-27' + b.slice(6);
    }

    if (!nameBarcodeFrequency.has(n)) nameBarcodeFrequency.set(n, new Map());
    const counts = nameBarcodeFrequency.get(n);
    counts.set(b, (counts.get(b) || 0) + 1);
  }
}

const nameToBarcode = new Map();
const barcodeToName = new Map();
const usedBarcodes = new Set();

// Explicit canonical assignments for the reported collision
nameToBarcode.set(norm('أنفال بن موسى'), 'STU-27000076');
nameToBarcode.set(norm('عبيد اشرف'), 'STU-27000044');

// Determine best barcode for each student
for (const [n, counts] of nameBarcodeFrequency.entries()) {
  if (nameToBarcode.has(n)) continue;
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const bestBarcode = sorted[0][0];
  nameToBarcode.set(n, bestBarcode);
}

// Find next available unique barcode
let serial = 1;
function getNextBarcode() {
  while (true) {
    const candidate = 'STU-27' + serial.toString().padStart(6, '0');
    serial++;
    if (!usedBarcodes.has(candidate)) {
      usedBarcodes.add(candidate);
      return candidate;
    }
  }
}

// First pass: register non-conflicting barcodes
for (const [n, b] of nameToBarcode.entries()) {
  if (!barcodeToName.has(b)) {
    barcodeToName.set(b, n);
    usedBarcodes.add(b);
  }
}

// Second pass: resolve any collisions with guaranteed new unique barcodes
for (const [n, b] of nameToBarcode.entries()) {
  if (barcodeToName.get(b) !== n) {
    const newB = getNextBarcode();
    console.log(`Resolving barcode collision for "${n}": assigned ${newB} (was colliding on ${b})`);
    nameToBarcode.set(n, newB);
    barcodeToName.set(newB, n);
    usedBarcodes.add(newB);
  }
}

console.log(`Mapped ${nameToBarcode.size} students to ${barcodeToName.size} strictly unique barcodes.`);

// 2. Apply the strictly unique barcode to every student enrollment across all groups
let updatedCount = 0;
for (const [gid, group] of Object.entries(data.groupData || {})) {
  for (const s of group.students || []) {
    const n = norm(s.name);
    if (n && nameToBarcode.has(n)) {
      const canonical = nameToBarcode.get(n);
      if (s.barcode !== canonical) {
        s.barcode = canonical;
        updatedCount++;
      }
    }
  }
}

console.log(`Updated ${updatedCount} enrollments in initialData.json.`);

// 3. Save initialData.json
fs.writeFileSync(initialDataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully saved initialData.json.');

// 4. Verify no duplicates exist anywhere
const verifyBarcodeToNames = new Map();
for (const group of Object.values(data.groupData || {})) {
  for (const s of group.students || []) {
    const n = norm(s.name);
    const b = (s.barcode || '').trim().toUpperCase();
    if (!b) continue;
    if (!verifyBarcodeToNames.has(b)) verifyBarcodeToNames.set(b, new Set());
    verifyBarcodeToNames.get(b).add(n);
  }
}

let remainingCollisions = 0;
for (const [b, names] of verifyBarcodeToNames.entries()) {
  if (names.size > 1) {
    remainingCollisions++;
    console.error(`COLLISION DETECTED: ${b} shared by:`, Array.from(names));
  }
}

if (remainingCollisions === 0) {
  console.log('VERIFICATION PASSED: Exactly 0 collisions in entire dataset! Every student has a strictly unique ID.');
} else {
  console.error(`VERIFICATION FAILED: ${remainingCollisions} collisions remain!`);
}

// 5. Sync to Supabase
async function syncToSupabase() {
  const supabaseUrl = 'https://pogsnezjtcjiwpgpctqr.supabase.co';
  const supabaseKey = 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Syncing unique barcodes to Supabase...');
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
    console.log('Successfully synced strictly unique barcodes to Supabase!');
  }
}

syncToSupabase();
