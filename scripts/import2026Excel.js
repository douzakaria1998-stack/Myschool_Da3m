const fs = require('fs');
const path = require('path');
const XLSX = require('c:/Users/dell/Desktop/Da3m/node_modules/xlsx');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const currentData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

const fileRegular = 'C:\\Users\\dell\\Downloads\\Files needed\\2026\\BAC01 (3).xlsm';
const fileVip = 'C:\\Users\\dell\\Downloads\\Files needed\\2026\\BAC02 - VIP.xlsm';

const wbReg = XLSX.readFile(fileRegular);
const wbVip = XLSX.readFile(fileVip);

// Collect existing barcodes by student name
const existingBarcodesByName = new Map();
const existingBarcodes = new Set();

for (const group of Object.values(currentData.groupData || {})) {
  for (const s of group.students || []) {
    if (s.barcode) {
      existingBarcodes.add(s.barcode.trim().toUpperCase());
      if (s.name && !existingBarcodesByName.has(s.name.trim().toLowerCase())) {
        existingBarcodesByName.set(s.name.trim().toLowerCase(), s.barcode.trim());
      }
    }
  }
}

// Helper to normalize and cascade dates
function parseAndNormalizeDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}/${m}/${day}`;
    }
  }
  const str = String(val).trim();
  // Match DD/MM/YYYY or DD/MM/YYYYY (typos like 29/08/20262)
  const m1 = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](202\d)\d*/);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const month = m1[2].padStart(2, '0');
    const year = m1[3];
    return `${year}/${month}/${day}`;
  }
  // Match YYYY/MM/DD
  const m2 = str.match(/^(202\d)[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (m2) {
    const year = m2[1];
    const month = m2[2].padStart(2, '0');
    const day = m2[3].padStart(2, '0');
    return `${year}/${month}/${day}`;
  }
  return null;
}

function cascadeWeeklyDates(baseDateStr, count = 4) {
  const dates = [];
  const parts = baseDateStr.split('/').map(Number);
  const cur = new Date(parts[0], parts[1] - 1, parts[2]);

  for (let i = 0; i < count; i++) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}/${m}/${d}`);
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

// Helper to calculate student finances
function calcStudentFinances(student, tierType = '4-2500') {
  const is10k = tierType.includes('10000');
  const basePrice = is10k ? 10000 : 2500;
  const baseTeacherRate = is10k ? 7500 : 1500;
  const perSessionPrice = basePrice / 4;
  const perSessionTeacherRate = baseTeacherRate / 4;

  const attendedCount = student.attendance.filter(a => a === 'P').length;
  const makeupCount = student.attendance.filter(a => a === 'M').length;
  const totalAttendance = attendedCount + makeupCount;

  // Counted sessions: if student has attendance or payment, counted = max index + 1 or attendedCount
  let lastAttendedIdx = -1;
  student.attendance.forEach((a, idx) => {
    if (a === 'P' || a === 'M' || a === 'A') lastAttendedIdx = Math.max(lastAttendedIdx, idx);
  });
  student.payments.forEach((p, idx) => {
    if (Number(p) > 0) lastAttendedIdx = Math.max(lastAttendedIdx, idx);
  });

  const countedSessions = lastAttendedIdx === -1 ? 0 : Math.max(lastAttendedIdx + 1, totalAttendance);

  let fee = 0;
  let teacherPay = attendedCount * perSessionTeacherRate;
  let schoolEarn = 0;

  if (student.discount === '0') {
    fee = 0;
    teacherPay = 0;
    schoolEarn = 0;
  } else if (student.discount === '0.8') {
    fee = Math.round(countedSessions * perSessionPrice * 0.8);
    schoolEarn = Math.max(0, fee - teacherPay);
  } else if (student.discount === 'تعويض') {
    fee = Math.round(makeupCount * perSessionPrice);
    teacherPay = makeupCount * perSessionTeacherRate;
    schoolEarn = Math.max(0, fee - teacherPay);
  } else {
    fee = Math.round(countedSessions * perSessionPrice);
    schoolEarn = Math.max(0, fee - teacherPay);
  }

  const totalReceived = student.payments.reduce((sum, p) => sum + (Number(p) || 0), 0);
  const debt = fee - totalReceived;

  return {
    fee,
    totalReceived,
    teacherPay,
    schoolEarn,
    debt,
    totalAttendance
  };
}

