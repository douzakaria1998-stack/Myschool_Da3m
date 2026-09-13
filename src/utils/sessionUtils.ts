import { GroupSheet, StudentRecord, GroupMeta, PricingTier } from '../types/index';

/**
 * Formats any Date or date string to strict "YYYY/MM/DD" order
 */
export function formatToYYYYMMDD(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const clean = dateVal.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    if (!clean) return '';
    // If it's already YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean;
    // YYYY-MM-DD or YYYY.MM.DD
    const ymd = clean.match(/^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}/${ymd[2].padStart(2, '0')}/${ymd[3].padStart(2, '0')}`;
    }
    // DD/MM/YYYY or DD-MM-YYYY (or typo with extra digit like 29/08/20262)
    const dmy = clean.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})\d?/);
    if (dmy) {
      return `${dmy[3]}/${dmy[2].padStart(2, '0')}/${dmy[1].padStart(2, '0')}`;
    }
    // If it's just a number like "1", "2", "3"
    if (/^\d+$/.test(clean)) {
      return clean;
    }
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      dateVal = parsed;
    } else {
      return clean;
    }
  }

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getFullYear();
    const m = (dateVal.getMonth() + 1).toString().padStart(2, '0');
    const d = dateVal.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  return String(dateVal);
}

/**
 * Standard anchor starts for weekdays in the semester calendar
 */
export const WEEKDAY_ANCHORS: Record<string, string> = {
  'السبت': '2026-08-22',
  'الأحد': '2026-08-23',
  'الاحد': '2026-08-23',
  'الإثنين': '2026-08-24',
  'الاثنين': '2026-08-24',
  'الثلاثاء': '2026-08-25',
  'الأربعاء': '2026-08-26',
  'الاربعاء': '2026-08-26',
  'الخميس': '2026-08-27',
  'الجمعة': '2026-08-28'
};

/**
 * Generates consecutive session dates formatted as YYYY/MM/DD based on weekday
 */
export function generateSessionDates(
  dayName: string = 'السبت',
  count: number = 4,
  customStart?: string
): string[] {
  let startDate: Date;
  if (customStart) {
    const cleanStart = customStart.replace(/\//g, '-');
    startDate = new Date(cleanStart);
    if (isNaN(startDate.getTime())) {
      const anchor = WEEKDAY_ANCHORS[dayName] || '2026-08-22';
      startDate = new Date(anchor);
    }
  } else {
    const anchor = WEEKDAY_ANCHORS[dayName] || '2026-08-22';
    startDate = new Date(anchor);
  }

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const cur = new Date(startDate);
    cur.setDate(startDate.getDate() + i * 7);
    result.push(formatToYYYYMMDD(cur));
  }
  return result;
}

/**
 * Helper to check if a session date string corresponds to today's date
 */
export function isSessionDateToday(dateStr: string, today: Date = new Date()): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  // Normalize Arabic-Indic digits (٠-٩) to standard digits (0-9)
  const clean = dateStr.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  if (!clean) return false;

  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();
  const todayYearShort = todayYear % 100;

  const d2 = todayDay.toString().padStart(2, '0');
  const m2 = todayMonth.toString().padStart(2, '0');
  const y4 = todayYear.toString();
  const y2 = todayYearShort.toString().padStart(2, '0');

  // Direct pattern checks: DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
  const matchCandidates = [
    `${d2}/${m2}/${y4}`,
    `${todayDay}/${todayMonth}/${y4}`,
    `${d2}-${m2}-${y4}`,
    `${todayDay}-${todayMonth}-${y4}`,
    `${y4}-${m2}-${d2}`,
    `${y4}/${m2}/${d2}`,
    `${d2}/${m2}/${y2}`,
    `${todayDay}/${todayMonth}/${y2}`,
  ];

  if (matchCandidates.some((c) => clean === c || clean.startsWith(c) || clean.includes(c))) {
    return true;
  }

  // Regex check for DD/MM/YYYY or D/M/YYYY
  const dmyMatch = clean.match(/(\b\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4}\b)/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    const yFull = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
    if (d === todayDay && m === todayMonth && yFull === todayYear) {
      return true;
    }
  }

  // Regex check for YYYY-MM-DD
  const ymdMatch = clean.match(/(\b\d{4})[./\-](\d{1,2})[./\-](\d{1,2}\b)/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (d === todayDay && m === todayMonth && y === todayYear) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the highest session index that has recorded attendance for this group
 */
export function getLastSessionWithAttendance(students: StudentRecord[], sessionCount: number = 8): number {
  if (!Array.isArray(students) || students.length === 0) return -1;

  for (let idx = sessionCount - 1; idx >= 0; idx--) {
    const hasAttendance = students.some((s) => {
      if (!s.attendance) return false;
      const val = s.attendance[idx];
      if (typeof val !== 'string') return false;
      const clean = val.trim().toUpperCase();
      if (!clean) return false;
      // Skip Excel header artifacts such as "مجموع الحضور اليومي"
      if (clean.includes('مجموع')) return false;
      // Recognized attendance marks: P, A, M, S or Arabic equivalents
      return ['P', 'A', 'M', 'S', 'ح', 'غ', 'م'].includes(clean) || clean.length > 0;
    });

    if (hasAttendance) {
      return idx;
    }
  }

  return -1;
}

/**
 * Calculates the default session index:
 * 1. If today's date matches any session date in group.sessionDates, return that session index.
 * 2. Otherwise, return the last session that contains attendance.
 * 3. Fall back to 0 (Session 1).
 */
export function getDefaultSessionIndex(group: GroupSheet, today: Date = new Date()): number {
  if (!group) return 0;

  // 1. Priority 1: Check if today's date matches any session date
  if (Array.isArray(group.sessionDates)) {
    const todayIndex = group.sessionDates.findIndex((d) => isSessionDateToday(d, today));
    if (todayIndex !== -1) {
      return todayIndex;
    }
  }

  // 2. Priority 2: Fall back to the last session that contains attendance
  const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
  const lastAttIndex = getLastSessionWithAttendance(group.students, sessionCount);
  if (lastAttIndex !== -1) {
    return lastAttIndex;
  }

  // 3. Fallback to 0 (Session 1)
  return 0;
}

/**
 * Arabic day names mapped by JavaScript getDay() index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export const ARABIC_DAYS = [
  'الأحد',    // 0
  'الإثنين',  // 1
  'الثلاثاء', // 2
  'الأربعاء', // 3
  'الخميس',   // 4
  'الجمعة',   // 5
  'السبت'     // 6
];

/**
 * Returns today's Arabic weekday name
 */
export function getTodayArabicDayName(today: Date = new Date()): string {
  return ARABIC_DAYS[today.getDay()];
}

/**
 * Normalizes Arabic text (removes alef hamzas, taa marbuta variations, etc.) for reliable matching
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F]/g, ''); // strip tashkeel
}

/**
 * Checks whether a group is active today:
 * 1. If any session in groupSheet.sessionDates matches today's calendar date
 * 2. OR if group's scheduled weekday (day1 or day2) matches today's day of week
 */
export function isGroupToday(group: { day1?: string; day2?: string; id?: string }, groupSheet?: GroupSheet, today: Date = new Date()): boolean {
  if (!group) return false;

  // 1. Check if any session date matches today's date
  if (groupSheet && Array.isArray(groupSheet.sessionDates)) {
    const hasTodayDate = groupSheet.sessionDates.some((d) => isSessionDateToday(d, today));
    if (hasTodayDate) return true;
  }

  // 2. Check weekday matching
  const todayDayName = ARABIC_DAYS[today.getDay()];
  const normToday = normalizeArabicText(todayDayName);

  const normDay1 = normalizeArabicText(group.day1 || '');
  const normDay2 = normalizeArabicText(group.day2 || '');

  if (normDay1 && (normDay1.includes(normToday) || normToday.includes(normDay1))) {
    return true;
  }
  if (normDay2 && (normDay2.includes(normToday) || normToday.includes(normDay2))) {
    return true;
  }

  return false;
}

/**
 * Formats time string, converting fractional Excel decimal day times (e.g. 0.33333333333333331) to HH:mm
 */
export function formatGroupTime(timeStr?: string): string {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';

  // Check if it's a decimal number between 0 and 1 (Excel time representation)
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0 && num < 1 && trimmed.includes('.')) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return trimmed;
}

/**
 * Resolves total cycle sessions for a group (e.g. 4, 6, 8, etc.):
 * 1. Explicit sessionCount on groupSheet or groupMeta
 * 2. PricingTier sessions (e.g. '4-2500' -> 4, '8-1500' -> 8)
 * 3. sessionDates length if available
 * 4. Default 4
 */
export function getGroupCycleTotalSessions(
  group: { sessionCount?: number; type?: string; sessionDates?: string[] },
  groupSheet?: { sessionCount?: number; sessionDates?: string[]; type?: string },
  pricingTiers?: PricingTier[]
): number {
  if (groupSheet?.sessionCount && groupSheet.sessionCount > 0) return groupSheet.sessionCount;
  if (group?.sessionCount && group.sessionCount > 0) return group.sessionCount;

  const type = groupSheet?.type || group?.type;
  if (type && pricingTiers && Array.isArray(pricingTiers)) {
    const tier = pricingTiers.find((t) => t.id === type);
    if (tier && tier.sessions && tier.sessions > 0) {
      return tier.sessions;
    }
  }

  if (groupSheet?.sessionDates && groupSheet.sessionDates.length > 0) {
    return groupSheet.sessionDates.length;
  }
  if (group?.sessionDates && group.sessionDates.length > 0) {
    return group.sessionDates.length;
  }

  return 4;
}

/**
 * Calculates current reached session (1-indexed) based on recorded attendance:
 * Returns the highest session (1..totalSessions) that has any attendance marked, or 0 if none.
 */
export function getGroupCurrentSession(students: StudentRecord[], totalSessions: number): number {
  if (!Array.isArray(students) || students.length === 0) return 0;

  let maxIdx = -1;
  for (let i = 0; i < totalSessions; i++) {
    const hasAtt = students.some((s) => {
      if (!s.attendance) return false;
      const val = s.attendance[i];
      if (typeof val !== 'string') return false;
      const clean = val.trim().toUpperCase();
      if (!clean || clean.includes('مجموع')) return false;
      return ['P', 'A', 'M', 'S', 'ح', 'غ', 'م'].includes(clean) || clean.length > 0;
    });
    if (hasAtt) {
      maxIdx = i;
    }
  }

  return maxIdx === -1 ? 0 : maxIdx + 1;
}

export interface GroupSessionStatus {
  totalSessions: number;
  currentSession: number;
  isLastSessionReached: boolean;
  status: 'active' | 'inactive';
}

/**
 * Determines whether a group is active or inactive based on session progress:
 * - If group has reached the last session (e.g. 4/4 or 6/6 or 8/8) -> status is 'inactive'
 * - Otherwise -> status is 'active'
 * - Can be manually overridden if status is explicitly stored as 'active' or 'inactive'
 */
/**
 * Detects if a student record is an Excel footer/summary row
 * (e.g. Row 105: GID/TID/مجموع الحضور اليومي, Row 106: BAC01/D01/sums)
 * These rows should never be counted as students or displayed in student tables.
 */
export function isSummaryRow(
  student: { name?: string; phone?: string; attendance?: string[] },
  groupId?: string
): boolean {
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

export function getGroupStatus(
  group: GroupMeta,
  groupSheet?: GroupSheet,
  pricingTiers?: PricingTier[]
): GroupSessionStatus {
  const totalSessions = getGroupCycleTotalSessions(group, groupSheet, pricingTiers);
  const students = (groupSheet?.students || []).filter((s) => !isSummaryRow(s, groupSheet?.groupId || group?.id));
  const currentSession = getGroupCurrentSession(students, totalSessions);
  const isLastSessionReached = totalSessions > 0 && currentSession >= totalSessions;

  // Manual explicit override if set
  if (groupSheet?.status === 'active' || group?.status === 'active') {
    return { totalSessions, currentSession, isLastSessionReached, status: 'active' };
  }
  if (groupSheet?.status === 'inactive' || group?.status === 'inactive') {
    return { totalSessions, currentSession, isLastSessionReached, status: 'inactive' };
  }

  // Automatic derivation according to user rule:
  // "for the groups that reach the last session ex: 4/4 or 6/6 or 8/8, whatever the number put that the status is inactive, if not so the group active"
  const status: 'active' | 'inactive' = isLastSessionReached ? 'inactive' : 'active';
  return {
    totalSessions,
    currentSession,
    isLastSessionReached,
    status
  };
}

/**
 * Returns true if the group is active (has not yet reached its last session)
 */
export function isGroupActive(
  group: GroupMeta,
  groupSheet?: GroupSheet,
  pricingTiers?: PricingTier[]
): boolean {
  return getGroupStatus(group, groupSheet, pricingTiers).status === 'active';
}

/**
 * Checks if a group ID belongs to a VIP group (BACV prefix) or standard group (BAC prefix)
 */
export function isVipGroupId(groupId: string): boolean {
  if (!groupId) return false;
  return /^BACV/i.test(groupId.trim());
}

/**
 * Validates group ID strictly:
 * - Normal groups: Must start with BAC followed by at least 2 digits (e.g. BAC01, BAC02, BAC10)
 * - VIP groups: Must start with BACV followed by at least 2 digits (e.g. BACV01, BACV02, BACV05)
 * - No hyphens, dashes or suffixes (e.g. BAC01-2 is invalid)
 */
export function isValidGroupId(groupId: string): { isValid: boolean; error?: string } {
  const clean = (groupId || '').trim().toUpperCase();
  if (!clean) {
    return { isValid: false, error: 'رمز الفوج لا يمكن أن يكون فارغاً' };
  }
  if (!clean.startsWith('BAC')) {
    return { isValid: false, error: 'يجب أن يبدأ رمز الفوج دائماً بـ BAC أو BACV' };
  }
  if (clean.startsWith('BACV')) {
    const rest = clean.slice(4);
    if (!/^\d{2,}$/.test(rest)) {
      return { isValid: false, error: 'يجب أن يتبع BACV أرقام تصاعدية مكونة من خانتين على الأقل (مثال: BACV01 أو BACV05)' };
    }
    return { isValid: true };
  } else {
    const rest = clean.slice(3);
    if (!/^\d{2,}$/.test(rest)) {
      return { isValid: false, error: 'يجب أن يتبع BAC أرقام تصاعدية مكونة من خانتين على الأقل (مثال: BAC01 أو BAC10)' };
    }
    return { isValid: true };
  }
}

/**
 * Computes the next ascending sequential Group ID:
 * - For normal groups: BAC01, BAC02, ..., BAC09, BAC10, BAC11...
 * - For VIP groups: BACV01, BACV02, ..., BACV04, BACV05, BACV06...
 * - Numbers are always formatted with leading zero for single digits: 01, 02, 03...
 */
export function getNextGroupId(
  isVip: boolean,
  existingGroupIds: (string | { id?: string; groupId?: string })[]
): string {
  const prefix = isVip ? 'BACV' : 'BAC';
  const rawIds = (existingGroupIds || [])
    .map((g) => {
      if (!g) return '';
      if (typeof g === 'string') return g.trim().toUpperCase();
      if (typeof g === 'object') {
        if ('id' in g && typeof g.id === 'string') return g.id.trim().toUpperCase();
        if ('groupId' in g && typeof g.groupId === 'string') return g.groupId.trim().toUpperCase();
      }
      return '';
    })
    .filter(Boolean);

  let maxNum = 0;
  for (const id of rawIds) {
    if (isVip) {
      const match = id.match(/^BACV(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    } else {
      const match = id.match(/^BAC(\d+)$/i);
      if (match && !id.startsWith('BACV')) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  let candidateNum = maxNum + 1;
  let candidateId = `${prefix}${candidateNum.toString().padStart(2, '0')}`;

  while (rawIds.includes(candidateId)) {
    candidateNum++;
    candidateId = `${prefix}${candidateNum.toString().padStart(2, '0')}`;
  }

  return candidateId;
}

/**
 * Returns a list of sequential suggestions for a new group (e.g. next 3 available ascending IDs)
 */
export function getSuggestedGroupIds(
  isVip: boolean,
  existingGroupIds: (string | { id?: string; groupId?: string })[],
  count: number = 3
): string[] {
  const suggestions: string[] = [];
  const rawIds = (existingGroupIds || [])
    .map((g) => {
      if (!g) return '';
      if (typeof g === 'string') return g.trim().toUpperCase();
      if (typeof g === 'object') {
        if ('id' in g && typeof g.id === 'string') return g.id.trim().toUpperCase();
        if ('groupId' in g && typeof g.groupId === 'string') return g.groupId.trim().toUpperCase();
      }
      return '';
    })
    .filter(Boolean);

  const prefix = isVip ? 'BACV' : 'BAC';
  let maxNum = 0;
  for (const id of rawIds) {
    if (isVip) {
      const match = id.match(/^BACV(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    } else {
      const match = id.match(/^BAC(\d+)$/i);
      if (match && !id.startsWith('BACV')) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  while (suggestions.length < count) {
    const candidateId = `${prefix}${nextNum.toString().padStart(2, '0')}`;
    if (!rawIds.includes(candidateId) && !suggestions.includes(candidateId)) {
      suggestions.push(candidateId);
    }
    nextNum++;
  }

  return suggestions;
}

