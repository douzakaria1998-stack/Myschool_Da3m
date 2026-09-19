import { CenterData, StudentRecord, GroupSheet } from '../types';
import { formatToYYYYMMDD, formatGroupTime } from './sessionUtils';
import { getScanLog } from './scanLogger';

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
 * Persistently record a payment transaction
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
    const list: PaymentRecordItem[] = raw ? JSON.parse(raw) : [];

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
 * Retrieve all logged payment transactions from localStorage
 */
export function getPaymentTransactions(): PaymentRecordItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to retrieve payment transactions:', err);
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

  // 1. Fetch real-time logged transactions from localStorage
  const loggedTransactions = getPaymentTransactions().filter(
    (t) => t.dateStr === targetDate && (!targetGroupId || t.groupId === targetGroupId)
  );

  const combinedPayments: PaymentRecordItem[] = [...loggedTransactions];

  // Map to prevent duplicate entries if a payment was already logged in real-time
  const loggedKeys = new Set(
    loggedTransactions.map((t) => `${t.groupId}_${t.studentRowId}_${t.sessionIndex}`)
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
          if (loggedKeys.has(key)) {
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

  // 3. Filter by Time Window (fromTime to toTime)
  const filteredPayments = combinedPayments.filter((p) => {
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