// Teacher ID mapping
const teacherIdMap = {
  'البشير بن عمارة': 'D01',
  'الطيب باي': 'D02',
  'وسيم زغود': 'D03',
  'عبدالرؤوف بن عمارة': 'D04',
  'نبيل الأطرش': 'D05',
  'فوزي خلادي': 'D06',
  'كمال مصباحي': 'D07',
  'حمزة علالي': 'D08',
  'أحمد تواتي': 'D09',
  'شوكال عبد الحليم': 'D10',
  'عفاف حنكة': 'D11',
  'عبد المالك مرغني': 'D12',
  'مراد فرج': 'D13',
  'رؤوف بوكوشة': 'D14'
};

const newGroupData = {};
const newGroupsMeta = [];

// Keep previous VIP groups BACV01..BACV04 if not present in new VIP file
for (const gid of ['BACV01', 'BACV02', 'BACV03', 'BACV04']) {
  if (currentData.groupData[gid] && currentData.groupData[gid].students.length > 0) {
    newGroupData[gid] = currentData.groupData[gid];
    const meta = (currentData.groups || []).find(g => g.id === gid);
    if (meta) newGroupsMeta.push(meta);
  }
}

// Function to process a workbook and sheet
function processGroupSheet(wb, sheetName, isVip = false) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rows.length < 5) return null;

  const headerRow1 = rows[1] || [];
  const teacherName = (headerRow1[1] || '').trim();
  const subject = (headerRow1[3] || '').trim();
  let day1 = (headerRow1[5] || '').trim();
  let time1 = headerRow1[6] !== undefined ? String(headerRow1[6]).trim() : '';

  if (day1 === 'VIP' || !day1) {
    day1 = isVip ? 'VIP' : 'السبت';
  }

  // Row 4: Dates & Column Headers
  const colRow4 = rows[4] || [];
  const rawDates = [colRow4[3], colRow4[4], colRow4[5], colRow4[6]];
  const parsedDates = rawDates.map(parseAndNormalizeDate);

  let sessionDates = [];
  const firstValidDate = parsedDates.find(Boolean);
  if (firstValidDate) {
    sessionDates = cascadeWeeklyDates(firstValidDate, 4);
    // If subsequent dates were explicitly valid, use them
    for (let i = 0; i < 4; i++) {
      if (parsedDates[i]) sessionDates[i] = parsedDates[i];
    }
  } else {
    sessionDates = cascadeWeeklyDates('2026/08/22', 4);
  }

  // Parse Students
  const students = [];
  const tierType = isVip ? '4-10000' : '4-2500';

  for (let r = 5; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const name = row[1];
    if (!name || typeof name !== 'string' || !name.trim()) continue;
    const cleanName = name.trim();
    if (cleanName.includes('المجموع') || cleanName.includes('الأستاذ') || cleanName.includes('المدرسة')) continue;

    const rowId = Number(row[0]) || (students.length + 1);
    const phone = row[2] ? String(row[2]).trim() : '';

    // Attendance cols 3, 4, 5, 6
    const attendance = [3, 4, 5, 6].map(cIdx => {
      const val = row[cIdx] ? String(row[cIdx]).trim().toUpperCase() : '';
      if (val === 'P' || val === 'ح') return 'P';
      if (val === 'A' || val === 'غ') return 'A';
      if (val === 'M' || val === 'ت') return 'M';
      return '';
    });

    // Discount col 11
    let discount = '1';
    if (row[11] !== undefined && row[11] !== null && String(row[11]).trim() !== '') {
      discount = String(row[11]).trim();
    }

    // Payments cols 13, 14, 15, 16
    const payments = [13, 14, 15, 16].map(cIdx => {
      const val = row[cIdx];
      if (val === undefined || val === null || val === '') return '';
      const num = Number(val);
      return isNaN(num) || num <= 0 ? '' : num;
    });

    // Barcode: check if student has existing barcode
    let barcode = existingBarcodesByName.get(cleanName.toLowerCase());
    if (!barcode) {
      barcode = `${sheetName}-${rowId.toString().padStart(3, '0')}`;
    }

    const studentBase = {
      rowId,
      name: cleanName,
      phone,
      barcode,
      discount,
      attendance,
      payments
    };

    const finances = calcStudentFinances(studentBase, tierType);

    students.push({
      ...studentBase,
      ...finances
    });
  }

  const groupSheet = {
    groupId: sheetName,
    teacherName,
    subject,
    day1,
    time1,
    sessionDates,
    sessionCount: 4,
    isVip,
    type: tierType,
    students
  };

  const teacherId = teacherIdMap[teacherName] || '';

  const groupMeta = {
    id: sheetName,
    teacherId,
    teacherName,
    subject,
    day1,
    time1,
    type: tierType,
    isVip,
    sessionCount: 4
  };

  return { groupSheet, groupMeta };
}

