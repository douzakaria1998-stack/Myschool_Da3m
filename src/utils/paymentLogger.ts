import { CenterData, StudentRecord, GroupSheet } from '../types';
import { formatToYYYYMMDD, formatGroupTime } from './sessionUtils';
import { getScanLog } from './scanLogger';
import { normalizeArabicName } from './barcodeUtils';

/**
 * Payment Transaction Record
 * Captures detailed timestamped records for all payments, cash receipts, and installment updates
 */
export interface PaymentRecordItem {
  id: string;
  timestamp: number;          // Epoch milliseconds
  dateStr: string;            // 'YYYY/MM/DD'
  timeStr: string;            // 'HH:mm' or 'HH:mm:ss'
  hour: number;               // 0 - 23
  minute: number;             // 0 - 59
  groupId: string;
  groupSubject?: string;
  teacherName?: string;
  studentRowId: number;
  studentName: string;
  studentPhone?: string;
  studentBarcode?: string;
  sessionIndex: number;
  amount: number;
  totalFee?: number;
  totalReceived?: number;
  remainingDebt?: number;
  paymentMethod?: string;     // 'نقداً' | 'صك بريدي' | 'تحويل بنكي'
  source?: 'scanner' | 'payment_modal' | 'multi_group' | 'batch' | 'sheet' | 'session_record';
  receiptNo?: string;
  notes?: string;
}

export interface PaymentHourlySummary {
  payments: PaymentRecordItem[];
  totalAmount: number;
  uniqueStudentsCount: number;
  paymentsCount: number;
  teacherTotal: number;
  schoolEarnTotal: number;
}

export const PAYMENT_LOG_KEY = 'da3m_payment_transactions_v1';
const MAX_PAYMENT_LOG_ENTRIES = 5000;

/**
 * Automatically clean and eliminate duplicate payment transactions.
 * Preserves the earliest transaction or scanner-recorded transaction
 * and discards redundant batch-duplicated records.
 * Automatically saves the cleaned list back to localStorage to heal existing data.
 */
export function sanitizePaymentTransactions(
  transactions: PaymentRecordItem[],
  persistToStorage: boolean = true
): PaymentRecordItem[] {
  if (!transactions || transactions.length === 0) return [];

  // Sort chronologically ascending (oldest first) so original transactions take precedence
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  const result: PaymentRecordItem[] = [];

  for (const item of sorted) {
    // Check if an existing record is an exact duplicate of this item
    const isDup = result.some((existing) => {
      // Must match date, group, and session
      if (existing.dateStr !== item.dateStr) return false;
      if (existing.groupId !== item.groupId) return false;
      if (existing.sessionIndex !== item.sessionIndex) return false;

      // Check student match (by rowId or normalized Arabic name)
      const sameStudent =
        (existing.studentRowId && item.studentRowId && existing.studentRowId === item.studentRowId) ||
        (existing.studentName &&
          item.studentName &&
          normalizeArabicName(existing.studentName) === normalizeArabicName(item.studentName));
      if (!sameStudent) return false;

      // If amounts match, it is an exact duplicate
      if (existing.amount === item.amount) return true;

      // If recorded within 10 minutes of each other (e.g. batch save after scanner settlement)
      const timeDiff = Math.abs(item.timestamp - existing.timestamp);
      if (timeDiff < 10 * 60 * 1000) {
        if (existing.source === 'scanner' && item.source === 'batch') return true;
        if (existing.amount === item.amount) return true;
      }

      return false;
    });

    if (!isDup) {
      result.push(item);
    }
  }

  // Sort back to newest first (descending timestamp)
  result.sort((a, b) => b.timestamp - a.timestamp);

  // If items were pruned, heal localStorage
  if (persistToStorage && typeof window !== 'undefined' && result.length !== transactions.length) {
    try {
      localStorage.setItem(PAYMENT_LOG_KEY, JSON.stringify(result));
    } catch (e) {
      console.warn('Failed to update localStorage with sanitized transactions:', e);
    }
  }

  return result;
}

/**
 * Persistently record a payment transaction with duplicate guard
 */
