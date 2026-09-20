const assert = require('assert');

// Test the merge logic directly
function normalizeArabicName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي/g, 'ى')
    .replace(/ئ/g, 'ى')
    .replace(/ؤ/g, 'و')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function calcStudentFinancesPure(student, groupType, pricingTiers, groupFinances) {
  const totalReceived = (student.payments || []).reduce((sum, p) => sum + (Number(p) || 0), 0);
  const fee = student.fee || 2500;
  return {
    ...student,
    fee,
    totalReceived,
    debt: Math.max(0, fee - totalReceived)
  };
}

function mergeAttendanceSafely(remote, local) {
  if (!remote || !remote.groupData) return local || remote;
  if (!local || !local.groupData) return remote;

  const merged = {
    ...remote,
    groups: [...(remote.groups || [])],
    groupData: { ...remote.groupData }
  };

  // 1. Preserve local groups missing in remote
  for (const [gid, localGroup] of Object.entries(local.groupData)) {
    if (!merged.groupData[gid]) {
      merged.groupData[gid] = { ...localGroup };
    }
  }
  const remoteGroupIds = new Set(merged.groups.map((g) => g.id));
  (local.groups || []).forEach((lg) => {
    if (!remoteGroupIds.has(lg.id)) {
      merged.groups.push(lg);
      remoteGroupIds.add(lg.id);
    }
  });

  // 2. Safely merge student lists and details across all groups
  for (const [gid, localGroup] of Object.entries(local.groupData)) {
    const remoteGroup = merged.groupData[gid];
    if (!remoteGroup || !remoteGroup.students || !localGroup.students) continue;

    const matchedLocalRowIds = new Set();
    const matchedLocalNames = new Set();
    let hasDifferences = false;

    const mergedStudents = remoteGroup.students.map((rStudent) => {
      const rNormName = normalizeArabicName(rStudent.name || '');
      const lStudent = localGroup.students.find(
        (s) => (s.rowId && s.rowId === rStudent.rowId) || (rNormName && normalizeArabicName(s.name || '') === rNormName)
      );
      if (!lStudent) return rStudent;

      if (lStudent.rowId) matchedLocalRowIds.add(lStudent.rowId);
      if (lStudent.name) matchedLocalNames.add(normalizeArabicName(lStudent.name));

      let studentModified = false;

      // Merge attendance
      const newAttendance = [...(rStudent.attendance || [])];
      (lStudent.attendance || []).forEach((lStatus, idx) => {
        const cleanL = (lStatus || '').trim().toUpperCase();
        const cleanR = (newAttendance[idx] || '').trim().toUpperCase();
        if ((cleanL === 'P' || cleanL === 'M') && !cleanR) {
          while (newAttendance.length <= idx) newAttendance.push('');
          newAttendance[idx] = cleanL;
          studentModified = true;
        }
      });

      // Merge payments
      const maxSessions = Math.max(rStudent.payments?.length || 0, lStudent.payments?.length || 0, 4);
      const newPayments = [];
      for (let sIdx = 0; sIdx < maxSessions; sIdx++) {
        const rPay = rStudent.payments ? rStudent.payments[sIdx] : '';
        const lPay = lStudent.payments ? lStudent.payments[sIdx] : '';
        const rNum = Number(rPay) || 0;
        const lNum = Number(lPay) || 0;
        if (lNum > rNum) {
          newPayments.push(lNum);
          studentModified = true;
        } else if (rNum > 0) {
          newPayments.push(rNum);
        } else if (lPay !== '' && lPay !== undefined && lPay !== null) {
          newPayments.push(lPay);
        } else {
          newPayments.push(rPay ?? '');
        }
      }

      if (studentModified) {
        hasDifferences = true;
        return calcStudentFinancesPure(
          { ...rStudent, attendance: newAttendance, payments: newPayments },
          remoteGroup.type || '4-2500',
          [],
          remoteGroup
        );
      }
      return rStudent;
    });

    // CRITICAL: Append any local student that does NOT exist in remote!
    const localOnlyStudents = [];
    localGroup.students.forEach((lStudent) => {
      if (!lStudent || !lStudent.name) return;
      const lNorm = normalizeArabicName(lStudent.name);
      const isMatched = (lStudent.rowId && matchedLocalRowIds.has(lStudent.rowId)) || (lNorm && matchedLocalNames.has(lNorm));
      if (!isMatched) {
        localOnlyStudents.push(lStudent);
      }
    });

    if (localOnlyStudents.length > 0) {
      hasDifferences = true;
      const existingMaxRowId = mergedStudents.reduce((max, s) => Math.max(max, s.rowId || 0), 0);
      let nextRow = existingMaxRowId + 1;
      localOnlyStudents.forEach((st) => {
        const studentRowId = st.rowId > existingMaxRowId ? st.rowId : nextRow++;
        const calcSt = calcStudentFinancesPure(
          { ...st, rowId: studentRowId },
          remoteGroup.type || localGroup.type || '4-2500',
          [],
          remoteGroup
        );
        mergedStudents.push(calcSt);
      });
    }

    if (hasDifferences) {
      merged.groupData[gid] = {
        ...remoteGroup,
        students: mergedStudents
      };
    }
  }

  return merged;
}

