const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://pogsnezjtcjiwpgpctqr.supabase.co', 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq');

const newBac08Students = [
  { name: 'ابراهيم زقب', barcode: 'STU-27000025', sessionIdx: 2, amount: 2500, discount: '1', fee: 2500 },
  { name: 'بكوش عبد الرحمان', barcode: 'STU-27000108', sessionIdx: 2, amount: 1250, discount: '0.8', fee: 1250 },
  { name: 'زبيدي اسراء', barcode: 'STU-27000109', sessionIdx: 2, amount: 1250, discount: '0.8', fee: 1250 },
  { name: 'باللموشي رحمة', barcode: 'STU-27000110', sessionIdx: 2, amount: 1250, discount: '0.8', fee: 1250 },
  { name: 'حنين دريدي', barcode: 'STU-27743613', sessionIdx: 2, amount: 1250, discount: '0.8', fee: 1250 }
];

async function run() {
  const { data: remoteRow, error } = await sb.from('center_data').select('data').eq('id', 'main').single();
  if (error) { console.error('Error fetching:', error); return; }

  const cd = remoteRow.data;
  const bac08 = cd.groupData['BAC08'];
  if (!bac08) { console.error('BAC08 not found'); return; }

  let maxRow = bac08.students.reduce((max, s) => Math.max(max, s.rowId || 0), 0);

  const newTransactions = [];

  newBac08Students.forEach(st => {
    // Check if student already in BAC08
    const existing = bac08.students.find(s => s.name && s.name.trim() === st.name.trim());
    let targetStudent = existing;
    if (!existing) {
      maxRow++;
      const payments = ['', '', '', ''];
      payments[st.sessionIdx] = st.amount;
      const attendance = ['', '', '', ''];
      attendance[st.sessionIdx] = 'P';

      targetStudent = {
        rowId: maxRow,
        name: st.name,
        phone: '',
        barcode: st.barcode,
        attendance: attendance,
        discount: st.discount,
        fee: st.fee,
        payments: payments,
        totalReceived: st.amount,
        teacherPay: Math.round(st.fee * 0.6),
        schoolEarn: st.fee - Math.round(st.fee * 0.6),
        debt: Math.max(0, st.fee - st.amount),
        totalAttendance: 1
      };
      bac08.students.push(targetStudent);
      console.log(`Added ${st.name} to BAC08 with rowId ${maxRow}`);
    } else {
      while (existing.payments.length <= st.sessionIdx) existing.payments.push('');
      existing.payments[st.sessionIdx] = st.amount;
      existing.totalReceived = existing.payments.reduce((sum, p) => sum + (Number(p) || 0), 0);
      existing.debt = Math.max(0, (existing.fee || 2500) - existing.totalReceived);
      console.log(`Updated existing ${existing.name} in BAC08`);
    }

    const fakeTimestamp = new Date(2026, 8, 20, 9, 28, 26).getTime();
    newTransactions.push({
      id: `tx-BAC08-${targetStudent.rowId}-${st.sessionIdx}-${fakeTimestamp}`,
      timestamp: fakeTimestamp,
      dateStr: '2026/09/20',
      timeStr: '09:28:26 ص',
      hour: 9,
      minute: 28,
      groupId: 'BAC08',
      groupSubject: 'علوم',
      teacherName: bac08.teacherName || 'عبدالرؤوف بن عمارة',
      studentRowId: targetStudent.rowId,
      studentName: targetStudent.name,
      studentPhone: '',
      studentBarcode: targetStudent.barcode || '',
      sessionIndex: st.sessionIdx,
      amount: st.amount,
      totalFee: targetStudent.fee,
      totalReceived: targetStudent.totalReceived,
      remainingDebt: targetStudent.debt,
      paymentMethod: 'نقداً',
      source: 'live_desk'
    });
  });

  // Merge with existing transactions
  const existingTx = cd.paymentTransactions || [];
  const existingIds = new Set(existingTx.map(t => t.id));
  newTransactions.forEach(t => {
    if (!existingIds.has(t.id)) {
      existingTx.push(t);
      existingIds.add(t.id);
    }
  });

  cd.paymentTransactions = existingTx;
  cd._last_modified_at = Date.now();
  cd._saved_at = Date.now();

  const { error: saveErr } = await sb.from('center_data').upsert({
    id: 'main',
    data: cd,
    updated_at: new Date().toISOString()
  });

  if (saveErr) {
    console.error('Error saving:', saveErr);
  } else {
    console.log(`SUCCESS! BAC08 now has ${bac08.students.length} students.`);
    console.log(`Total transactions in center_data: ${cd.paymentTransactions.length}`);
    const totalToday = cd.paymentTransactions
      .filter(t => t.dateStr === '2026/09/20')
      .reduce((sum, t) => sum + t.amount, 0);
    console.log(`Total payments for today (2026/09/20): ${totalToday.toLocaleString()} DZD across 18 transactions.`);
  }
}

run();
