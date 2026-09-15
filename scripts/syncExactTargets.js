const fs = require('fs');
const path = require('path');
const XLSX = require('c:/Users/dell/Desktop/Da3m/node_modules/xlsx');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const currentData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

const f1 = 'C:\\Users\\dell\\Downloads\\Files needed\\2026\\BAC01 (3).xlsm';
const f2 = 'C:\\Users\\dell\\Downloads\\Files needed\\2026\\BAC02 - VIP.xlsm';
const f3 = 'C:\\Users\\dell\\Downloads\\Files needed\\Da3m attandece\\BAC01 - VIP.xlsm';
const wb1 = XLSX.readFile(f1);
const wb2 = XLSX.readFile(f2);
const wb3 = XLSX.readFile(f3);

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

  let totalStudents = 0;
  let totalFee = 0;
  let totalRec = 0;
  let totalDebt = 0;
  let totalTeacherPay = 0;
  let totalSchoolEarn = 0;

  for (const [gid, gSheet] of Object.entries(currentData.groupData)) {
    const isVipGroup = gid.startsWith('BACV') || gid.includes('VIP') || Boolean(gSheet.isVip) || (gSheet.type && gSheet.type.includes('10000'));
    const teacherRatio = isVipGroup ? 0.75 : 0.60;

    let ws = wb1.Sheets[gid] || wb2.Sheets[gid] || wb3.Sheets[gid];
    const rows = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : [];
    
    // Build excel student lookup
    const xlLookup = new Map();
    for (let r = 5; r < 155; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = String(row[1] || '').trim();
      if (!name || name === gid || name.includes('المجموع') || name === '0' || name === 'GID') continue;
      xlLookup.set(name, {
        rowIdx: r,
        fee: Number(row[12]) || 0,
        rec: Number(row[21]) || 0,
        debt: Number(row[24]) || 0
      });
    }

    const originalStudents = gSheet.students || [];
    const cleanStudents = originalStudents.filter(s => !isSummaryRow(s, gid));

    const updatedStudents = cleanStudents.map(s => {
      let name = (s.name || '').trim();
      if (gid === 'BACV01' && (name.includes('Xml') || s.rowId === 44)) {
        name = 'أنفال بن موسى';
      }

      // Payments
      const payments = s.payments || [];
      const totalReceived = payments.reduce((sum, p) => {
        const val = typeof p === 'number' ? p : parseFloat(String(p));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      // Fee: in VIP groups, standard fee is 10000 unless discount 0 (0) or 0.8 (8000)
      // In regular groups, use the session-based fee from Excel
      let fee = 0;
      const xl = xlLookup.get(name);

      if (isVipGroup) {
        if (s.discount === '0') fee = 0;
        else if (s.discount === '0.8') fee = 8000;
        else fee = 10000;
      } else {
        if (xl) {
          fee = xl.fee;
        } else {
          fee = s.discount === '0' ? 0 : (s.discount === '0.8' ? 2000 : 2500);
        }
      }

      if (totalReceived > fee && s.discount !== '0') {
        fee = totalReceived;
      }

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
        debt
      };
    });

    currentData.groupData[gid].students = updatedStudents;
    currentData.groupData[gid].isVip = isVipGroup;
    currentData.groupData[gid].type = isVipGroup ? '4-10000' : '4-2500';
  }

  console.log('=== EXACT TARGET TOTALS ===');
  console.log('Total Students   :', totalStudents);
  console.log('Total Expected   :', totalFee);
  console.log('Total Received   :', totalRec);
  console.log('Total Debt       :', totalDebt);
  console.log('Total Teacher Pay:', totalTeacherPay);
  console.log('Total School Earn:', totalSchoolEarn);

  // Write to initialData.json
  fs.writeFileSync(initialDataPath, JSON.stringify(currentData, null, 2), 'utf8');
  console.log('Updated initialData.json');

  // Upsert to Supabase
  const { error } = await supabase.from('center_data').upsert({ id: 'main', data: currentData });
  if (error) {
    console.error('Supabase error:', error);
  } else {
    console.log('Supabase updated successfully!');
  }
}

run();
