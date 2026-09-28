// Student Central Payment Account & Attendance-Based Financial Utilities
import { CenterData, StudentRecord, GroupSheet, StudentPaymentAccount, StudentRecoverySession, StudentAccountTransaction, PaymentTransactionType } from '../types';
import { normalizeArabicName } from './barcodeUtils';
import { isSummaryRow, isSameSubject, isGroupEnded } from './sessionUtils';
import { getPaymentTransactions, PaymentRecordItem, recordPaymentTransaction } from './paymentLogger';

/**
 * Normalizes student identifier for grouping records
 */
export function getStudentIdentifier(name: string, barcode?: string): string {
  if (barcode && barcode.trim()) {
    return barcode.trim().toUpperCase();
  }
  return normalizeArabicName(name || '');
}

/**
 * Builds the comprehensive Student Payment Account across all groups and transactions
 */
export function getStudentPaymentAccount(
  studentName: string,
  barcode: string | undefined,
  data: CenterData
): StudentPaymentAccount {
  const normName = normalizeArabicName(studentName || '');
  const barcodeUpper = (barcode || '').trim().toUpperCase();

  const currentGroups: string[] = [];
  const previousGroups: string[] = [];
  const allEnrollments: { groupId: string; groupSheet: GroupSheet; student: StudentRecord }[] = [];

  // 1. Find all student enrollments across groups
  Object.entries(data.groupData || {}).forEach(([gid, gSheet]) => {
    if (!gSheet || !Array.isArray(gSheet.students)) return;

    const match = gSheet.students.find(
      (s) =>
        !isSummaryRow(s, gid) &&
        ((barcodeUpper && s.barcode && s.barcode.trim().toUpperCase() === barcodeUpper) ||
          (s.name && normalizeArabicName(s.name) === normName))
    );

    if (match) {
      allEnrollments.push({ groupId: gid, groupSheet: gSheet, student: match });

      // Check if group is active or previous
      const isInactiveGroup = gSheet.status === 'inactive';
      const hasChangedOut = (match.attendance || []).some((st) => st === 'CH');

      if (isInactiveGroup || hasChangedOut) {
        if (!previousGroups.includes(gid)) previousGroups.push(gid);
      } else {
        if (!currentGroups.includes(gid)) currentGroups.push(gid);
      }
    }
  });

  // 2. Count sessions across all enrollments
  let totalPaid = 0;
  let amountUsed = 0;
  let countablePSessions = 0;
  let nonCountableSessions = 0;
  const rawRecoveryList: StudentRecoverySession[] = [];
  const coveredSubjectsCount: Record<string, number> = {};

  allEnrollments.forEach(({ groupId, groupSheet, student }) => {
    const cycleSessions = groupSheet.sessionDates?.length || groupSheet.sessionCount || 4;
    const sessionDates = groupSheet.sessionDates || [];
    const att = (student.attendance || []).slice(0, cycleSessions);

    // Track total received in this group
    const groupPaid = (student.payments || []).reduce<number>((sum, p) => {
      const val = typeof p === 'number' ? p : parseFloat(String(p));
      return sum + (isNaN(val) ? 0 : val);
    }, 0) || student.totalReceived || 0;

    totalPaid += groupPaid;

    // Required fee in this group
    const groupFee = student.fee || 0;
    // Amount allocated to this group's countable sessions
    const groupUsed = Math.min(groupPaid, groupFee);
    amountUsed += groupUsed;

    // Scan attendance codes
    att.forEach((st, sIdx) => {
      const isPresent = st === 'P' || st === 'C' || st === 'ح';
      const isMakeup = st === 'M' || st === 'م';
      const isAbsent = st === 'A' || st === 'غ';
      const isNew = st === 'N';
      const isChange = st === 'CH';

      if (isPresent || isMakeup) {
        countablePSessions++;
        if (st === 'C' || isMakeup) {
          const sub = (groupSheet.subject || '').trim();
          coveredSubjectsCount[sub] = (coveredSubjectsCount[sub] || 0) + 1;
        }
      } else if (isAbsent || isNew || isChange) {
        nonCountableSessions++;
        if (isAbsent) {
          rawRecoveryList.push({
            groupId,
            sessionIndex: sIdx,
            sessionNumber: sIdx + 1,
            subject: groupSheet.subject || '',
            teacherName: groupSheet.teacherName || '',
            dateStr: sessionDates[sIdx] || `حصة ${sIdx + 1}`,
            status: st as 'A' | 'غ',
            isRecovered: false
          });
        }
      }
    });
  });

  // Available balance is money paid in excess of required fees
  const availableBalance = Math.max(0, totalPaid - amountUsed);

  // Link recoveries: if student attended a 'C' (Cover) session in the same subject, mark missed session recovered
  const recoveryDetails: StudentRecoverySession[] = [];
  const subjectCoverPool = { ...coveredSubjectsCount };

  rawRecoveryList.forEach((rec) => {
    const sub = rec.subject.trim();
    if (subjectCoverPool[sub] && subjectCoverPool[sub] > 0) {
      subjectCoverPool[sub]--;
      recoveryDetails.push({ ...rec, isRecovered: true });
    } else {
      recoveryDetails.push({ ...rec, isRecovered: false });
    }
  });

  const activeRecoveryCount = recoveryDetails.filter((r) => !r.isRecovered).length;

  // 3. Reconstruct Transaction Ledger
  const auditLogs = getPaymentTransactions();
  const matchingLogs = auditLogs.filter(
    (item) =>
      (barcodeUpper && item.studentBarcode && item.studentBarcode.trim().toUpperCase() === barcodeUpper) ||
      (item.studentName && normalizeArabicName(item.studentName) === normName)
  );

  // Sort ascending by timestamp to calculate running balance
  matchingLogs.sort((a, b) => a.timestamp - b.timestamp);

  const transactions: StudentAccountTransaction[] = [];
  let runningBalance = 0;

  if (matchingLogs.length > 0) {
    matchingLogs.forEach((log) => {
      const isCreditTransfer = log.notes?.includes('تحويل رصيد') || log.source === 'multi_group';
      const isRefund = log.amount < 0 || log.notes?.includes('استرجاع');
      let type: PaymentTransactionType = 'PAYMENT';

      if (isCreditTransfer) type = 'TRANSFER';
      else if (isRefund) type = 'REFUND';
      else if (log.amount > 0) type = 'PAYMENT';

      runningBalance += log.amount;

      transactions.push({
        id: log.id,
        timestamp: log.timestamp,
        dateStr: log.dateStr,
        timeStr: log.timeStr,
        type,
        amount: log.amount,
        description: log.notes || `تسديد في فوج ${log.groupId} (${log.groupSubject || 'حصة'})`,
        groupId: log.groupId,
        sessionIndex: log.sessionIndex,
        balanceAfter: runningBalance
      });
    });
  } else {
    // If no individual logs found in audit, create initial baseline transaction from total paid
    if (totalPaid > 0) {
      transactions.push({
        id: `tx-init-${Date.now()}`,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('ar-DZ'),
        timeStr: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
        type: 'PAYMENT',
        amount: totalPaid,
        description: `إجمالي المدفوعات المسجلة (${allEnrollments.map((e) => e.groupId).join(', ')})`,
        balanceAfter: totalPaid
      });
    }
  }

  // If there's an amount used for sessions, add allocation transaction entry
  if (amountUsed > 0 && transactions.length > 0) {
    transactions.push({
      id: `tx-alloc-${Date.now()}`,
      timestamp: Date.now() + 1,
      dateStr: new Date().toLocaleDateString('ar-DZ'),
      timeStr: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
      type: 'SESSION_ALLOCATION',
      amount: -amountUsed,
      description: `استهلاك الحصص المكتملة (${countablePSessions} حصص)`,
      balanceAfter: availableBalance
    });
  }

  // Reverse so newest transactions are first for UI display
  transactions.sort((a, b) => b.timestamp - a.timestamp);

  return {
    studentKey: getStudentIdentifier(studentName, barcode),
    studentName,
    phone: allEnrollments[0]?.student.phone,
    barcode,
    totalPaid,
    amountUsed,
    availableBalance,
    countablePSessions,
    nonCountableSessions,
    recoverySessions: activeRecoveryCount,
    recoveryDetails,
    currentGroups,
    previousGroups,
    transactions
  };
}

