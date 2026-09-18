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
 * Resolves day of week index (0 = Sunday .. 6 = Saturday) from an Arabic day name string
 */
export function getDayOfWeekFromArabic(dayName: string): number {
  if (!dayName) return -1;
  const norm = normalizeArabicText(dayName);
  if (!norm) return -1;
  // 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
  const days = ['الاحد', 'الاثنين', 'الثلاثاء', 'الاربعاء', 'الخميس', 'الجمعة', 'السبت'];
  for (let i = 0; i < days.length; i++) {
    if (norm.includes(days[i]) || days[i].includes(norm)) {
      return i;
    }
  }
  return -1;
}

/**
 * Standard anchor starts for weekdays in the semester calendar (legacy fallback)
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
 * Calculates the next upcoming calendar date for a given weekday name.
 * If allowToday is false, even if baseDate falls on that weekday, returns the next occurrence (+7 days).
 */
export function getUpcomingSessionDate(
  dayName: string = 'السبت',
  baseDate: Date = new Date(),
  allowToday: boolean = false
): Date {
  const targetWeekday = getDayOfWeekFromArabic(dayName);
  const curWeekday = baseDate.getDay();
  const validTarget = targetWeekday !== -1 ? targetWeekday : 6; // default Saturday

  let diffDays = (validTarget - curWeekday + 7) % 7;
  if (diffDays === 0 && !allowToday) {
    diffDays = 7;
  }

  const result = new Date(baseDate);
  result.setDate(result.getDate() + diffDays);
  return result;
}

/**
 * Calculates the first session date for a renewed / new cycle group:
 * If the source group has session dates, finds the last session date (e.g. Wednesday 16/09/2026)
 * and returns the next scheduled session date (e.g. next Wednesday 23/09/2026).
 */