// ================= TEST SUITE =================
console.log('Running test suite for mergeAttendanceSafely...');

// Test 1: BAC11 with 93 remote students, 107 local students (14 added locally)
const remoteMock = {
  groups: [{ id: 'BAC11' }],
  groupData: {
    BAC11: {
      groupId: 'BAC11',
      students: Array.from({ length: 93 }, (_, i) => ({
        rowId: i + 1,
        name: `طالب قديم ${i + 1}`,
        payments: ['', '', '', ''],
        attendance: ['', '', '', '']
      }))
    }
  }
};

const localMock = {
  groups: [{ id: 'BAC11' }],
  groupData: {
    BAC11: {
      groupId: 'BAC11',
      students: [
        // The 93 existing students, with student 1 having a local payment
        ...Array.from({ length: 93 }, (_, i) => ({
          rowId: i + 1,
          name: `طالب قديم ${i + 1}`,
          payments: i === 0 ? [2500, '', '', ''] : ['', '', '', ''],
          attendance: i === 0 ? ['P', '', '', ''] : ['', '', '', '']
        })),
        // 14 newly enrolled students (bringing total to 107)
        ...Array.from({ length: 14 }, (_, i) => ({
          rowId: 94 + i,
          name: `طالب جديد ${94 + i}`,
          payments: [2500, '', '', ''],
          attendance: ['P', '', '', '']
        }))
      ]
    }
  }
};

const result = mergeAttendanceSafely(remoteMock, localMock);

// Verification 1: All 107 students must exist in merged result!
assert.strictEqual(result.groupData.BAC11.students.length, 107, 'Must preserve all 107 students!');
console.log('✓ PASS: All 107 students preserved (remote had 93, local had 107).');

// Verification 2: Newly added student 94 must have their payment and attendance preserved!
const st94 = result.groupData.BAC11.students.find(s => s.name === 'طالب جديد 94');
assert(st94, 'Student 94 must exist');
assert.strictEqual(st94.payments[0], 2500, 'Student 94 payment must be preserved');
assert.strictEqual(st94.totalReceived, 2500, 'Student 94 totalReceived must be 2500');
console.log('✓ PASS: Newly added student payment and attendance preserved.');

// Verification 3: Existing student 1 local payment must not be wiped by remote empty payment!
const st1 = result.groupData.BAC11.students.find(s => s.rowId === 1);
assert.strictEqual(st1.payments[0], 2500, 'Student 1 payment must be preserved');
assert.strictEqual(st1.attendance[0], 'P', 'Student 1 attendance must be preserved');
console.log('✓ PASS: Existing student payment was not overwritten by remote empty snapshot.');

// Test 2: Local newly added group that is not in remote
const localWithNewGroup = {
  groups: [{ id: 'BAC11' }, { id: 'BAC12' }],
  groupData: {
    BAC11: localMock.groupData.BAC11,
    BAC12: {
      groupId: 'BAC12',
      students: [{ rowId: 1, name: 'تلميذ في الفوج الجديد', payments: [2500], attendance: ['P'] }]
    }
  }
};

const res2 = mergeAttendanceSafely(remoteMock, localWithNewGroup);
assert(res2.groupData.BAC12, 'BAC12 group must be preserved');
assert.strictEqual(res2.groupData.BAC12.students.length, 1, 'BAC12 student must be preserved');
console.log('✓ PASS: Locally added group BAC12 was preserved.');

console.log('\nAll mergeAttendanceSafely tests passed with 100% success!');