/**
 * Record a manual adjustment, credit addition, or refund for a student
 */
export function recordStudentAccountAdjustment(
  student: StudentRecord,
  groupId: string,
  type: 'ADJUSTMENT' | 'REFUND' | 'CREDIT',
  amount: number,
  notes: string,
  groupSubject?: string,
  teacherName?: string
): void {
  const signedAmount = type === 'REFUND' ? -Math.abs(amount) : Math.abs(amount);
  recordPaymentTransaction({
    groupId,
    groupSubject,
    teacherName,
    studentRowId: student.rowId,
    studentName: student.name,
    studentPhone: student.phone,
    studentBarcode: student.barcode,
    sessionIndex: 0,
    amount: signedAmount,
    source: 'payment_modal',
    notes: `[${type}] ${notes}`
  });
}

export interface StudentCreditGroupInfo {
  groupId: string;
  subject: string;
  teacherName?: string;
  fee: number;
  totalReceived: number;
  availableCredit: number;
  isSameSubject: boolean;
  isEnded: boolean;
  studentRowId: number;
}

/**
 * Finds all groups across the center where the student has extra surplus money (credit).
 * If targetGroupId is provided, flags whether each credit is in the same subject.
 * Automatically prioritizes ended/inactive courses and same-subject courses.
 */
