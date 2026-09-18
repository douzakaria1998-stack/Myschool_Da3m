const fs = require('fs');
const data = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));

function calcFinances(student, isVipGroup, cycleSessions = 4) {
  const basePrice = isVipGroup ? 10000 : 2500;
  const perSessionPrice = Math.round(basePrice / cycleSessions);

  // Sum up payments
  const totalReceived = (student.payments || []).reduce((sum, p) => {
    const val = typeof p === 'number' ? p : parseFloat(String(p));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Attendance counts
  const cycleAttendance = (student.attendance || []).slice(0, cycleSessions);
  const attendedCount = cycleAttendance.filter((a) => a === 'P').length;
  const makeupCount = cycleAttendance.filter((a) => a === 'M').length;
  const totalAttendance = attendedCount + makeupCount;

  // RULE: If student attended only one session and did not pay:
  // The session does NOT count for the school (fee = 0, schoolEarn = 0, debt = 0)
  // and does NOT count for the teacher (teacherPay = 0).
  const isOneSessionUnpaid = totalAttendance === 1 && totalReceived === 0;

  if (isOneSessionUnpaid) {
    return {
      fee: 0,
      totalReceived: 0,
      teacherPay: 0,
      schoolEarn: 0,
      debt: 0,
      countedSessions: 0
    };
  }

  // Active index
  let firstActiveIndex = -1;
  for (let i = 0; i < cycleAttendance.length; i++) {
    const st = cycleAttendance[i];
    if (st === 'P' || st === 'A' || st === 'M' || st === 'S') {
      firstActiveIndex = i;
      break;
    }
  }

  let countedSessions = 0;
  if (firstActiveIndex !== -1) {
    countedSessions = cycleSessions - firstActiveIndex;
  } else {
    countedSessions = isVipGroup ? cycleSessions : 0;
  }

  let fee = 0;
  if (student.discount === '0') {
    fee = 0;
  } else if (student.discount === '0.8') {
    fee = Math.round(countedSessions * perSessionPrice * 0.8);
  } else if (student.discount === 'تعويض') {
    const count = makeupCount > 0 ? makeupCount : (attendedCount > 0 ? attendedCount : 1);
    fee = count * perSessionPrice;
  } else {
    fee = countedSessions * perSessionPrice;
  }

  if (totalReceived > fee && student.discount !== '0') {
    fee = totalReceived;
  }

  const teacherRatio = isVipGroup ? 0.75 : 0.60;
  const teacherPay = student.discount === '0' ? 0 : Math.round(fee * teacherRatio);
  const schoolEarn = Math.max(0, fee - teacherPay);
  const debt = Math.max(0, fee - totalReceived);

  return {
    fee,
    totalReceived,
    teacherPay,
    schoolEarn,
    debt,
    countedSessions
  };
}

// Test against initialData
let oneSessionUnpaidMatch = 0;
let oneSessionUnpaidTotal = 0;

let oneSessionPaidMatch = 0;
let oneSessionPaidTotal = 0;

for (const [gid, g] of Object.entries(data.groupData)) {
  const isVip = gid.startsWith('BACV') || Boolean(g.isVip);
  for (const s of (g.students || [])) {
    if (s.name && s.name.includes('مجموع')) continue;
    const attCount = (s.attendance || []).filter(a => a === 'P' || a === 'M').length;
    const totalRec = (s.payments || []).reduce((a, b) => a + (Number(b) || 0), 0) || s.totalReceived || 0;

    if (attCount === 1 && totalRec === 0) {
      oneSessionUnpaidTotal++;
      const res = calcFinances(s, isVip, 4);
      if (res.fee === s.fee && res.teacherPay === s.teacherPay && res.debt === s.debt) {
        oneSessionUnpaidMatch++;
      } else {
        console.log('Unpaid mismatch:', s.name, { expected: { fee: s.fee, tea: s.teacherPay }, got: res });
      }
    }

    if (attCount === 1 && totalRec > 0) {
      oneSessionPaidTotal++;
      const res = calcFinances(s, isVip, 4);
      if (res.fee === s.fee && res.teacherPay === s.teacherPay && res.debt === s.debt) {
        oneSessionPaidMatch++;
      } else {
        console.log('Paid mismatch:', s.name, { expected: { fee: s.fee, tea: s.teacherPay, debt: s.debt }, got: res });
      }
    }
  }
}

console.log(`Unpaid 1-session match: ${oneSessionUnpaidMatch} / ${oneSessionUnpaidTotal}`);
console.log(`Paid 1-session match: ${oneSessionPaidMatch} / ${oneSessionPaidTotal}`);