export function getNextSessionDateAfter(
  lastDateInput: string | Date | null | undefined,
  day1Name: string = 'السبت',
  day2Name?: string
): Date {
  let lastDate: Date | null = null;
  if (lastDateInput) {
    if (lastDateInput instanceof Date && !isNaN(lastDateInput.getTime())) {
      lastDate = new Date(lastDateInput);
    } else if (typeof lastDateInput === 'string') {
      const formatted = formatToYYYYMMDD(lastDateInput);
      if (formatted) {
        const parsed = new Date(formatted.replace(/\//g, '-'));
        if (!isNaN(parsed.getTime())) {
          lastDate = parsed;
        }
      }
    }
  }

  // Resolve study weekdays
  const weekdays: number[] = [];
  const w1 = getDayOfWeekFromArabic(day1Name);
  if (w1 !== -1) weekdays.push(w1);
  const w2 = getDayOfWeekFromArabic(day2Name || '');
  if (w2 !== -1 && w2 !== w1) weekdays.push(w2);
  if (weekdays.length === 0) weekdays.push(6); // Default Saturday

  // If we have a valid last date:
  if (lastDate) {
    const nextDate = new Date(lastDate);
    // Step forward at least 1 day to find the next matching study day
    let found = false;
    for (let step = 1; step <= 7; step++) {
      nextDate.setDate(nextDate.getDate() + 1);
      if (weekdays.includes(nextDate.getDay())) {
        found = true;
        break;
      }
    }
    if (!found) {
      nextDate.setDate(lastDate.getDate() + 7);
    }

    // If nextDate is in the deep past (older than today), advance it forward to upcoming
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (nextDate.getTime() < todayMidnight.getTime()) {
      return getUpcomingSessionDate(day1Name, new Date(), false);
    }

    return nextDate;
  }

  // If no lastDate available, calculate upcoming session date from today
  return getUpcomingSessionDate(day1Name, new Date(), false);
}

/**
 * Generates consecutive session dates formatted as YYYY/MM/DD based on weekday(s).
 * By default, newly created groups start on their upcoming schedule date (NEW).
 */
export function generateSessionDates(
  dayName: string = 'السبت',
  count: number = 4,
  customStart?: string,
  day2Name?: string
): string[] {
  let startDate: Date;
  if (customStart) {
    const cleanStart = customStart.replace(/\//g, '-');
    startDate = new Date(cleanStart);
    if (isNaN(startDate.getTime())) {
      startDate = getUpcomingSessionDate(dayName, new Date(), false);
    } else {
      // Ensure startDate aligns with the specified dayName's weekday
      const targetWeekday = getDayOfWeekFromArabic(dayName);
      if (targetWeekday !== -1 && startDate.getDay() !== targetWeekday) {
        let dayOffset = targetWeekday - startDate.getDay();
        if (dayOffset > 3) dayOffset -= 7;
        if (dayOffset < -3) dayOffset += 7;
        startDate.setDate(startDate.getDate() + dayOffset);
      }
    }
  } else {
    // When no custom start is provided, default to the upcoming session date (NEW)
    startDate = getUpcomingSessionDate(dayName, new Date(), false);
  }

  // Resolve study weekdays
  const weekdays: number[] = [];
  const w1 = getDayOfWeekFromArabic(dayName);
  if (w1 !== -1) weekdays.push(w1);
  const w2 = getDayOfWeekFromArabic(day2Name || '');
  if (w2 !== -1 && w2 !== w1) weekdays.push(w2);

  const result: string[] = [];
  let cur = new Date(startDate);
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      result.push(formatToYYYYMMDD(cur));
    } else {
      if (weekdays.length <= 1) {
        cur = new Date(cur);
        cur.setDate(cur.getDate() + 7);
      } else {
        let nextDate = new Date(cur);
        let found = false;
        for (let step = 1; step <= 7; step++) {
          nextDate.setDate(nextDate.getDate() + 1);
          if (weekdays.includes(nextDate.getDay())) {
            cur = nextDate;
            found = true;
            break;
          }
        }
        if (!found) {
          cur.setDate(cur.getDate() + 7);
        }
      }
      result.push(formatToYYYYMMDD(cur));
    }
  }
  return result;
}

/**
 * Propagates subsequent session dates when any session date is edited.
 * Starting from changedIndex, all subsequent sessions (changedIndex + 1 .. dates.length - 1)
 * are automatically calculated based on the study day(s) of the group.
 */
export function recalculateSubsequentDates(
  currentDates: string[],
  changedIndex: number,
  newDateStr: string,
  day1?: string,
  day2?: string
): string[] {
  const result = [...currentDates];
  const cleanFormatted = formatToYYYYMMDD(newDateStr);
  result[changedIndex] = cleanFormatted || newDateStr;

  const parsedStart = new Date(cleanFormatted ? cleanFormatted.replace(/\//g, '-') : newDateStr.replace(/\//g, '-'));
  if (isNaN(parsedStart.getTime())) {
    return result;
  }

  // Resolve study weekday numbers (0 = Sunday .. 6 = Saturday)
  const weekdays: number[] = [];
  const w1 = getDayOfWeekFromArabic(day1 || '');
  if (w1 !== -1) weekdays.push(w1);

  const w2 = getDayOfWeekFromArabic(day2 || '');
  if (w2 !== -1 && w2 !== w1) weekdays.push(w2);

  // If no valid weekday resolved from day1/day2, default to the weekday of the edited date
  if (weekdays.length === 0) {
    weekdays.push(parsedStart.getDay());
  }

  let curDate = new Date(parsedStart);

  for (let i = changedIndex + 1; i < result.length; i++) {
    if (weekdays.length === 1) {
      curDate = new Date(curDate);
      curDate.setDate(curDate.getDate() + 7);
    } else {
      let nextDate = new Date(curDate);
      let found = false;
      for (let step = 1; step <= 7; step++) {
        nextDate.setDate(nextDate.getDate() + 1);
        if (weekdays.includes(nextDate.getDay())) {
          curDate = nextDate;
          found = true;
          break;
        }
      }
      if (!found) {
        curDate.setDate(curDate.getDate() + 7);
      }
    }
    result[i] = formatToYYYYMMDD(curDate);
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
 * Checks whether a group is active today:
 * 1. If group has a scheduled weekday (day1 or day2), it strictly matches if today's day of week matches day1 or day2.
 * 2. If neither day1 nor day2 is set, falls back to checking if any session date matches today's calendar date.
 */
export function isGroupToday(
  group: { day1?: string; day2?: string; id?: string },
  groupSheet?: GroupSheet,
  today: Date = new Date()
): boolean {
  if (!group) return false;

  const todayDayName = ARABIC_DAYS[today.getDay()];
  const normToday = normalizeArabicText(todayDayName);

  const groupDay1 = group.day1 || groupSheet?.day1 || '';
  const groupDay2 = group.day2 || groupSheet?.day2 || '';

  const normDay1 = normalizeArabicText(groupDay1);
  const normDay2 = normalizeArabicText(groupDay2);

  // If the group has scheduled day(s), it is today's group IF AND ONLY IF today matches day1 or day2!
  if (normDay1 || normDay2) {
    const isDay1Today = normDay1 ? (normDay1.includes(normToday) || normToday.includes(normDay1)) : false;
    const isDay2Today = normDay2 ? (normDay2.includes(normToday) || normToday.includes(normDay2)) : false;
    return isDay1Today || isDay2Today;
  }

  // Fallback: If neither day1 nor day2 is set, check if any session date matches today
  if (groupSheet && Array.isArray(groupSheet.sessionDates)) {
    return groupSheet.sessionDates.some((d) => isSessionDateToday(d, today));
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
 * Sorts groups so that:
 * 1. Active groups always appear FIRST.
 * 2. Inactive (completed) groups appear LAST.
 * 3. Within each group status, groups are sorted from oldest to newest ID (ascending order, e.g. BAC01, BAC02, ..., BAC10).
 */
export function sortGroupsActiveFirstOldToNew(
  groups: GroupMeta[],
  groupData: Record<string, GroupSheet>,
  pricingTiers?: PricingTier[]
): GroupMeta[] {
  return [...groups].sort((a, b) => {
    const aActive = isGroupActive(a, groupData[a.id], pricingTiers);
    const bActive = isGroupActive(b, groupData[b.id], pricingTiers);

    // Active groups come first
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // From oldest to newest ID (ascending order)
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
  });
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
 * - For VIP groups: BACV01, BACV02, ..., BACV04, BACV05, BACV10...
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

export interface StudentSessionInfo {
  firstActiveIndex: number;
  countedSessions: number;
  isSessionCounted: (sessionIdx: number) => boolean;
}

/**
 * Calculates session counting rules for a student:
 * - Empty cells before the student's first recorded attendance (P/A/M/S) do NOT count (un-enrolled / pre-enrollment sessions).
 * - Empty cells after the student has recorded attendance DO count (officially registered in the group).
 * - RULE: If student attended only 1 session and did NOT pay, the session does NOT count for the school or teacher.
 * - But if student attended 1 session and PAID, it DOES count for both school and teacher.
 */
export function getStudentSessionInfo(
  attendance: (string | null | undefined)[],
  cycleSessions: number = 4,
  payments?: (number | string | null | undefined)[] | number
): StudentSessionInfo {
  const cycleAtt = (attendance || []).slice(0, cycleSessions);
  const hasSuspended = cycleAtt.includes('S');
  const attendedCount = cycleAtt.filter((st) => st === 'P').length;
  const makeupCount = cycleAtt.filter((st) => st === 'M').length;
  const totalAttended = attendedCount + makeupCount;

  const totalReceived = Array.isArray(payments)
    ? payments.reduce<number>((sum, p) => {
        const val = typeof p === 'number' ? p : parseFloat(String(p));
        return sum + (isNaN(val) ? 0 : val);
      }, 0)
    : typeof payments === 'number'
    ? payments
    : 0;

  // RULE: If student attended only 1 session and did not pay, the session does not count for school or teacher
  const isOneSessionUnpaid = totalAttended === 1 && totalReceived === 0;
  if (isOneSessionUnpaid) {
    return {
      firstActiveIndex: -1,
      countedSessions: 0,
      isSessionCounted: () => false
    };
  }

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

  const isSessionCounted = (sessionIdx: number): boolean => {
    if (sessionIdx >= cycleSessions) return false;
    if (hasSuspended) {
      const st = cycleAtt[sessionIdx];
      return st === 'P' || st === 'A';
    }
    if (firstActiveIndex === -1) return false;
    return sessionIdx >= firstActiveIndex;
  };

  return {
    firstActiveIndex,
    countedSessions,
    isSessionCounted
  };
}

/**
 * Parses a time string into minutes from midnight (0..1439).
 */
export function parseTimeMinutes(str?: string): number | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Decimal Excel time (e.g. 0.5833333)
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0 && num < 1 && trimmed.includes('.')) {
    return Math.round(num * 24 * 60) % 1440;
  }

  // Check 12-hour indicators
  const isPM = /pm|مساءً|م/i.test(trimmed);
  const isAM = /am|صباحاً|ص/i.test(trimmed);

  // Standard "HH:mm" or "HH:mm:ss" or "H:mm"
  const matchColon = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (matchColon) {
    let h = parseInt(matchColon[1], 10);
    const m = parseInt(matchColon[2], 10);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return (h * 60 + m) % 1440;
  }

  // French format "14h30" or "14h"
  const matchH = trimmed.match(/(\d{1,2})h(\d{0,2})/i);
  if (matchH) {
    let h = parseInt(matchH[1], 10);
    const m = matchH[2] ? parseInt(matchH[2], 10) : 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return (h * 60 + m) % 1440;
  }

  // Single hour digit (e.g. "14" or "2")
  const matchHour = trimmed.match(/^(\d{1,2})$/);
  if (matchHour) {
    let h = parseInt(matchHour[1], 10);
    if (isPM && h < 12) h += 12;
    return (h * 60) % 1440;
  }

  return null;
}

/**
 * Parses time window / duration from time range strings like:
 * "14:00 - 16:00" or "08:00 إلى 10:00" or "14:00"
 */
export function parseTimeWindow(timeStr?: string): { startMinutes: number; endMinutes: number } | null {
  if (!timeStr) return null;
  const formatted = formatGroupTime(timeStr);
  const parts = formatted.split(/[-–—]|إلى|to/i);

  if (parts.length >= 2) {
    const startM = parseTimeMinutes(parts[0]);
    const endM = parseTimeMinutes(parts[1]);
    if (startM !== null && endM !== null) {
      let finalEnd = endM;
      if (finalEnd <= startM && finalEnd + 720 > startM) {
        finalEnd += 720;
      }
      return { startMinutes: startM, endMinutes: finalEnd };
    }
  }

  // Single time (e.g. "14:00") -> default 2 hours duration (120 minutes)
  const single = parseTimeMinutes(formatted);
  if (single !== null) {
    return { startMinutes: single, endMinutes: single + 120 };
  }

  return null;
}

export interface ActiveGroupDetectionResult {
  activeGroup: GroupSheet | null;
  activeSessionIndex: number;
  timeWindowStr: string;
  statusLabel: string;
  matchingGroups: {
    group: GroupSheet;
    sessionIndex: number;
    timeWindowStr: string;
    status: string;
    startDiffMinutes: number;
  }[];
  allTodayGroups: {
    group: GroupSheet;
    sessionIndex: number;
    timeStr: string;
  }[];
}

/**
 * Smart Session Auto-Detection Engine:
 * Compares current time and day to daily schedule to find the currently active session without manual input.
 */
export function detectCurrentActiveGroupAndSession(
  groupData: Record<string, GroupSheet>,
  groupsMeta?: GroupMeta[],
  now: Date = new Date()
): ActiveGroupDetectionResult {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const allGroups = Object.values(groupData || {});

  const matchingGroups: ActiveGroupDetectionResult['matchingGroups'] = [];
  const allTodayGroups: ActiveGroupDetectionResult['allTodayGroups'] = [];

  for (const group of allGroups) {
    const meta = groupsMeta?.find((g) => g.id === group.groupId);
    const isToday = isGroupToday(meta || group, group, now);

    // Calculate the active session index for this group using smart default resolution
    const sessionIndex = getDefaultSessionIndex(group, now);

    const todayDayName = normalizeArabicText(getTodayArabicDayName(now));
    const day2Name = normalizeArabicText(meta?.day2 || group.day2 || '');
    const isDay2 = day2Name && (day2Name.includes(todayDayName) || todayDayName.includes(day2Name));
    const effectiveTime = (isDay2 ? (meta?.time2 || group.time2) : null) || meta?.time1 || group.time1 || '';

    if (isToday) {
      allTodayGroups.push({
        group,
        sessionIndex,
        timeStr: effectiveTime
      });
    }

    const window = parseTimeWindow(effectiveTime);
    if (window && isToday) {
      // User rule:
      // Group appears exactly an hour before the start time and an hour after the start time
      const scanWindowStart = window.startMinutes - 60;
      const scanWindowEnd = window.startMinutes + 60;

      if (currentMinutes >= scanWindowStart && currentMinutes <= scanWindowEnd) {
        let status = 'حصة جارية الآن';
        if (currentMinutes < window.startMinutes) {
          const diff = window.startMinutes - currentMinutes;
          status = `تبدأ بعد ${diff} دقيقة`;
        } else if (currentMinutes === window.startMinutes) {
          status = 'موعد بداية الحصة الآن';
        } else {
          const diff = currentMinutes - window.startMinutes;
          status = `بدأت منذ ${diff} دقيقة`;
        }

        const startDiffMinutes = Math.abs(currentMinutes - window.startMinutes);
        matchingGroups.push({
          group,
          sessionIndex,
          timeWindowStr: effectiveTime,
          status,
          startDiffMinutes
        });
      }
    }
  }

  // Sort matching groups by closest to current start time
  matchingGroups.sort((a, b) => a.startDiffMinutes - b.startDiffMinutes);

  const bestMatch = matchingGroups[0] || null;

  return {
    activeGroup: bestMatch ? bestMatch.group : null,
    activeSessionIndex: bestMatch ? bestMatch.sessionIndex : 0,
    timeWindowStr: bestMatch ? bestMatch.timeWindowStr : '',
    statusLabel: bestMatch ? bestMatch.status : 'لا يوجد أي فوج دراسي في هذا الوقت',
    matchingGroups,
    allTodayGroups
  };
}

/**
 * Generates a globally unique barcode string for students (Code128 compatible).
 * Ensures no duplicate exists in the database.
 */
export function generateUniqueStudentBarcode(
  existingBarcodesOrStudents: (string | StudentRecord | null | undefined)[],
  prefix: string = 'STU'
): string {
  const existingSet = new Set<string>();
  existingBarcodesOrStudents.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      existingSet.add(item.trim().toUpperCase());
    } else if (typeof item === 'object' && item.barcode) {
      existingSet.add(item.barcode.trim().toUpperCase());
    }
  });

  const yearPrefix = '27'; // BAC 2027 academic year prefix (STU-27...)

  // Attempt up to 50 times with random digits
  for (let i = 0; i < 50; i++) {
    const randomNum = Math.floor(100000 + Math.random() * 900000); // 6 digits
    const candidate = `${prefix}-${yearPrefix}${randomNum}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  // Fallback with high-resolution timestamp
  return `${prefix}-${yearPrefix}${Date.now().toString().slice(-6)}`;
}