export function getStudentAvailableCredits(
  studentName: string,
  barcode: string | undefined,
  data: CenterData,
  targetGroupId?: string
): StudentCreditGroupInfo[] {
  const normName = normalizeArabicName(studentName || '');
  const barcodeUpper = (barcode || '').trim().toUpperCase();
  const targetGroup = targetGroupId ? data.groupData[targetGroupId] : undefined;
  const targetSubject = targetGroup?.subject || data.groups?.find((g) => g.id === targetGroupId)?.subject || '';

  const results: StudentCreditGroupInfo[] = [];

  Object.entries(data.groupData || {}).forEach(([gid, gSheet]) => {
    if (!gSheet || !Array.isArray(gSheet.students)) return;
    if (targetGroupId && gid === targetGroupId) return;

    const match = gSheet.students.find(
      (s) =>
        !isSummaryRow(s, gid) &&
        ((barcodeUpper && s.barcode && s.barcode.trim().toUpperCase() === barcodeUpper) ||
          (s.name && normalizeArabicName(s.name) === normName))
    );

    if (match) {
      const totalPaid =
        (match.payments || []).reduce<number>((sum, p) => {
          const val = typeof p === 'number' ? p : parseFloat(String(p));
          return sum + (isNaN(val) ? 0 : val);
        }, 0) || match.totalReceived || 0;

      const fee = match.fee || 0;
      const credit = Math.max(0, totalPaid - fee);

      if (credit > 0) {
        const groupMeta = data.groups?.find((g) => g.id === gid);
        const isEnded = gSheet.status === 'inactive' || isGroupEnded(gSheet, groupMeta, data.pricingTiers);
        const sheetSubject = gSheet.subject || groupMeta?.subject || '';

        results.push({
          groupId: gid,
          subject: sheetSubject,
          teacherName: gSheet.teacherName || groupMeta?.teacherName,
          fee,
          totalReceived: totalPaid,
          availableCredit: credit,
          isSameSubject: isSameSubject(sheetSubject, targetSubject),
          isEnded,
          studentRowId: match.rowId
        });
      }
    }
  });

  // Prioritization order:
  // 1. Same subject first (true before false)
  // 2. Ended/inactive courses first (old finished course first, as requested: "the first course has ended and the second is new, and he has extra money in the old subject")
  // 3. Higher available credit first
  results.sort((a, b) => {
    if (a.isSameSubject !== b.isSameSubject) return a.isSameSubject ? -1 : 1;
    if (a.isEnded !== b.isEnded) return a.isEnded ? -1 : 1;
    return b.availableCredit - a.availableCredit;
  });

  return results;
}

export interface StudentDebtGroupInfo {
  groupId: string;
  subject: string;
  teacherName?: string;
  fee: number;
  totalReceived: number;
  debt: number;
  isSameSubject: boolean;
  isEnded: boolean;
  studentRowId: number;
}

export interface StudentSubjectDebtSummary {
  currentGroupDebt: number;
  lastGroupDebt: number;
  lastGroupId?: string;
  lastGroupSubject?: string;
  allPreviousSameSubjectDebt: number;
  previousSameSubjectGroups: StudentDebtGroupInfo[];
  totalSubjectDebt: number;
}