export function recordPaymentTransaction(
  entry: Omit<PaymentRecordItem, 'id' | 'timestamp' | 'dateStr' | 'timeStr' | 'hour' | 'minute'> & {
    dateStr?: string;
    timeStr?: string;
  }
): PaymentRecordItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const now = new Date();
    const dateStr = entry.dateStr ? formatToYYYYMMDD(entry.dateStr) : formatToYYYYMMDD(now);
    
    let timeStr = entry.timeStr;
    let hour = now.getHours();
    let minute = now.getMinutes();

    if (timeStr) {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        hour = parseInt(parts[0], 10) || 0;
        minute = parseInt(parts[1], 10) || 0;
      }
    } else {
      timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const raw = localStorage.getItem(PAYMENT_LOG_KEY);
    const rawList: PaymentRecordItem[] = raw ? JSON.parse(raw) : [];
    const list = sanitizePaymentTransactions(rawList, false);

    // Duplicate prevention guard:
    // Check if an identical transaction for this student, group, session, and amount already exists
    const duplicate = list.find((t) => {
      if (t.dateStr !== dateStr) return false;
      if (t.groupId !== entry.groupId) return false;
      if (t.sessionIndex !== entry.sessionIndex) return false;
      const isSameStudent =
        (t.studentRowId && entry.studentRowId && t.studentRowId === entry.studentRowId) ||
        (t.studentName &&
          entry.studentName &&
          normalizeArabicName(t.studentName) === normalizeArabicName(entry.studentName));
      if (!isSameStudent) return false;
      return t.amount === entry.amount;
    });

    if (duplicate) {
      console.warn(
        `[paymentLogger] Prevented duplicate transaction for ${entry.studentName} (${entry.amount} دج) in ${entry.groupId} session ${entry.sessionIndex}`
      );
      return duplicate;
    }

    const newRecord: PaymentRecordItem = {
      ...entry,
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      dateStr,
      timeStr,
      hour,
      minute
    };

    list.unshift(newRecord);
    if (list.length > MAX_PAYMENT_LOG_ENTRIES) {
      list.length = MAX_PAYMENT_LOG_ENTRIES;
    }

    localStorage.setItem(PAYMENT_LOG_KEY, JSON.stringify(list));
    return newRecord;
  } catch (err) {
    console.error('Failed to record payment transaction:', err);
    return null;
  }
}

/**
 * Retrieve all logged payment transactions from localStorage,
 * automatically sanitizing and removing duplicates
 */
export function getPaymentTransactions(): PaymentRecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_LOG_KEY);
    const rawList: PaymentRecordItem[] = raw ? JSON.parse(raw) : [];
    return sanitizePaymentTransactions(rawList, true);
  } catch (err) {
    console.error('Failed to retrieve payment transactions:', err);
    return [];
  }
}

/**
 * Remove all logged payment transactions matching a student in a specific group
 */
export function removePaymentTransactionsForStudent(
  groupId: string,
  criteria: {
    rowId?: number;
    name?: string;
    barcode?: string;
  }
): PaymentRecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_LOG_KEY);
    const rawList: PaymentRecordItem[] = raw ? JSON.parse(raw) : [];
    const normTargetName = criteria.name ? normalizeArabicName(criteria.name) : '';

    const filtered = rawList.filter((t) => {
      if (t.groupId !== groupId) return true;
      if (criteria.rowId && t.studentRowId === criteria.rowId) return false;
      if (criteria.barcode && t.studentBarcode && t.studentBarcode === criteria.barcode) return false;
      if (normTargetName && t.studentName && normalizeArabicName(t.studentName) === normTargetName) return false;
      return true;
    });

    localStorage.setItem(PAYMENT_LOG_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Failed to remove payment transactions for student:', err);
    return [];
  }
}

function isSummaryRow(student: any, groupId?: string): boolean {
  if (!student) return false;
  const name = (student.name || '').trim();
  const phone = (student.phone || '').trim();
  if (name === 'GID' || phone === 'TID') return true;
  if (groupId && name.toUpperCase() === groupId.toUpperCase()) return true;
  if (name.includes('مجموع') || name.includes('GID')) return true;
  if (Array.isArray(student.attendance) && student.attendance.some((a: any) => typeof a === 'string' && a.includes('مجموع'))) {
    return true;
  }
  return false;
}

/**
 * Parse HH:mm or H:mm string into total minutes from 00:00
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  return 0;
}

/**
 * Master Aggregator: Collects today's/date-specific payments and filters them by exact hours range
 */