// 1. Process regular groups BAC01 - BAC09 from BAC01 (3).xlsm
for (let i = 1; i <= 9; i++) {
  const gid = `BAC${i.toString().padStart(2, '0')}`;
  if (wbReg.Sheets[gid]) {
    const res = processGroupSheet(wbReg, gid, false);
    if (res) {
      newGroupData[gid] = res.groupSheet;
      newGroupsMeta.push(res.groupMeta);
      console.log(`Imported ${gid}: ${res.groupSheet.students.length} students (${res.groupSheet.teacherName} - ${res.groupSheet.subject})`);
    }
  }
}

// 2. Process VIP groups BACV05 - BACV15 from BAC02 - VIP.xlsm
for (let i = 5; i <= 15; i++) {
  const gid = `BACV${i.toString().padStart(2, '0')}`;
  if (wbVip.Sheets[gid]) {
    const res = processGroupSheet(wbVip, gid, true);
    if (res) {
      newGroupData[gid] = res.groupSheet;
      newGroupsMeta.push(res.groupMeta);
      console.log(`Imported ${gid}: ${res.groupSheet.students.length} students (${res.groupSheet.teacherName} - ${res.groupSheet.subject})`);
    }
  }
}

// Sort groups meta by ID
newGroupsMeta.sort((a, b) => a.id.localeCompare(b.id));

// Build final CenterData
const updatedCenterData = {
  ...currentData,
  academicYear: '2026/2027',
  cycle: 'الدورة الأولى - بكالوريا 2026',
  groups: newGroupsMeta,
  groupData: newGroupData
};

// Write to initialData.json
fs.writeFileSync(initialDataPath, JSON.stringify(updatedCenterData, null, 2), 'utf8');
console.log(`\nSuccessfully written to ${initialDataPath}`);
console.log(`Total Groups: ${newGroupsMeta.length}`);
let totalStudents = 0;
for (const g of Object.values(newGroupData)) {
  totalStudents += g.students.length;
}
console.log(`Total Student Records: ${totalStudents}`);

// Sync to Supabase
async function syncToSupabase() {
  const supabaseUrl = 'https://pogsnezjtcjiwpgpctqr.supabase.co';
  const supabaseKey = 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\nSyncing to Supabase (center_data -> main)...');
  const { error } = await supabase
    .from('center_data')
    .upsert({
      id: 'main',
      data: updatedCenterData,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Supabase sync error:', error);
  } else {
    console.log('Successfully synced 2026 data to Supabase!');
  }
}

syncToSupabase();