/**
 * Finds debts of the student in other groups, prioritizing the last/ended group of the SAME subject.
 * Returns a detailed summary including the last group debt, all same-subject debts, and total combined debt.
 */
export function getStudentPreviousGroupDebts(
  studentName: string,
  barcode: string | undefined,
  data: CenterData,
  currentGroupId: string,
  currentDebt?: number
): StudentSubjectDebtSummary {
  const normName = normalizeArabicName(studentName || '');
  const barcodeUpper = (barcode || '').trim().toUpperCase();
  const currentGroup = data.groupData[currentGroupId];
  const currentSubject = currentGroup?.subject || data.groups?.find((g) => g.id === currentGroupId)?.subject || '';

  const debtGroups: StudentDebtGroupInfo[] = [];

  Object.entries(data.groupData || {}).forEach(([gid, gSheet]) => {
    if (!gSheet || !Array.isArray(gSheet.students)) return;
    if (gid === currentGroupId) return;

    const match = gSheet.students.find(
      (s) =>
        !isSummaryRow(s, gid) &&
        ((barcodeUpper && s.barcode && s.barcode.trim().toUpperCase() === barcodeUpper) ||
          (s.name && normalizeArabicName(s.name) === normName))
    );

    if (match) {
      const totalPaid =
        (match.payments || []).reduce<number>((sum, p) => {
          const val = typeof p === 'number' ? p : parseFloat(String(p));
          return sum + (isNaN(val) ? 0 : val);
        }, 0) || match.totalReceived || 0;

      const fee = match.fee || 0;
      const debt = Math.max(0, fee - totalPaid);

      if (debt > 0) {
        const groupMeta = data.groups?.find((g) => g.id === gid);
        const isEnded = gSheet.status === 'inactive' || isGroupEnded(gSheet, groupMeta, data.pricingTiers);
        const sheetSubject = gSheet.subject || groupMeta?.subject || '';

        debtGroups.push({
          groupId: gid,
          subject: sheetSubject,
          teacherName: gSheet.teacherName || groupMeta?.teacherName,
          fee,
          totalReceived: totalPaid,
          debt,
          isSameSubject: isSameSubject(sheetSubject, currentSubject),
          isEnded,
          studentRowId: match.rowId
        });
      }
    }
  });

  // Filter same subject debts
  const sameSubjectDebts = debtGroups.filter((g) => g.isSameSubject);

  // Sort same subject debts to find the "last group":
  // 1. Ended / inactive groups first (the previous concluded course)
  // 2. Highest debt or recent
  sameSubjectDebts.sort((a, b) => {
    if (a.isEnded !== b.isEnded) return a.isEnded ? -1 : 1;
    return b.debt - a.debt;
  });

  const lastGroup = sameSubjectDebts[0];
  const lastGroupDebt = lastGroup?.debt || 0;
  const allPreviousSameSubjectDebt = sameSubjectDebts.reduce((sum, g) => sum + g.debt, 0);

  // If currentDebt was not passed in, calculate it from currentGroup
  let resolvedCurrentDebt = currentDebt;
  if (resolvedCurrentDebt === undefined && currentGroup) {
    const curMatch = currentGroup.students?.find(
      (s) =>
        !isSummaryRow(s, currentGroupId) &&
        ((barcodeUpper && s.barcode && s.barcode.trim().toUpperCase() === barcodeUpper) ||
          (s.name && normalizeArabicName(s.name) === normName))
    );
    if (curMatch) {
      const curPaid = (curMatch.payments || []).reduce<number>((sum, p) => sum + (Number(p) || 0), 0) || curMatch.totalReceived || 0;
      resolvedCurrentDebt = Math.max(0, (curMatch.fee || 0) - curPaid);
    } else {
      resolvedCurrentDebt = 0;
    }
  }

  const effectiveCurrentDebt = resolvedCurrentDebt || 0;

  return {
    currentGroupDebt: effectiveCurrentDebt,
    lastGroupDebt,
    lastGroupId: lastGroup?.groupId,
    lastGroupSubject: lastGroup?.subject,
    allPreviousSameSubjectDebt,
    previousSameSubjectGroups: sameSubjectDebts,
    totalSubjectDebt: effectiveCurrentDebt + allPreviousSameSubjectDebt
  };
}

