const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://pogsnezjtcjiwpgpctqr.supabase.co', 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq');

// The 18 unique deduplicated transactions from the user's list
const uniqueTransactions = [
  { timeStr: '08:20:18', hour: 8, minute: 20, name: 'ولاء بقاص', groupId: 'BACV12', subject: 'فيزياء', sessionIdx: 0, amount: 10000 },
  { timeStr: '08:21:34', hour: 8, minute: 21, name: 'هميسي نور اليقين', groupId: 'BACV07', subject: 'رياضيات', sessionIdx: 1, amount: 10000 },
  { timeStr: '08:32:25', hour: 8, minute: 32, name: 'فروي روفيدة', groupId: 'BACV06', subject: 'فيزياء', sessionIdx: 1, amount: 10000 },
  { timeStr: '08:35:10', hour: 8, minute: 35, name: 'فروي روفيدة', groupId: 'BACV02', subject: 'علوم', sessionIdx: 0, amount: 10000 },
  { timeStr: '08:35:56', hour: 8, minute: 35, name: 'فروي روفيدة', groupId: 'BACV11', subject: 'علوم', sessionIdx: 0, amount: 10000 },
  { timeStr: '08:40:18', hour: 8, minute: 40, name: 'علالي طه', groupId: 'BACV06', subject: 'فيزياء', sessionIdx: 0, amount: 10000 },
  { timeStr: '08:53:06', hour: 8, minute: 53, name: 'تركي احمد', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '08:53:41', hour: 8, minute: 53, name: 'يوسف قوري', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '08:55:38', hour: 8, minute: 55, name: 'عدوكة اكرام', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '09:23:04', hour: 9, minute: 23, name: 'عدوكة اكرام', groupId: 'BAC08', subject: 'علوم', sessionIdx: 0, amount: 2500 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'نصير مريم', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'قابوسة ايمان', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'فرج مريم البتول', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'ابراهيم زقب', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 2500 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'بكوش عبد الرحمان', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'زبيدي اسراء', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'باللموشي رحمة', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 },
  { timeStr: '09:28:26', hour: 9, minute: 28, name: 'حنين دريدي', groupId: 'BAC08', subject: 'علوم', sessionIdx: 2, amount: 1250 }
];

async function apply() {
  const { data: remoteRow, error: fetchErr } = await sb.from('center_data').select('data').eq('id', 'main').single();
  if (fetchErr) { console.error('Fetch error:', fetchErr); return; }

  const centerData = remoteRow.data;
  const groupData = centerData.groupData;

  console.log('--- Matching students in DB ---');
  const paymentTransactionItems = [];

  for (const t of uniqueTransactions) {
    const sheet = groupData[t.groupId];
    if (!sheet) {
      console.log('Group not found:', t.groupId);
      continue;
    }

    const student = (sheet.students || []).find(s => s.name && (s.name.includes(t.name) || t.name.includes(s.name)));
    if (!student) {
      console.log('Student not found in group:', t.name, t.groupId);
      continue;
    }

    // Ensure session payment is recorded in student's record
    while (student.payments.length <= t.sessionIdx) student.payments.push('');
    student.payments[t.sessionIdx] = t.amount;

    // Recalculate total received and debt
    student.totalReceived = student.payments.reduce((sum, p) => sum + (Number(p) || 0), 0);
    student.debt = Math.max(0, (student.fee || 0) - student.totalReceived);

    console.log(`Matched: ${student.name} in ${t.groupId} (rowId ${student.rowId}), pay[${t.sessionIdx}] = ${t.amount}`);

    const [y, m, d] = [2026, 9, 20];
    const itemDateStr = '2026/09/20';
    const fakeTimestamp = new Date(2026, 8, 20, t.hour, t.minute, 0).getTime();

    paymentTransactionItems.push({
      id: `tx-${t.groupId}-${student.rowId}-${t.sessionIdx}-${fakeTimestamp}`,
      timestamp: fakeTimestamp,
      dateStr: itemDateStr,
      timeStr: t.timeStr,
      hour: t.hour,
      minute: t.minute,
      groupId: t.groupId,
      groupSubject: t.subject,
      teacherName: sheet.teacherName || '',
      studentRowId: student.rowId,
      studentName: student.name,
      studentPhone: student.phone || '',
      studentBarcode: student.barcode || '',
      sessionIndex: t.sessionIdx,
      amount: t.amount,
      totalFee: student.fee || 0,
      totalReceived: student.totalReceived || t.amount,
      remainingDebt: student.debt || 0,
      paymentMethod: 'نقداً',
      source: 'live_desk'
    });
  }

  // Attach paymentTransactions array to centerData
  centerData.paymentTransactions = paymentTransactionItems;
  centerData._last_modified_at = Date.now();
  centerData._saved_at = Date.now();

  console.log(`\nSaving ${paymentTransactionItems.length} transactions and updated student payments to Supabase...`);
  const { error: saveErr } = await sb.from('center_data').upsert({
    id: 'main',
    data: centerData,
    updated_at: new Date().toISOString()
  });

  if (saveErr) {
    console.error('Save error:', saveErr);
  } else {
    console.log('SUCCESS! All 18 transactions saved to center_data in Supabase.');
    const totalDzd = paymentTransactionItems.reduce((s, x) => s + x.amount, 0);
    console.log(`Total amount: ${totalDzd.toLocaleString()} DZD across ${paymentTransactionItems.length} operations.`);
  }
}

apply();
