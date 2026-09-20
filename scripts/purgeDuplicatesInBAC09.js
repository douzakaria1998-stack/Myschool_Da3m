const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pogsnezjtcjiwpgpctqr.supabase.co';
const supabaseAnonKey = 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function normalize(str) {
  if (!str) return '';
  return str.trim()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function main() {
  const { data, error } = await supabase.from('center_data').select('data').eq('id', 'main').single();
  if (error || !data) {
    console.error('Failed to fetch center_data:', error);
    return;
  }

  const centerData = data.data;
  const bac09 = centerData.groupData['BAC09'];
  if (!bac09) {
    console.error('BAC09 not found');
    return;
  }

  console.log(`BAC09 current total students: ${bac09.students.length}`);

  const duplicateNames = [
    'رتاج طليبة',
    'ليسيود ناريمان',
    'عماد الدين فرحات',
    'منتظر نوري'
  ];

  const duplicateRowIds = [82, 84, 87, 89];

  const studentsToKeep = [];
  const removedStudents = [];

  bac09.students.forEach((s) => {
    if (!s) return;
    const isDup = duplicateRowIds.includes(s.rowId) || duplicateNames.some(dn => normalize(dn) === normalize(s.name));
    if (isDup) {
      removedStudents.push(s);
    } else {
      studentsToKeep.push(s);
    }
  });

  console.log(`Identified ${removedStudents.length} duplicate students to remove:`);
  removedStudents.forEach(s => {
    console.log(`  RowId ${s.rowId} "${s.name}" (Att: ${JSON.stringify(s.attendance)}, Pay: ${JSON.stringify(s.payments)})`);
  });

  if (removedStudents.length === 0) {
    console.log('No duplicates found to remove.');
    return;
  }

  // Create tombstones in deletedStudents
  const now = Date.now();
  const dateStr = new Date().toLocaleString('ar-DZ');
  const tombstones = removedStudents.map(s => ({
    id: `del-dedup-${now}-${s.rowId}`,
    deletedAt: now,
    deletedAtStr: dateStr,
    groupId: 'BAC09',
    groupSubject: bac09.subject,
    teacherName: bac09.teacherName,
    student: { ...s },
    reason: 'حذف مكرر تلقائي مع سحب المدفوعات'
  }));

  const existingDeleted = centerData.deletedStudents || [];
  centerData.deletedStudents = [...tombstones, ...existingDeleted];

  // Purge any payment transactions
  const removedNamesNorm = new Set(removedStudents.map(s => normalize(s.name)));
  const removedBarcodes = new Set(removedStudents.map(s => (s.barcode || '').trim()).filter(Boolean));
  const removedRowIds = new Set(removedStudents.map(s => s.rowId));

  const origTxCount = (centerData.paymentTransactions || []).length;
  centerData.paymentTransactions = (centerData.paymentTransactions || []).filter(tx => {
    if (tx.groupId !== 'BAC09') return true;
    if (tx.studentRowId && removedRowIds.has(tx.studentRowId)) return false;
    if (tx.studentBarcode && removedBarcodes.has(tx.studentBarcode.trim())) return false;
    if (tx.studentName && removedNamesNorm.has(normalize(tx.studentName))) return false;
    return true;
  });

  console.log(`Purged transactions: ${origTxCount - centerData.paymentTransactions.length}`);

  // Update BAC09 students
  bac09.students = studentsToKeep;
  console.log(`BAC09 new total students: ${bac09.students.length}`);

  centerData._last_modified_at = now;
  centerData._saved_at = now;

  const { error: saveErr } = await supabase
    .from('center_data')
    .upsert({
      id: 'main',
      data: centerData,
      updated_at: new Date().toISOString()
    });

  if (saveErr) {
    console.error('Failed to save to Supabase:', saveErr);
  } else {
    console.log('Successfully updated Supabase center_data with deduplicated students and purged payments!');
  }
}

main();
