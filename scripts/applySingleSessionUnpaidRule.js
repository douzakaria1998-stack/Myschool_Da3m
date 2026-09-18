// Recalculates initialData.json students according to the new rule:
// If a student attended only ONE session and did NOT pay,
// the session does NOT count for the school and does NOT count for the teacher.

const fs = require('fs');
const path = require('path');

const initialDataPath = path.join(__dirname, '../src/data/initialData.json');
const data = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

let updatedStudentsCount = 0;

for (const [gid, sheet] of Object.entries(data.groupData || {})) {
  const isVipGroup = Boolean(gid.startsWith('BACV') || sheet.isVip || (sheet.type && sheet.type.includes('10000')));
  const teacherRatio = isVipGroup ? 0.75 : 0.60;

  for (const s of sheet.students || []) {
    const cycleAttendance = (s.attendance || []).slice(0, 4);
    const attendedCount = cycleAttendance.filter(a => a === 'P').length;
    const makeupCount = cycleAttendance.filter(a => a === 'M').length;
    const totalAttendance = attendedCount + makeupCount;

    const totalReceived = (s.payments || []).reduce((sum, p) => {
      const val = typeof p === 'number' ? p : parseFloat(String(p));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const isSingleUnpaidSession = totalAttendance === 1 && totalReceived <= 0;

    if (isSingleUnpaidSession) {
      if (s.fee !== 0 || s.teacherPay !== 0 || s.schoolEarn !== 0 || s.debt !== 0) {
        s.fee = 0;
        s.teacherPay = 0;
        s.schoolEarn = 0;
        s.debt = 0;
        updatedStudentsCount++;
      }
    }
  }
}

fs.writeFileSync(initialDataPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Successfully updated ${updatedStudentsCount} students in initialData.json!`);