export function collectTodayAndHourlyPayments(
  data: CenterData,
  options?: {
    dateStr?: string;       // e.g. "2026/09/19"
    fromTime?: string;      // e.g. "13:00"
    toTime?: string;        // e.g. "15:00"
    groupId?: string;       // 'all' or specific e.g. 'BAC10'
  }
): PaymentHourlySummary {
  const targetDate = formatToYYYYMMDD(options?.dateStr || new Date());
  const fromTime = options?.fromTime || '00:00';
  const toTime = options?.toTime || '23:59';
  const targetGroupId = options?.groupId && options.groupId !== 'all' ? options.groupId : null;

  const fromMinutes = timeToMinutes(fromTime);
  const toMinutes = timeToMinutes(toTime);

  // 1. Fetch transactions from Supabase cloud data AND localStorage
  const cloudTransactions: PaymentRecordItem[] = Array.isArray((data as any)?.paymentTransactions)
    ? ((data as any).paymentTransactions as PaymentRecordItem[]).filter(
        (t) => t.dateStr === targetDate && (!targetGroupId || t.groupId === targetGroupId)
      )
    : [];

  const localTransactions = getPaymentTransactions().filter(
    (t) => t.dateStr === targetDate && (!targetGroupId || t.groupId === targetGroupId)
  );

  // Merge transactions from cloud and local without duplicates
  const transactionMap = new Map<string, PaymentRecordItem>();
  [...cloudTransactions, ...localTransactions].forEach((t) => {
    const key = `${t.groupId}_${t.studentRowId || normalizeArabicName(t.studentName)}_${t.sessionIndex}_${t.amount}_${t.timeStr || ''}`;
    if (!transactionMap.has(key)) {
      transactionMap.set(key, t);
    }
  });

  const combinedPayments: PaymentRecordItem[] = Array.from(transactionMap.values());

  // Map to prevent duplicate entries if a payment was already logged in real-time
  const loggedKeys = new Set(
    combinedPayments.map((t) => `${t.groupId}_${t.studentRowId}_${t.sessionIndex}`)
  );
  const loggedNameKeys = new Set(
    combinedPayments.map((t) => `${t.groupId}_${normalizeArabicName(t.studentName)}_${t.sessionIndex}`)
  );

  // 2. Fetch session payments recorded in groups that match targetDate
  const scanLogs = getScanLog();

  if (data && data.groupData) {
    Object.entries(data.groupData).forEach(([gid, group]) => {
      if (targetGroupId && gid !== targetGroupId) return;

      const sessionDates = group.sessionDates || [];
      const isVipGroup = Boolean(gid.startsWith('BACV') || group.isVip || (group.type && group.type.includes('10000')));
      const teacherRatio = isVipGroup ? 0.75 : 0.60;

      sessionDates.forEach((sDate, sIdx) => {
        const normDate = formatToYYYYMMDD(sDate);
        if (normDate !== targetDate) return;

        // Group met on this target date! Inspect all students with payments for this session
        (group.students || []).forEach((student) => {
          if (isSummaryRow(student, gid)) return;

          const paymentVal = Number(student.payments?.[sIdx]) || 0;
          if (paymentVal <= 0) return;

          const key = `${gid}_${student.rowId}_${sIdx}`;
          const nameKey = `${gid}_${normalizeArabicName(student.name)}_${sIdx}`;
          if (loggedKeys.has(key) || loggedNameKeys.has(nameKey)) {
            // Already logged via real-time transaction logger
            return;
          }

          // Determine exact scan time if student scanned today
          const matchingScan = scanLogs.find(
            (sl) =>
              sl.groupId === gid &&
              sl.sessionIndex === sIdx &&
              (sl.studentRowId === student.rowId ||
                (student.barcode && sl.barcode && sl.barcode.toUpperCase() === student.barcode.toUpperCase()) ||
                sl.studentName === student.name)
          );

          let resolvedTimeStr = '';
          let resolvedHour = 8;
          let resolvedMinute = 0;
          let resolvedTimestamp = 0;

          if (matchingScan && matchingScan.timeStr) {
            resolvedTimeStr = matchingScan.timeStr;
            resolvedTimestamp = matchingScan.timestamp;
            const parts = matchingScan.timeStr.split(':');
            if (parts.length >= 2) {
              resolvedHour = parseInt(parts[0], 10) || 0;
              resolvedMinute = parseInt(parts[1], 10) || 0;
            }
          } else {
            // Default to group's scheduled start time
            const rawGrpTime = formatGroupTime(group.time1 || group.time2 || '08:00');
            resolvedTimeStr = rawGrpTime || '08:00';
            const parts = resolvedTimeStr.split(':');
            if (parts.length >= 2) {
              resolvedHour = parseInt(parts[0], 10) || 0;
              resolvedMinute = parseInt(parts[1], 10) || 0;
            }
          }

          combinedPayments.push({
            id: `session-${gid}-${student.rowId}-${sIdx}`,
            timestamp: resolvedTimestamp || Date.now(),
            dateStr: targetDate,
            timeStr: resolvedTimeStr,
            hour: resolvedHour,
            minute: resolvedMinute,
            groupId: gid,
            groupSubject: group.subject || '',
            teacherName: group.teacherName || '',
            studentRowId: student.rowId,
            studentName: student.name,
            studentPhone: student.phone || '',
            studentBarcode: student.barcode || '',
            sessionIndex: sIdx,
            amount: paymentVal,
            totalFee: student.fee || 0,
            totalReceived: student.totalReceived || 0,
            remainingDebt: student.debt || 0,
            paymentMethod: 'نقداً',
            source: 'session_record'
          });
        });
      });
    });
  }

  // 3. Defensive Deduplication:
  // Ensure that no student has duplicate transactions for the same session
  const chronoSorted = [...combinedPayments].sort((a, b) => a.timestamp - b.timestamp);
  const dedupedPayments: PaymentRecordItem[] = [];

  for (const item of chronoSorted) {
    const isDup = dedupedPayments.some((existing) => {
      if (existing.groupId !== item.groupId) return false;
      if (existing.sessionIndex !== item.sessionIndex) return false;
      const sameStudent =
        (existing.studentRowId && item.studentRowId && existing.studentRowId === item.studentRowId) ||
        normalizeArabicName(existing.studentName) === normalizeArabicName(item.studentName);
      if (!sameStudent) return false;

      // Exact amount match is definitely a duplicate
      if (existing.amount === item.amount) return true;

      // Check against student's session payment in group sheet
      const grp = data?.groupData?.[item.groupId];
      const stu = grp?.students?.find(
        (s) => s.rowId === item.studentRowId || normalizeArabicName(s.name) === normalizeArabicName(item.studentName)
      );
      const sheetPay = Number(stu?.payments?.[item.sessionIndex]) || 0;
      if (sheetPay > 0 && existing.amount >= sheetPay) {
        return true; // Already covered by earlier transaction
      }

      return false;
    });

    if (!isDup) {
      dedupedPayments.push(item);
    }
  }

  // 4. Filter by Time Window (fromTime to toTime)
  const filteredPayments = dedupedPayments.filter((p) => {
    const itemMinutes = p.hour * 60 + p.minute;
    return itemMinutes >= fromMinutes && itemMinutes <= toMinutes;
  });

  // Sort payments chronologically (newest first, or by hour/minute)
  filteredPayments.sort((a, b) => {
    const minA = a.hour * 60 + a.minute;
    const minB = b.hour * 60 + b.minute;
    if (minA !== minB) return minB - minA; // Newest first
    return b.timestamp - a.timestamp;
  });

  // 4. Compute KPIs
  const uniqueStudents = new Set<string>();
  let totalAmount = 0;
  let teacherTotal = 0;
  let schoolEarnTotal = 0;

  filteredPayments.forEach((item) => {
    totalAmount += item.amount;
    uniqueStudents.add(`${item.groupId}_${item.studentRowId}_${item.studentName}`);

    const isVip = Boolean(
      item.groupId.startsWith('BACV') ||
      item.groupId.includes('VIP') ||
      data.groupData[item.groupId]?.isVip ||
      data.groupData[item.groupId]?.type?.includes('10000')
    );
    const teacherRatio = isVip ? 0.75 : 0.60;
    const student = data.groupData[item.groupId]?.students?.find((s) => s.rowId === item.studentRowId);
    const tShare = student?.discount === '0' ? 0 : Math.round(item.amount * teacherRatio);
    teacherTotal += tShare;
    schoolEarnTotal += item.amount - tShare;
  });

  return {
    payments: filteredPayments,
    totalAmount,
    uniqueStudentsCount: uniqueStudents.size,
    paymentsCount: filteredPayments.length,
    teacherTotal,
    schoolEarnTotal
  };
}
