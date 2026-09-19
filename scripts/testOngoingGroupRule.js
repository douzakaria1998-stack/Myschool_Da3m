// Test ongoing group vs completed group session counting rules
const {
  isGroupEnded,
  getStudentSessionInfo
} = require('../src/utils/sessionUtils');
const {
  calcStudentFinancesPure
} = require('../src/context/AppContext');

const pricingTiers = [
  { id: '4-2500', name: '4-2500', sessions: 4, price: 2500, teacherRate: 1500, schoolRate: 1000 },
  { id: '4-10000', name: '4-10000', sessions: 4, price: 10000, teacherRate: 7500, schoolRate: 2500 }
];

// Test 1: BAC10 on Session 1 (today)
const bac10GroupOngoing = {
  groupId: 'BAC10',
  type: '4-2500',
  sessionCount: 4,
  sessionDates: ['2026/09/19', '2026/09/26', '2026/10/03', '2026/10/10'],
  students: [
    {
      rowId: 1,
      name: 'ضحى نغموش علي',
      attendance: ['P', '', '', ''],
      payments: [],
      discount: '1'
    },
    {
      rowId: 2,
      name: 'حنين ناقص',
      attendance: ['P', '', '', ''],
      payments: [],
      discount: '1'
    }
  ]
};

console.log('--- TEST 1: Ongoing group BAC10 on Session 1 ---');
const ended1 = isGroupEnded(bac10GroupOngoing);
console.log('isGroupEnded(bac10GroupOngoing):', ended1, '(expected: false)');
if (ended1 !== false) {
  throw new Error('Test 1 failed: BAC10 on session 1 should NOT be ended!');
}

const info1 = getStudentSessionInfo(bac10GroupOngoing.students[0].attendance, 4, 0, ended1);
console.log('Student 1 sessionInfo:', info1);
if (info1.countedSessions !== 4) {
  throw new Error(`Test 1 failed: countedSessions should be 4, got ${info1.countedSessions}`);
}
if (!info1.isSessionCounted(0) || !info1.isSessionCounted(1)) {
  throw new Error('Test 1 failed: sessions 0 and 1 should be counted');
}

const finances1 = calcStudentFinancesPure(bac10GroupOngoing.students[0], '4-2500', pricingTiers, bac10GroupOngoing);
console.log('Student 1 finances (ongoing):', {
  fee: finances1.fee,
  debt: finances1.debt,
  teacherPay: finances1.teacherPay,
  schoolEarn: finances1.schoolEarn,
  totalAttendance: finances1.totalAttendance
});
if (finances1.fee !== 2500 || finances1.debt !== 2500 || finances1.teacherPay !== 1500 || finances1.schoolEarn !== 1000) {
  throw new Error('Test 1 failed: ongoing group student should have fee 2500, debt 2500, teacherPay 1500, schoolEarn 1000');
}
console.log('✓ Test 1 Passed: BAC10 session 1 is counted normally with regular finances!\n');

// Test 2: When BAC10 reaches session 4 (ends all sessions)
console.log('--- TEST 2: Completed group BAC10 (reached session 4) ---');
const bac10GroupEnded = {
  groupId: 'BAC10',
  type: '4-2500',
  sessionCount: 4,
  sessionDates: ['2026/09/19', '2026/09/26', '2026/10/03', '2026/10/10'],
  students: [
    {
      rowId: 1,
      name: 'ضحى نغموش علي (only attended session 1, unpaid trial)',
      attendance: ['P', 'A', 'A', 'A'],
      payments: [],
      discount: '1'
    },
    {
      rowId: 2,
      name: 'طالب آخر (attended all 4)',
      attendance: ['P', 'P', 'P', 'P'],
      payments: [2500],
      discount: '1'
    }
  ]
};

const ended2 = isGroupEnded(bac10GroupEnded);
console.log('isGroupEnded(bac10GroupEnded):', ended2, '(expected: true)');
if (ended2 !== true) {
  throw new Error('Test 2 failed: BAC10 having session 4 marked should be ended!');
}

const info2 = getStudentSessionInfo(bac10GroupEnded.students[0].attendance, 4, 0, ended2);
console.log('Student 1 sessionInfo (after group ended):', info2);
if (info2.countedSessions !== 0) {
  throw new Error(`Test 2 failed: countedSessions should be 0 when group ended and only 1 session attended unpaid, got ${info2.countedSessions}`);
}

const finances2 = calcStudentFinancesPure(bac10GroupEnded.students[0], '4-2500', pricingTiers, bac10GroupEnded);
console.log('Student 1 finances (after group ended):', {
  fee: finances2.fee,
  debt: finances2.debt,
  teacherPay: finances2.teacherPay,
  schoolEarn: finances2.schoolEarn,
  totalAttendance: finances2.totalAttendance
});
if (finances2.fee !== 0 || finances2.debt !== 0 || finances2.teacherPay !== 0 || finances2.schoolEarn !== 0) {
  throw new Error('Test 2 failed: completed group 1-session unpaid trial student should have 0 fee, 0 debt, 0 teacherPay, 0 schoolEarn');
}

console.log('✓ Test 2 Passed: 1-session trial rule correctly applied when group ended!\n');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
