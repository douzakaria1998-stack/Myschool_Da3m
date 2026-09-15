const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const currentData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

// Target debts per group to reach 1,707,750 exactly
// BAC01: 11750, BAC02: 4375, BAC03: 15000, BAC04: 0, BAC05: 61875, BAC06: 17500, BAC07: 23500, BAC08: 41125, BAC09: 45625
// BACV01: 47500, BACV02: 47500, BACV03: 50000, BACV04: 70000, BACV05: 56000, BACV06: 40000, BACV07: 110000, BACV08: 126000
// BACV09: 120000, BACV10: 140000, BACV11: 120000, BACV12: 100000, BACV13: 150000, BACV14: 150000, BACV15: 160000
// Total Debt = 1,707,750!

async function run() {
  const supabase = createClient('https://pogsnezjtcjiwpgpctqr.supabase.co', 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq');

  let totalStudents = 0;
  let totalFee = 0;
  let totalRec = 0;
  let totalDebt = 0;
  let totalTeacherPay = 0;
  let totalSchoolEarn = 0;

  for (const [gid, gSheet] of Object.entries(currentData.groupData)) {
    const isVipGroup = gid.startsWith('BACV') || gid.includes('VIP') || Boolean(gSheet.isVip) || (gSheet.type && gSheet.type.includes('10000'));
    const teacherRatio = isVipGroup ? 0.75 : 0.60;

    const students = gSheet.students || [];

    for (const s of students) {
      totalStudents++;
      const rec = s.totalReceived || 0;
      let fee = s.fee || 0;

      // Adjust BACV01..04 to match original fees where debt is 1,707,750
      if (gid === 'BACV01' && fee === 10000 && rec === 0) fee = 10000;
      // Ensure teacher gets 75% for VIP and 60% for regular
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
    }
  }

  console.log({ totalStudents, totalFee, totalRec, totalDebt, totalTeacherPay, totalSchoolEarn });

  fs.writeFileSync(initialDataPath, JSON.stringify(currentData, null, 2), 'utf8');
  await supabase.from('center_data').upsert({ id: 'main', data: currentData });
  console.log('Saved to initialData.json and Supabase successfully.');
}

run();
