const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const currentData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

// The exact fees per group from the original imported data:
// In regular groups: sum of fees = 1,793,750 (with BAC09 = 184,375)
// In VIP groups:
// BACV01: 592500, BACV02: 310000, BACV03: 450000, BACV04: 84000
// BACV05: 170000, BACV06: 140000, BACV07: 150000, BACV08: 160000, BACV09: 160000, BACV10: 160000, BACV11: 160000, BACV12: 160000
// BACV13: 150000, BACV14: 150000, BACV15: 160000
// Total Fee = 4,955,250
// Total Rec = 3,307,750
// Total Debt = 1,707,750

async function syncExactNumbers() {
  const supabase = createClient('https://pogsnezjtcjiwpgpctqr.supabase.co', 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq');

  // Specific per-group fee targets
  const vipFeeMap = {
    'BACV01': 592500,
    'BACV02': 310000,
    'BACV03': 450000,
    'BACV04': 84000,
    'BACV05': 170000,
    'BACV06': 140000,
    'BACV07': 150000,
    'BACV08': 160000,
    'BACV09': 160000,
    'BACV10': 160000,
    'BACV11': 160000,
    'BACV12': 160000,
    'BACV13': 150000,
    'BACV14': 150000,
    'BACV15': 160000
  };

  let totalStudents = 0, totalFee = 0, totalRec = 0, totalDebt = 0, totalTeacherPay = 0, totalSchoolEarn = 0;

  for (const [gid, gSheet] of Object.entries(currentData.groupData)) {
    const isVipGroup = gid.startsWith('BACV') || gid.includes('VIP') || Boolean(gSheet.isVip) || (gSheet.type && gSheet.type.includes('10000'));
    const teacherRatio = isVipGroup ? 0.75 : 0.60;

    const students = gSheet.students || [];

    // For VIP groups 01..04, ensure each student fee matches the 4955250 / 1707750 baseline
    if (gid === 'BACV01') {
      // 63 students: 55 students with 10000 (of which some partial), 2 with 7500, etc.
      // Simply calculate fee and ensure totalReceived and debt match:
    }

    students.forEach(s => {
      totalStudents++;
      const rec = s.totalReceived || 0;
      let fee = s.fee || 0;
      if (rec > fee && s.discount !== '0') fee = rec;

      const teacherPay = s.discount === '0' ? 0 : Math.round(fee * teacherRatio);
      const schoolEarn = fee - teacherPay;
      const debt = Math.max(0, fee - rec);

      s.teacherPay = teacherPay;
      s.schoolEarn = schoolEarn;
      s.debt = debt;

      totalFee += fee;
      totalRec += rec;
      totalDebt += debt;
      totalTeacherPay += teacherPay;
      totalSchoolEarn += schoolEarn;
    });
  }

  console.log('=== EXACT CURRENT COMPUTATION ===');
  console.log({ totalStudents, totalFee, totalRec, totalDebt, totalTeacherPay, totalSchoolEarn });

  fs.writeFileSync(initialDataPath, JSON.stringify(currentData, null, 2), 'utf8');
  await supabase.from('center_data').upsert({ id: 'main', data: currentData });
}

syncExactNumbers();
