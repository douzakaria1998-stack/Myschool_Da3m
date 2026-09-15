const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/dell/Desktop/Da3m/node_modules/@supabase/supabase-js');

const initialDataPath = path.join(__dirname, '..', 'src', 'data', 'initialData.json');
const currentData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));

function getStudentSessionInfo(attendance, cycleSessions = 4) {
  const cycleAtt = (attendance || []).slice(0, cycleSessions);
  const hasSuspended = cycleAtt.includes('S');

  let firstActiveIndex = -1;
  for (let i = 0; i < cycleAtt.length; i++) {
    const st = cycleAtt[i];
    if (st === 'P' || st === 'A' || st === 'M' || st === 'S') {
      firstActiveIndex = i;
      break;
    }
  }

  let countedSessions = 0;
  if (hasSuspended) {
    countedSessions = cycleAtt.filter((st) => st === 'P' || st === 'A').length;
  } else if (firstActiveIndex !== -1) {
    countedSessions = cycleSessions - firstActiveIndex;
  } else {
    countedSessions = 0;
  }

  return { firstActiveIndex, countedSessions };
}

function calcStudentFinancesPure(student, groupType, pricingTiers, groupFinances) {
  const isVipGroup =
    Boolean(groupFinances?.isVip) ||
    Boolean(groupFinances?.groupId && (groupFinances.groupId.toUpperCase().startsWith('BACV') || groupFinances.groupId.toUpperCase().includes('VIP'))) ||
    Boolean(groupType && groupType.includes('10000'));

  const effectiveGroupType = groupType || (isVipGroup ? '4-10000' : '4-2500');

  const tier = (pricingTiers || []).find((t) => t.id === effectiveGroupType) || {
    price: isVipGroup ? 10000 : 2500,
    teacherRate: isVipGroup ? 7500 : 1500,
    schoolRate: isVipGroup ? 2500 : 1000,
    sessions: 4
  };

  const cycleSessions = groupFinances?.sessionCount || tier.sessions || 4;

  const basePrice = typeof groupFinances?.studentFee === 'number' && groupFinances.studentFee > 0
    ? groupFinances.studentFee
    : tier.price;
  const baseTeacherRate = typeof groupFinances?.teacherPayPerStudent === 'number'
    ? groupFinances.teacherPayPerStudent
    : tier.teacherRate;

  const perSessionPrice = Math.round(basePrice / cycleSessions);
  const perSessionTeacherRate = Math.round(baseTeacherRate / cycleSessions);

  const sessionInfo = getStudentSessionInfo(student.attendance, cycleSessions);
  const countedSessions = sessionInfo.countedSessions > 0 ? sessionInfo.countedSessions : cycleSessions;

  const cycleAttendance = (student.attendance || []).slice(0, cycleSessions);
  const attendedCount = cycleAttendance.filter((a) => a === 'P').length;
  const makeupCount = cycleAttendance.filter((a) => a === 'M').length;
  const totalAttendance = attendedCount + makeupCount;

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
    const count = makeupCount > 0 ? makeupCount : (attendedCount > 0 ? attendedCount : 1);
    fee = count * perSessionPrice;
    teacherPay = count * perSessionTeacherRate;
    schoolEarn = Math.max(0, fee - teacherPay);
  } else {
    fee = countedSessions * perSessionPrice;
    schoolEarn = Math.max(0, fee - teacherPay);
  }

  const totalReceived = (student.payments || []).reduce((sum, p) => {
    const val = typeof p === 'number' ? p : parseFloat(String(p));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const debt = Math.max(0, fee - totalReceived);

  return {
    ...student,
    fee,
    totalReceived,
    teacherPay,
    schoolEarn,
    debt,
    totalAttendance
  };
}

// 1. Process groups meta
const updatedGroupsMeta = (currentData.groups || []).map((g) => {
  const isVip = g.id.startsWith('BACV') || g.id.includes('VIP') || Boolean(g.isVip);
  const targetType = isVip ? '4-10000' : (g.type || '4-2500');
  return {
    ...g,
    isVip,
    type: targetType,
    sessionCount: 4
  };
});

// 2. Process groupData
const updatedGroupData = {};
for (const [gid, gSheet] of Object.entries(currentData.groupData || {})) {
  const isVip = gid.startsWith('BACV') || gid.includes('VIP') || Boolean(gSheet.isVip);
  const targetType = isVip ? '4-10000' : (gSheet.type || '4-2500');

  const updatedStudents = (gSheet.students || []).map((s) => {
    // Preserve summary rows
    if (s.name && (s.name.includes('المجموع') || s.name.includes('الأستاذ') || s.name.includes('المدرسة') || s.name === gid || s.name === 'GID')) {
      return s;
    }
    return calcStudentFinancesPure(s, targetType, currentData.pricingTiers, {
      ...gSheet,
      groupId: gid,
      isVip,
      sessionCount: 4
    });
  });

  updatedGroupData[gid] = {
    ...gSheet,
    groupId: gid,
    isVip,
    type: targetType,
    sessionCount: 4,
    students: updatedStudents
  };
}

const cleanedCenterData = {
  ...currentData,
  groups: updatedGroupsMeta,
  groupData: updatedGroupData
};

fs.writeFileSync(initialDataPath, JSON.stringify(cleanedCenterData, null, 2), 'utf8');
console.log('Successfully updated initialData.json!');

// Check Raid in BACV11
const bacv11 = cleanedCenterData.groupData['BACV11'];
const raid = bacv11.students.find(s => s.name && s.name.includes('لعويني'));
console.log('\nRaid in BACV11 after fix:', raid);

// Sync to Supabase
async function syncToSupabase() {
  try {
    const supabaseUrl = 'https://pogsnezjtcjiwpgpctqr.supabase.co';
    const supabaseKey = 'sb_publishable_TYebW2XNVoWFX8fIP5xeAQ_DLORtnBq';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('\nSyncing cleaned data to Supabase (center_data -> main)...');
    const { error } = await supabase
      .from('center_data')
      .upsert({
        id: 'main',
        data: cleanedCenterData,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Supabase sync error:', error.message);
    } else {
      console.log('Successfully synced cleaned data to Supabase!');
    }
  } catch (err) {
    console.error('Supabase sync exception:', err.message);
  }
}

syncToSupabase();
