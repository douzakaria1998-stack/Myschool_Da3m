const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const rawData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

function isSummaryRow(student, groupId) {
  if (!student) return false;
  const name = (student.name || '').trim();
  const phone = (student.phone || '').trim();
  if (name === 'GID' || phone === 'TID') return true;
  if (groupId && name.toUpperCase() === groupId.toUpperCase()) return true;
  if (name.includes('مجموع') || name.includes('GID')) return true;
  if (Array.isArray(student.attendance) && student.attendance.some((a) => typeof a === 'string' && a.includes('مجموع'))) {
    return true;
  }
  return false;
}

async function run() {
  const supabase = createClient('https://pogsnezjtcjiwpgpctqr.supabase.co', 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq');
  const { data: remoteData, error } = await supabase.from('center_data').select('data').eq('id', 'main').single();
  
  const source = remoteData?.data || rawData;

  let totalStudents = 0;
  let totalFee = 0;
  let totalRec = 0;
  let totalDebt = 0;
  let totalTeacherPay = 0;
  let totalSchoolEarn = 0;

  for (const [gid, gSheet] of Object.entries(source.groupData)) {
    const isVipGroup = gid.startsWith('BACV') || gid.includes('VIP') || Boolean(gSheet.isVip) || (gSheet.type && gSheet.type.includes('10000'));
    const teacherRatio = isVipGroup ? 0.75 : 0.60;
    const basePrice = isVipGroup ? 10000 : 2500;
    const perSessionPrice = Math.round(basePrice / 4);

    const originalStudents = gSheet.students || [];
    const cleanStudents = originalStudents.filter(s => !isSummaryRow(s, gid));

    const updatedStudents = cleanStudents.map(s => {
      // Fix XML element typo if present
      let name = s.name;
      if (gid === 'BACV01' && (name.includes('Xml') || s.rowId === 44)) {
        name = 'أنفال بن موسى';
      }

      // Calculate payments
      const payments = s.payments || [];
      const totalReceived = payments.reduce((sum, p) => {
        const val = typeof p === 'number' ? p : parseFloat(String(p));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Count attendance
      const attendance = s.attendance || ['', '', '', ''];
      const attendedCount = attendance.filter(a => a === 'P').length;
      const makeupCount = attendance.filter(a => a === 'M').length;
      const totalAttendance = attendedCount + makeupCount;

      // Determine counted sessions
      let lastActiveIdx = -1;
      attendance.forEach((a, idx) => {
        if (a === 'P' || a === 'M' || a === 'A') lastActiveIdx = Math.max(lastActiveIdx, idx);
      });
      payments.forEach((p, idx) => {
        if (Number(p) > 0) lastActiveIdx = Math.max(lastActiveIdx, idx);
      });
      const countedSessions = lastActiveIdx === -1 ? 4 : Math.max(lastActiveIdx + 1, 4);

      // Calculate fee
      let fee = 0;
      if (s.discount === '0') {
        fee = 0;
      } else if (s.discount === '0.8') {
        fee = Math.round(countedSessions * perSessionPrice * 0.8);
      } else if (s.discount === 'تعويض') {
        const count = makeupCount > 0 ? makeupCount : (attendedCount > 0 ? attendedCount : 1);
        fee = count * perSessionPrice;
      } else {
        fee = countedSessions * perSessionPrice;
      }

      if (totalReceived > fee && s.discount !== '0') {
        fee = totalReceived;
      }

      // Teacher Pay: 75% for VIP, 60% for Normal regardless of student payment status
      const teacherPay = s.discount === '0' ? 0 : Math.round(fee * teacherRatio);
      const schoolEarn = Math.max(0, fee - teacherPay);
      const debt = Math.max(0, fee - totalReceived);

      totalStudents++;
      totalFee += fee;
      totalRec += totalReceived;
      totalDebt += debt;
      totalTeacherPay += teacherPay;
      totalSchoolEarn += schoolEarn;

      return {
        ...s,
        name,
        fee,
        totalReceived,
        teacherPay,
        schoolEarn,
        debt,
        totalAttendance
      };
    });

    source.groupData[gid].students = updatedStudents;
    source.groupData[gid].isVip = isVipGroup;
    source.groupData[gid].type = isVipGroup ? '4-10000' : '4-2500';
  }

  console.log('=== VERIFICATION OF UPDATED TOTALS ===');
  console.log('Total Students   :', totalStudents);
  console.log('Total Expected   :', totalFee);
  console.log('Total Received   :', totalRec);
  console.log('Total Debt       :', totalDebt);
  console.log('Total Teacher Pay:', totalTeacherPay);
  console.log('Total School Earn:', totalSchoolEarn);
  console.log('Mathematical Check (Teacher + School === Expected):', totalTeacherPay + totalSchoolEarn === totalFee);
  console.log('Mathematical Check (Rec + Debt === Expected):', totalRec + totalDebt === totalFee);

  // Write to initialData.json
  fs.writeFileSync(initialDataPath, JSON.stringify(source, null, 2), 'utf8');
  console.log('Updated src/data/initialData.json successfully.');

  // Push to Supabase
  const { error: upsertErr } = await supabase.from('center_data').upsert({ id: 'main', data: source });
  if (upsertErr) {
    console.error('Failed to update Supabase:', upsertErr);
  } else {
    console.log('Successfully updated Supabase center_data (id: main).');
  }
}

run();
