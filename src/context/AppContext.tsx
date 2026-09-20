'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import initialSeedData from '../data/initialData.json';
import { supabase } from '../lib/supabaseClient';
import {
  CenterData,
  StudentRecord,
  GroupSheet,
  AttendanceStatus,
  DiscountType,
  Teacher,
  TeacherPaymentRecord,
  GroupMeta,
  PricingTier,
  QueuedReceipt,
  CenterStatsFilter,
  CenterStatsResult
} from '../types';
import {
  isSummaryRow,
  formatToYYYYMMDD,
  generateSessionDates,
  isVipGroupId,
  isValidGroupId,
  getNextGroupId,
  getStudentSessionInfo,
  generateUniqueStudentBarcode,
  isGroupActive,
  isGroupEnded,
  getNextSessionDateAfter,
  getUpcomingSessionDate,
  sortGroupsActiveFirstOldToNew
} from '../utils/sessionUtils';
import { normalizeArabicName } from '../utils/barcodeUtils';
import { recordPaymentTransaction } from '../utils/paymentLogger';

interface AppContextType {
  data: CenterData;
  isLoading: boolean;
  selectedGroup: string;
  setSelectedGroup: (id: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  lang: 'ar' | 'en';
  toggleLang: () => void;
  // Cloud Sync
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: Date | null;
  syncNow: () => Promise<void>;
  // Barcode Scanner, Cover & Print Queue Actions
  printQueue: QueuedReceipt[];
  addToPrintQueue: (receipt: QueuedReceipt) => void;
  removeFromPrintQueue: (id: string) => void;
  clearPrintQueue: () => void;
  endSessionAndMarkAbsent: (groupId: string, sessionIndex: number) => { presentCount: number; makeupCount: number; absentCount: number };
  recordCoverAttendance: (
    activeGroupId: string,
    originalGroupId: string,
    studentRowId: number,
    sessionIndex: number,
    paymentAmount?: number,
    targetOriginalSessionIdx?: number
  ) => void;
  // Student Actions
  cycleAttendance: (groupId: string, rowId: number, sessionIndex: number) => AttendanceStatus;
  updateAttendance: (groupId: string, rowId: number, sessionIndex: number, status: AttendanceStatus) => void;
  recordAttendanceAndPayment: (
    groupId: string,
    rowId: number,
    sessionIndex: number,
    status: AttendanceStatus,
    paymentAmount?: number
  ) => void;
  markAllPresent: (groupId: string, sessionIndex: number, studentRowIds?: number[]) => void;
  updatePayment: (groupId: string, rowId: number, paymentIndex: number, amount: number | string) => void;
  updateStudentFullFinances: (groupId: string, rowId: number, payments: (number | string)[], discount?: DiscountType) => void;
  batchUpdateSessionPayments: (groupId: string, sessionIndex: number, studentPayments: { rowId: number; amount: number | string }[]) => void;
  batchUpdateAllSessionsPayments: (groupId: string, updates: { rowId: number; payments: (number | string)[] }[]) => void;
  updateDiscount: (groupId: string, rowId: number, discount: DiscountType) => void;
  addStudent: (
    groupId: string,
    student: { name: string; phone: string; discount?: DiscountType; barcode?: string }
  ) => StudentRecord | null;
  enrollStudentMultiGroups: (
    studentInfo: { name: string; phone: string; discount?: DiscountType; barcode?: string },
    enrollments: { groupId: string; paymentAmount: number | string }[]
  ) => { groupId: string; rowId: number; fee: number; paid: number; debt: number }[];
  recordMultiGroupPayment: (
    studentIdentifier: { name: string; barcode?: string; phone?: string; discount?: DiscountType },
    payments: { groupId: string; paymentAmount: number | string }[]
  ) => { groupId: string; rowId: number; fee: number; paidNow: number; totalReceived: number; debt: number }[];
  deleteStudent: (groupId: string, rowId: number) => void;
  restoreStudent: (archiveId: string) => boolean;
  clearRecycleBin: () => void;
  transferStudent: (fromGroupId: string, toGroupId: string, studentRowId: number) => boolean;
  updateStudent: (groupId: string, rowId: number, fields: Partial<StudentRecord>) => void;
  // Group & Teacher Actions
  addGroup: (group: GroupMeta) => void;
  renewGroupWithStudents: (
    sourceGroupId: string,
    newGroupId: string,
    selectedStudentRowIds: number[],
    customGroupFields?: Partial<GroupMeta>
  ) => void;
  updateGroup: (groupId: string, fields: Partial<GroupMeta>) => void;
  renameGroup: (oldId: string, newId: string) => boolean;
  deleteGroup: (groupId: string) => void;
  updateGroupFinances: (groupId: string, finances: { studentFee: number; teacherPayPerStudent: number; schoolSharePerStudent: number }) => void;
  addTeacher: (teacher: Teacher) => void;
  updateTeacher: (id: string, fields: Partial<Teacher>) => void;
  payTeacher: (teacherId: string, amount: number, paymentMethod?: string, notes?: string) => TeacherPaymentRecord | null;
  deleteTeacherPayment: (teacherId: string, paymentId: string) => void;
  updatePricingTier: (id: string, fields: Partial<PricingTier>) => void;
  // Center Actions
  updateSessionDates: (groupId: string, dates: string[]) => void;
  updateGroupSessionCount: (groupId: string, newCount: number) => void;
  resetToDefault: () => void;
  exportDataJson: () => void;
  importDataJson: (jsonData: string) => boolean;
  getGroupStats: (groupId: string) => {
    studentCount: number;
    totalExpected: number;
    totalReceived: number;
    totalTeacherPay: number;
    totalSchoolEarn: number;
    totalDebt: number;
    attendanceRate: number;
  };
  getCenterStats: (filter?: CenterStatsFilter) => CenterStatsResult;
  updateCenterSettings: (settings: Partial<{ centerName: string; cycle: string; academicYear: string }>) => void;
}

const STORAGE_KEY = 'da3m_center_management_data_v1';
const THEME_KEY = 'da3m_theme';
const LANG_KEY = 'da3m_lang';
const UNSYNCED_CHANGES_KEY = 'da3m_has_unsynced_changes_v1';
const LAST_LOCAL_EDIT_KEY = 'da3m_last_local_edit_time_v1';

// Pure helper to recompute student finances according to pricing tier or group custom finances
export const calcStudentFinancesPure = (
  student: StudentRecord,
  groupType: string,
  pricingTiers: PricingTier[],
  groupFinances?: {
    studentFee?: number;
    teacherPayPerStudent?: number;
    schoolSharePerStudent?: number;
    sessionCount?: number;
    isVip?: boolean;
    groupId?: string;
    status?: 'active' | 'inactive';
    sessionDates?: string[];
    students?: StudentRecord[];
  }
): StudentRecord => {
  const isVipGroup =
    Boolean(groupFinances?.isVip) ||
    Boolean(groupFinances?.groupId && (groupFinances.groupId.toUpperCase().startsWith('BACV') || groupFinances.groupId.toUpperCase().includes('VIP'))) ||
    Boolean(groupType && groupType.includes('10000'));

  const effectiveGroupType = groupType || (isVipGroup ? '4-10000' : '4-2500');

  const tier = pricingTiers?.find((t) => t.id === effectiveGroupType) || {
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

  // Sum up payments
  const totalReceived = (student.payments || []).reduce<number>((sum, p) => {
    const val = typeof p === 'number' ? p : parseFloat(String(p));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Attendance counts
  const cycleAttendance = (student.attendance || []).slice(0, cycleSessions);
  const attendedCount = cycleAttendance.filter((a) => a === 'P' || a === 'C' || a === 'ح').length;
  const makeupCount = cycleAttendance.filter((a) => a === 'M' || a === 'م').length;
  const totalAttendance = attendedCount + makeupCount;

  // Check if group has ended all sessions in its cycle
  const groupEnded = Boolean(
    isGroupEnded(groupFinances, undefined, pricingTiers) ||
    (
      Array.isArray(student.attendance) &&
      student.attendance.length >= cycleSessions &&
      ['P', 'A', 'M', 'S', 'ح', 'غ', 'م'].includes(String(student.attendance[cycleSessions - 1] || '').trim().toUpperCase())
    )
  );

  const isOneSessionUnpaid = groupEnded && totalAttendance === 1 && totalReceived === 0 && student.discount !== 'تعويض';

  if (isOneSessionUnpaid) {
    return {
      ...student,
      fee: 0,
      totalReceived: 0,
      teacherPay: 0,
      schoolEarn: 0,
      debt: 0,
      totalAttendance
    };
  }

  // Calculate session info
  const sessionInfo = getStudentSessionInfo(student.attendance, cycleSessions, totalReceived, groupEnded);
  const countedSessions = sessionInfo.countedSessions > 0 ? sessionInfo.countedSessions : cycleSessions;

  // Fee calculation based on discount and counted sessions
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

  // If student has paid more than calculated fee, fee cannot be less than total received
  if (totalReceived > fee && student.discount !== '0') {
    fee = totalReceived;
  }

  const teacherRatio = isVipGroup ? 0.75 : 0.60;
  const teacherPay = student.discount === '0' ? 0 : Math.round(fee * teacherRatio);
  const schoolEarn = Math.max(0, fee - teacherPay);
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
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// Non-destructive Two-Way Union Merge:
// Guarantees newly added students, newly registered groups, payments, and attendance
// are NEVER erased by a stale or concurrent remote snapshot!
function mergeAttendanceSafely(remote: CenterData, local: CenterData): CenterData {
  if (!remote || !remote.groupData) return local || remote;
  if (!local || !local.groupData) return remote;

  const merged: CenterData = {
    ...remote,
    groups: [...(remote.groups || [])],
    groupData: { ...remote.groupData }
  };

  // 1. Preserve any local groups that are missing in remote
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

    const matchedLocalRowIds = new Set<number>();
    const matchedLocalNames = new Set<string>();
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

      // Merge attendance: keep marked attendance ('P', 'M', 'ح', 'م')
      const newAttendance = [...(rStudent.attendance || [])];
      (lStudent.attendance || []).forEach((lStatus, idx) => {
        const cleanL = (lStatus || '').trim().toUpperCase();
        const cleanR = (newAttendance[idx] || '').trim().toUpperCase();
        if ((cleanL === 'P' || cleanL === 'M' || cleanL === 'ح' || cleanL === 'م') && !cleanR) {
          while (newAttendance.length <= idx) newAttendance.push('');
          newAttendance[idx] = cleanL;
          studentModified = true;
        }
      });

      // Merge payments: keep highest payment recorded for each session
      const maxSessions = Math.max(rStudent.payments?.length || 0, lStudent.payments?.length || 0, 4);
      const newPayments: (number | string)[] = [];
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

      // Preserve phone, barcode, and discount
      const phone = rStudent.phone?.trim() || lStudent.phone?.trim() || '';
      const barcode = rStudent.barcode?.trim() || lStudent.barcode?.trim() || '';
      const discount = (lStudent.discount !== undefined && lStudent.discount !== '1') ? lStudent.discount : (rStudent.discount || '1');

      if (phone !== rStudent.phone || barcode !== rStudent.barcode || discount !== rStudent.discount) {
        studentModified = true;
      }

      if (studentModified) {
        hasDifferences = true;
        const updatedStudentRaw: StudentRecord = {
          ...rStudent,
          phone,
          barcode,
          discount,
          attendance: newAttendance,
          payments: newPayments
        };
        return calcStudentFinancesPure(
          updatedStudentRaw,
          remoteGroup.type || '4-2500',
          merged.pricingTiers || local.pricingTiers,
          remoteGroup
        );
      }
      return rStudent;
    });

    // CRITICAL: Append any local student that does NOT exist in remote!
    // (This guarantees newly added/enrolled students are NEVER lost when remote arrives)
    const localOnlyStudents: StudentRecord[] = [];
    localGroup.students.forEach((lStudent) => {
      if (!lStudent || !lStudent.name || isSummaryRow(lStudent, gid)) return;
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
          merged.pricingTiers || local.pricingTiers,
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

  // 3. Union paymentTransactions
  const existingTxIds = new Set<string>();
  const mergedTransactions: any[] = [];
  [...(remote.paymentTransactions || []), ...(local.paymentTransactions || [])].forEach((tx) => {
    if (!tx) return;
    const txId = tx.id || `${tx.groupId}_${tx.studentRowId}_${tx.sessionIndex}_${tx.amount}_${tx.timestamp}`;
    if (!existingTxIds.has(txId)) {
      existingTxIds.add(txId);
      mergedTransactions.push(tx);
    }
  });
  merged.paymentTransactions = mergedTransactions;

  // 4. Union deletedStudents archive
  const existingDelIds = new Set<string>();
  const mergedDeleted: any[] = [];
  [...(remote.deletedStudents || []), ...(local.deletedStudents || [])].forEach((item) => {
    if (!item) return;
    const dId = item.id || `${item.groupId}_${item.student?.name}_${item.deletedAt}`;
    if (!existingDelIds.has(dId)) {
      existingDelIds.add(dId);
      mergedDeleted.push(item);
    }
  });
  merged.deletedStudents = mergedDeleted;

  return merged;
}

const sanitizeData = (centerData: CenterData): { cleaned: CenterData; changed: boolean } => {
  let changed = false;
  const newGroupData: Record<string, GroupSheet> = {};
  const idMap: Record<string, string> = {};

  // Build global 1-to-1 bijection of student names to unique barcodes
  const existingBarcodeByNameMap = new Map<string, string>();
  const existingNameByBarcodeMap = new Map<string, string>();
  const existingBarcodeSet = new Set<string>();

  for (const sheet of Object.values(centerData.groupData || {})) {
    for (const s of sheet.students || []) {
      if (s.barcode?.trim()) {
        let b = s.barcode.trim();
        if (b.startsWith('STU-627')) {
          b = 'STU-27' + b.slice(7);
          s.barcode = b;
          changed = true;
        } else if (b.startsWith('STU-626')) {
          b = 'STU-26' + b.slice(7);
          s.barcode = b;
          changed = true;
        } else if (b.startsWith('STU-26')) {
          b = 'STU-27' + b.slice(6);
          s.barcode = b;
          changed = true;
        }
        const upperB = b.toUpperCase();
        existingBarcodeSet.add(upperB);
        if (s.name?.trim()) {
          const norm = s.name.trim().toLowerCase().replace(/\s+/g, ' ');
          if (!existingBarcodeByNameMap.has(norm)) {
            // Check if this barcode is already claimed by a DIFFERENT student
            if (!existingNameByBarcodeMap.has(upperB)) {
              existingBarcodeByNameMap.set(norm, b);
              existingNameByBarcodeMap.set(upperB, norm);
            } else if (existingNameByBarcodeMap.get(upperB) !== norm) {
              // Collision detected! Generate a fresh, guaranteed-unique barcode for this student
              const newB = generateUniqueStudentBarcode(Array.from(existingBarcodeSet), 'STU');
              existingBarcodeSet.add(newB.toUpperCase());
              existingBarcodeByNameMap.set(norm, newB);
              existingNameByBarcodeMap.set(newB.toUpperCase(), norm);
              s.barcode = newB;
              changed = true;
            }
          }
        }
      }
    }
  }

  for (const [gid, gSheet] of Object.entries(centerData.groupData || {})) {
    const originalStudents = gSheet.students || [];
    const cleanStudents = originalStudents.filter((s) => !isSummaryRow(s, gid));
    if (cleanStudents.length !== originalStudents.length) {
      changed = true;
    }

    // Ensure group ID follows strict BAC{XX} / BACV{XX} format without hyphens or suffixes like BAC01-2
    let finalGid = gid.trim().toUpperCase();
    if (finalGid.includes('-') || finalGid.includes('_') || !isValidGroupId(finalGid).isValid) {
      const isVip = gSheet.isVip || /^BACV/i.test(finalGid);
      const existingIds = [...Object.keys(newGroupData), ...(centerData.groups || []).map((g) => g.id)];
      finalGid = getNextGroupId(isVip, existingIds);
      idMap[gid] = finalGid;
      changed = true;
    }

    // Enforce 4 sessions for all groups as requested
    const sessionCount = 4;
    if (gSheet.sessionCount !== 4) {
      changed = true;
    }

    // Normalize sessionDates to YYYY/MM/DD and strictly cap to 4 sessions
    let currentDates = (gSheet.sessionDates || []).slice(0, 4);
    if ((gSheet.sessionDates || []).length !== 4) {
      changed = true;
    }

    const hasPlaceholders =
      currentDates.length === 0 ||
      currentDates.some((d) => !d || /^\d{1,2}$/.test(d.trim()) || d.includes('حصة') || !d.trim());

    let normalizedDates: string[];
    if (hasPlaceholders) {
      const allPlaceholders =
        currentDates.length === 0 ||
        currentDates.every((d) => !d || /^\d{1,2}$/.test(d.trim()) || d.includes('حصة') || !d.trim());

      if (allPlaceholders) {
        normalizedDates = generateSessionDates(gSheet.day1 || 'السبت', 4);
      } else {
        const firstValid = currentDates.find(
          (d) => /^\d{4}[./\-]\d{1,2}[./\-]\d{1,2}/.test(d) || /^\d{1,2}[./\-]\d{1,2}[./\-]\d{4}/.test(d)
        );
        normalizedDates = generateSessionDates(
          gSheet.day1 || 'السبت',
          4,
          firstValid ? formatToYYYYMMDD(firstValid) : undefined
        );
      }
      changed = true;
    } else {
      normalizedDates = currentDates.map((d) => {
        const formatted = formatToYYYYMMDD(d);
        if (formatted !== d) changed = true;
        return formatted;
      });
    }

    if (normalizedDates.length > 4) {
      normalizedDates = normalizedDates.slice(0, 4);
      changed = true;
    } else if (normalizedDates.length < 4) {
      normalizedDates = generateSessionDates(
        gSheet.day1 || 'السبت',
        4,
        normalizedDates[0] ? formatToYYYYMMDD(normalizedDates[0]) : undefined
      );
      changed = true;
    }

    const isVipGroup =
      finalGid.startsWith('BACV') ||
      finalGid.includes('VIP') ||
      Boolean(gSheet.isVip) ||
      Boolean(gSheet.type?.includes('10000'));
    const targetType = isVipGroup ? '4-10000' : (gSheet.type || '4-2500');
    if (gSheet.isVip !== isVipGroup || gSheet.type !== targetType) {
      changed = true;
    }

    // Enforce 4 sessions for all students, ensure barcode exists, and recalculate finances
    let finalStudents: StudentRecord[] = cleanStudents.map((s) => {
      let att = (s.attendance || []).slice(0, 4);
      while (att.length < 4) att.push('');
      let payments = (s.payments || []).slice(0, 4);
      while (payments.length < 4) payments.push('');
      if ((s.attendance || []).length !== 4) changed = true;

      let barcode = s.barcode?.trim();
      if (barcode && barcode.startsWith('STU-627')) {
        barcode = 'STU-27' + barcode.slice(7);
        changed = true;
      } else if (barcode && barcode.startsWith('STU-626')) {
        barcode = 'STU-26' + barcode.slice(7);
        changed = true;
      } else if (barcode && barcode.startsWith('STU-26')) {
        barcode = 'STU-27' + barcode.slice(6);
        changed = true;
      }
      const normName = s.name?.trim().toLowerCase().replace(/\s+/g, ' ');
      if (normName && existingBarcodeByNameMap.has(normName)) {
        const canonicalBarcode = existingBarcodeByNameMap.get(normName)!;
        if (barcode !== canonicalBarcode) {
          barcode = canonicalBarcode;
          changed = true;
        }
      } else if (normName && !isSummaryRow(s, finalGid)) {
        barcode = generateUniqueStudentBarcode(Array.from(existingBarcodeSet), 'STU');
        existingBarcodeSet.add(barcode.toUpperCase());
        existingBarcodeByNameMap.set(normName, barcode);
        existingNameByBarcodeMap.set(barcode.toUpperCase(), normName);
        changed = true;
      }

      const calculated = calcStudentFinancesPure(
        {
          ...s,
          barcode,
          attendance: att,
          payments: payments
        },
        targetType,
        centerData.pricingTiers || (initialSeedData as unknown as CenterData).pricingTiers,
        {
          ...gSheet,
          groupId: finalGid,
          isVip: isVipGroup,
          sessionCount: gSheet.sessionCount || 4,
          students: cleanStudents
        }
      );

      if (
        calculated.fee !== s.fee ||
        calculated.debt !== s.debt ||
        calculated.teacherPay !== s.teacherPay ||
        calculated.schoolEarn !== s.schoolEarn
      ) {
        changed = true;
      }

      return calculated;
    });

    const seedGroup = (initialSeedData.groupData as Record<string, GroupSheet>)?.[finalGid];
    if (cleanStudents.length === 0 && seedGroup && seedGroup.students && seedGroup.students.length > 0) {
      finalStudents = seedGroup.students.map((st) =>
        calcStudentFinancesPure(
          st,
          targetType,
          centerData.pricingTiers || (initialSeedData as unknown as CenterData).pricingTiers,
          {
            ...gSheet,
            groupId: finalGid,
            isVip: isVipGroup,
            sessionCount: 4
          }
        )
      );
      if (seedGroup.sessionDates && seedGroup.sessionDates.length > 0) {
        normalizedDates = seedGroup.sessionDates.slice(0, 4);
      }
      changed = true;
    }

    // Clean up any legacy manual status: 'active' so groups default to dynamic session-based status ('auto')
    let finalStatus = gSheet.status;
    if (finalStatus === 'active') {
      finalStatus = undefined;
      changed = true;
    }

    newGroupData[finalGid] = {
      ...gSheet,
      groupId: finalGid,
      sessionCount: 4,
      sessionDates: normalizedDates,
      status: finalStatus,
      isVip: isVipGroup,
      type: targetType,
      students: finalStudents
    };
  }

  for (const [seedGid, seedSheet] of Object.entries((initialSeedData.groupData as Record<string, GroupSheet>) || {})) {
    if (!newGroupData[seedGid] && seedSheet.students && seedSheet.students.length > 0) {
      const isVipGroup = seedGid.startsWith('BACV') || seedGid.includes('VIP') || Boolean(seedSheet.isVip);
      const targetType = isVipGroup ? '4-10000' : (seedSheet.type || '4-2500');
      const calcStudents = seedSheet.students.map((st) =>
        calcStudentFinancesPure(
          st,
          targetType,
          centerData.pricingTiers || (initialSeedData as unknown as CenterData).pricingTiers,
          {
            ...seedSheet,
            groupId: seedGid,
            isVip: isVipGroup,
            sessionCount: 4
          }
        )
      );
      newGroupData[seedGid] = {
        ...seedSheet,
        groupId: seedGid,
        isVip: isVipGroup,
        type: targetType,
        students: calcStudents
      };
      changed = true;
    }
  }

  // Deduplicate and sanitize groups array
  // Rule: It's normal to have BAC01 and BACV01, but never two BAC01 or two BACV01!
  const seenIds = new Set<string>();
  const cleanGroups: GroupMeta[] = [];
  for (const g of centerData.groups || []) {
    let cleanId = (idMap[g.id] || g.id).trim().toUpperCase();
    if (cleanId.includes('-') || cleanId.includes('_') || !isValidGroupId(cleanId).isValid) {
      cleanId = getNextGroupId(g.isVip || cleanId.startsWith('BACV'), cleanGroups);
      changed = true;
    }
    let cleanStatus = g.status;
    if (cleanStatus === 'active') {
      cleanStatus = undefined;
      changed = true;
    }

    const isGroupVip = cleanId.startsWith('BACV') || cleanId.includes('VIP') || Boolean(g.isVip);
    const groupType = isGroupVip ? '4-10000' : (g.type || '4-2500');

    if (!seenIds.has(cleanId)) {
      seenIds.add(cleanId);
      cleanGroups.push({ ...g, id: cleanId, status: cleanStatus, sessionCount: 4, isVip: isGroupVip, type: groupType });
    } else {
      // Duplicate ID detected (e.g. duplicate BAC01) - assign next ascending ID!
      const uniqueId = getNextGroupId(g.isVip || cleanId.startsWith('BACV'), cleanGroups);
      seenIds.add(uniqueId);
      cleanGroups.push({ ...g, id: uniqueId, status: cleanStatus, sessionCount: 4, isVip: isGroupVip, type: groupType });
      changed = true;
    }
  }

  for (const gid of Object.keys(newGroupData)) {
    if (!seenIds.has(gid)) {
      const seedMeta = (initialSeedData.groups || []).find((g) => g.id === gid);
      const sheet = newGroupData[gid];
      if (seedMeta) {
        cleanGroups.push(seedMeta);
      } else {
        cleanGroups.push({
          id: gid,
          teacherId: '',
          teacherName: sheet.teacherName || '',
          subject: sheet.subject || '',
          day1: sheet.day1 || '',
          time1: sheet.time1 || '',
          type: sheet.type || '4-2500',
          isVip: sheet.isVip || false
        });
      }
      seenIds.add(gid);
      changed = true;
    }
  }

  let finalAcademicYear = centerData.academicYear || '2026/2027';
  if (finalAcademicYear !== '2026/2027') {
    finalAcademicYear = '2026/2027';
    changed = true;
  }

  return {
    cleaned: {
      ...centerData,
      academicYear: finalAcademicYear,
      groups: cleanGroups,
      groupData: newGroupData,
      paymentTransactions: centerData.paymentTransactions || [],
      deletedStudents: centerData.deletedStudents || []
    },
    changed
  };
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CenterData>(() => {
    const { cleaned } = sanitizeData(initialSeedData as unknown as CenterData);
    return cleaned;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    const { cleaned } = sanitizeData(initialSeedData as unknown as CenterData);
    const sorted = sortGroupsActiveFirstOldToNew(cleaned.groups, cleaned.groupData, cleaned.pricingTiers);
    return sorted[0]?.id || 'BAC01';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  // Print Queue for deferred thermal receipts
  const [printQueue, setPrintQueue] = useState<QueuedReceipt[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('da3m_print_queue_v1');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const addToPrintQueue = (receipt: QueuedReceipt) => {
    setPrintQueue((prev) => {
      const next = [receipt, ...prev];
      try {
        localStorage.setItem('da3m_print_queue_v1', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const removeFromPrintQueue = (id: string) => {
    setPrintQueue((prev) => {
      const next = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem('da3m_print_queue_v1', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const clearPrintQueue = () => {
    setPrintQueue([]);
    try {
      localStorage.removeItem('da3m_print_queue_v1');
    } catch (e) {}
  };

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const cloudSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const dataRef = useRef<CenterData>(data);
  dataRef.current = data;

  const clientIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? (window as any).__DA3M_CLIENT_ID__ || (
          (window as any).__DA3M_CLIENT_ID__ = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now()
        )
      : 'server'
  );
  const hasPendingChangesRef = useRef<boolean>(
    typeof window !== 'undefined' && localStorage.getItem(UNSYNCED_CHANGES_KEY) === 'true'
  );
  const lastLocalEditTimeRef = useRef<number>(
    typeof window !== 'undefined' ? Number(localStorage.getItem(LAST_LOCAL_EDIT_KEY)) || 0 : 0
  );

  // Sync relational tables (groups, teachers, students) in background for Supabase Table Editor
  const syncRelationalTables = async (centerData: CenterData) => {
    try {
      // 1. Teachers
      const teachersToInsert = (centerData.teachers || []).map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone || '',
        subject: t.subject || ''
      }));
      if (teachersToInsert.length > 0) {
        await supabase.from('teachers').upsert(teachersToInsert);
      }
      const teacherIds = new Set(teachersToInsert.map((t) => t.id));

      // 2. Groups
      const groupsToInsert = (centerData.groups || []).map((g) => {
        const sheet = centerData.groupData[g.id] || {};
        return {
          id: g.id,
          teacher_id: g.teacherId && teacherIds.has(g.teacherId) ? g.teacherId : null,
          subject: g.subject || sheet.subject || '',
          day1: g.day1 || sheet.day1 || '',
          time1: g.time1 || sheet.time1 || '',
          day2: g.day2 || sheet.day2 || null,
          time2: g.time2 || sheet.time2 || null,
          type: g.type || sheet.type || '4-2500',
          is_vip: g.isVip || false,
          session_count: sheet.sessionCount || 4,
          student_fee: sheet.studentFee || null,
          teacher_rate: sheet.teacherPayPerStudent || null,
          status: g.status || null,
          session_dates: sheet.sessionDates || []
        };
      });
      if (groupsToInsert.length > 0) {
        await supabase.from('groups').upsert(groupsToInsert);
      }

      // 3. Students (Consolidated by unique student with multiple groups & balance)
      const studentMap = new Map<string, {
        name: string;
        phone: string;
        groups: string[];
        totalFee: number;
        totalPaid: number;
        totalDebt: number;
        balance: number;
        enrollments: any[];
      }>();

      for (const [gid, sheet] of Object.entries(centerData.groupData || {})) {
        for (const s of sheet.students || []) {
          if (s.name && !isSummaryRow(s, gid)) {
            const cleanName = s.name.trim();
            const phone = s.phone ? s.phone.trim() : '';
            const key = cleanName.toLowerCase();

            if (!studentMap.has(key)) {
              studentMap.set(key, {
                name: cleanName,
                phone: phone,
                groups: [gid],
                totalFee: s.fee || 0,
                totalPaid: s.totalReceived || 0,
                totalDebt: s.debt || 0,
                balance: (s.totalReceived || 0) - (s.fee || 0),
                enrollments: [{
                  groupId: gid,
                  rowId: s.rowId,
                  subject: sheet.subject || '',
                  teacherName: sheet.teacherName || '',
                  fee: s.fee || 0,
                  totalReceived: s.totalReceived || 0,
                  debt: s.debt || 0,
                  discount: s.discount || '1',
                  attendance: s.attendance || [],
                  payments: s.payments || []
                }]
              });
            } else {
              const item = studentMap.get(key)!;
              if (phone && !item.phone) item.phone = phone;
              if (!item.groups.includes(gid)) item.groups.push(gid);
              item.totalFee += (s.fee || 0);
              item.totalPaid += (s.totalReceived || 0);
              item.totalDebt += (s.debt || 0);
              item.balance = item.totalPaid - item.totalFee;
              item.enrollments.push({
                groupId: gid,
                rowId: s.rowId,
                subject: sheet.subject || '',
                teacherName: sheet.teacherName || '',
                fee: s.fee || 0,
                totalReceived: s.totalReceived || 0,
                debt: s.debt || 0,
                discount: s.discount || '1',
                attendance: s.attendance || [],
                payments: s.payments || []
              });
            }
          }
        }
      }

      const consolidatedStudents = Array.from(studentMap.values()).map((s) => ({
        name: s.name,
        phone: s.phone,
        groups: s.groups,
        balance: s.balance,
        total_fee: s.totalFee,
        total_paid: s.totalPaid,
        total_debt: s.totalDebt,
        enrollments: s.enrollments
      }));

      // Check if students table supports the unified multi-group schema
      const testRes = await supabase.from('students').insert(consolidatedStudents.slice(0, 1));
      if (!testRes.error) {
        // Table supports multi-group schema!
        await supabase.from('students').delete().neq('id', 0);
        for (let i = 0; i < consolidatedStudents.length; i += 100) {
          await supabase.from('students').insert(consolidatedStudents.slice(i, i + 100));
        }
      } else {
        // Legacy fallback until user executes the updated SQL
        const flatStudents: any[] = [];
        for (const [gid, sheet] of Object.entries(centerData.groupData || {})) {
          for (const s of sheet.students || []) {
            if (s.name && !isSummaryRow(s, gid)) {
              flatStudents.push({
                group_id: gid,
                row_id: s.rowId || 1,
                name: s.name,
                phone: s.phone || '',
                discount: s.discount ? String(s.discount) : '1',
                attendance: s.attendance || [],
                payments: s.payments || [],
                fee: s.fee || 0,
                total_received: s.totalReceived || 0,
                debt: s.debt || 0,
                teacher_pay: s.teacherPay || 0,
                school_earn: s.schoolEarn || 0
              });
            }
          }
        }
        if (flatStudents.length > 0) {
          await supabase.from('students').delete().neq('id', 0);
          for (let i = 0; i < flatStudents.length; i += 100) {
            await supabase.from('students').insert(flatStudents.slice(i, i + 100));
          }
        }
      }
    } catch (err) {
      console.warn('Relational tables background sync warning:', err);
    }
  };

  // Cloud save to Supabase with serialization and latest-snapshot guarantee
  const saveToCloud = useCallback(async (dataSnapshot?: CenterData) => {
    if (isSavingRef.current) {
      hasPendingChangesRef.current = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem(UNSYNCED_CHANGES_KEY, 'true');
      }
      return;
    }

    try {
      setCloudSyncStatus('syncing');
      isSavingRef.current = true;

      const targetData = dataSnapshot || dataRef.current;
      const now = Date.now();
      const dataToSave = {
        ...targetData,
        _client_id: clientIdRef.current,
        _saved_at: now,
        _last_modified_at: (targetData as any)._last_modified_at || now
      };

      const { error } = await supabase
        .from('center_data')
        .upsert({
          id: 'main',
          data: dataToSave,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase cloud sync error:', error);
        setCloudSyncStatus('offline');
        hasPendingChangesRef.current = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem(UNSYNCED_CHANGES_KEY, 'true');
        }
      } else {
        // SUCCESS! Clear pending flags
        hasPendingChangesRef.current = false;
        if (typeof window !== 'undefined') {
          localStorage.removeItem(UNSYNCED_CHANGES_KEY);
        }
        setCloudSyncStatus('synced');
        setLastSyncedAt(new Date());
        // Sync relational tables in background so Table Editor always shows live rows
        syncRelationalTables(targetData).catch((e) => console.warn(e));
      }
    } catch (err) {
      console.error('Failed to sync to Supabase (offline or network error):', err);
      setCloudSyncStatus('offline');
      hasPendingChangesRef.current = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem(UNSYNCED_CHANGES_KEY, 'true');
      }
    } finally {
      isSavingRef.current = false;
      // If user made edits while the network request was in flight, schedule save of latest data immediately
      if (hasPendingChangesRef.current) {
        if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = setTimeout(() => {
          saveToCloud();
        }, 200);
      }
    }
  }, []);

  // Load from localStorage immediately, then fetch latest from Supabase
  useEffect(() => {
    let isMounted = true;

    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed && parsed.groupData) {
          const { cleaned, changed } = sanitizeData(parsed);
          dataRef.current = cleaned;
          setData(cleaned);
          if (changed) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
        }
      } else {
        const { cleaned } = sanitizeData(initialSeedData as unknown as CenterData);
        dataRef.current = cleaned;
        setData(cleaned);
      }
      const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark';
      if (savedTheme) setTheme(savedTheme);

      const savedLang = localStorage.getItem(LANG_KEY) as 'ar' | 'en';
      if (savedLang) setLang(savedLang);
    } catch (e) {
      console.error('Failed to load stored data:', e);
    } finally {
      setIsLoading(false);
    }

    // Fetch latest from Supabase cloud
    const fetchCloudData = async () => {
      try {
        const hasLocalUnsynced =
          typeof window !== 'undefined' && localStorage.getItem(UNSYNCED_CHANGES_KEY) === 'true';

        const { data: remoteRow, error } = await supabase
          .from('center_data')
          .select('data, updated_at')
          .eq('id', 'main')
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.warn('Supabase fetch error, running offline:', error);
          setCloudSyncStatus('offline');
          return;
        }

        if (remoteRow && remoteRow.data) {
          const remoteData = remoteRow.data as any;
          const remoteLastModified =
            remoteData._last_modified_at ||
            remoteData._saved_at ||
            (remoteRow.updated_at ? new Date(remoteRow.updated_at).getTime() : 0);

          const localLastModified =
            (dataRef.current as any)?._last_modified_at ||
            lastLocalEditTimeRef.current ||
            0;

          // CRITICAL: If local has unsynced changes or is newer than cloud, NEVER OVERWRITE!
          // Instead, push local data to the cloud so offline changes are saved!
          if (hasLocalUnsynced || hasPendingChangesRef.current || localLastModified > remoteLastModified) {
            console.log('Preserving local offline data and syncing to Supabase cloud...');
            setCloudSyncStatus('syncing');
            saveToCloud(dataRef.current);
            return;
          }

          // Smart Attendance Merge: Even if remote seems newer, never drop local attendance marked 'P' or 'M'
          const mergedRemote = mergeAttendanceSafely(remoteData, dataRef.current);
          const { cleaned } = sanitizeData(mergedRemote);
          dataRef.current = cleaned;
          setData(cleaned);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
            localStorage.removeItem(UNSYNCED_CHANGES_KEY);
          } catch (e) {}
          setLastSyncedAt(new Date(remoteRow.updated_at || Date.now()));
          setCloudSyncStatus('synced');
        } else {
          // Supabase is empty, initialize it with current data
          const { cleaned } = sanitizeData(initialSeedData as unknown as CenterData);
          saveToCloud(cleaned);
        }
      } catch (err) {
        console.warn('Network error reaching Supabase:', err);
        if (isMounted) setCloudSyncStatus('offline');
      }
    };

    fetchCloudData();

    // Realtime subscription for multi-device synchronization
    const channel = supabase
      .channel('center_data_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'center_data', filter: 'id=eq.main' },
        (payload) => {
          if (payload.new && (payload.new as any).data) {
            const incoming = (payload.new as any).data as any;

            // 1. Prevent echo: never overwrite our own changes with our own echo
            if (incoming?._client_id && incoming._client_id === clientIdRef.current) {
              return;
            }

            // 2. Prevent race conditions: don't overwrite if we are currently saving or have pending local edits or unsynced changes
            const hasLocalUnsynced =
              typeof window !== 'undefined' && localStorage.getItem(UNSYNCED_CHANGES_KEY) === 'true';

            if (
              isSavingRef.current ||
              hasPendingChangesRef.current ||
              hasLocalUnsynced ||
              Date.now() - lastLocalEditTimeRef.current < 5000
            ) {
              return;
            }

            const merged = mergeAttendanceSafely(incoming as CenterData, dataRef.current);
            const { cleaned } = sanitizeData(merged);
            dataRef.current = cleaned;
            setData(cleaned);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
            } catch (e) {}
            setLastSyncedAt(new Date((payload.new as any).updated_at || Date.now()));
            setCloudSyncStatus('synced');
          }
        }
      )
      .subscribe();

    // 3. Online/Offline & Auto-Sync listeners
    const handleOnline = () => {
      console.log('Internet reconnected. Syncing pending data to Supabase...');
      setCloudSyncStatus('syncing');
      saveToCloud(dataRef.current);
    };

    const handleOffline = () => {
      console.log('Internet disconnected. Operating in offline mode with local persistence.');
      setCloudSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Heartbeat auto-sync every 8 seconds when pending changes exist
    const heartbeatTimer = setInterval(() => {
      const hasUnsynced =
        (typeof window !== 'undefined' && localStorage.getItem(UNSYNCED_CHANGES_KEY) === 'true') ||
        hasPendingChangesRef.current;
      if (hasUnsynced && !isSavingRef.current) {
        saveToCloud(dataRef.current);
      }
    }, 8000);

    return () => {
      isMounted = false;
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
      clearInterval(heartbeatTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, [saveToCloud]);

  // Save changes locally and debounce sync to Supabase
  const persistData = (newData: CenterData) => {
    const now = Date.now();
    const stampedData: CenterData = {
      ...newData,
      paymentTransactions: newData.paymentTransactions || dataRef.current.paymentTransactions || [],
      deletedStudents: newData.deletedStudents || dataRef.current.deletedStudents || [],
      _last_modified_at: now,
      _client_id: clientIdRef.current
    } as any;

    // 1. Synchronously update dataRef so subsequent operations read latest state immediately
    dataRef.current = stampedData;
    hasPendingChangesRef.current = true;
    lastLocalEditTimeRef.current = now;

    // 2. Update React state
    setData(stampedData);

    // 3. Save to localStorage immediately with persistent unsynced flag
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stampedData));
      localStorage.setItem(UNSYNCED_CHANGES_KEY, 'true');
      localStorage.setItem(LAST_LOCAL_EDIT_KEY, now.toString());
    } catch (e) {
      console.error('Failed to persist data:', e);
    }

    // 4. Debounced cloud sync (600ms)
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }
    setCloudSyncStatus('syncing');
    cloudSyncTimerRef.current = setTimeout(() => {
      saveToCloud(dataRef.current);
    }, 600);
  };

  // Manual one-click sync
  const syncNow = async () => {
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }
    await saveToCloud(dataRef.current);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  };

  const toggleLang = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    setLang(nextLang);
    localStorage.setItem(LANG_KEY, nextLang);
  };

  // Helper to recompute student finances according to pricing tier or group custom finances
  const calculateStudentFinances = (
    student: StudentRecord,
    groupType: string,
    pricingTiers: PricingTier[],
    groupFinances?: {
      studentFee?: number;
      teacherPayPerStudent?: number;
      schoolSharePerStudent?: number;
      sessionCount?: number;
      isVip?: boolean;
      groupId?: string;
    }
  ): StudentRecord => {
    return calcStudentFinancesPure(student, groupType, pricingTiers, groupFinances);
  };

  // Atomic cycle attendance (P -> A -> M -> '' -> P) with synchronous state updating
  const cycleAttendance = (groupId: string, rowId: number, sessionIndex: number): AttendanceStatus => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return '';

    const student = group.students.find((s) => s.rowId === rowId);
    if (!student) return '';

    const currentVal = (student.attendance?.[sessionIndex] || '').trim().toUpperCase();
    let next: AttendanceStatus = 'P';
    if (currentVal === 'P' || currentVal === 'ح') next = 'A';
    else if (currentVal === 'A' || currentVal === 'غ') next = 'M';
    else if (currentVal === 'M' || currentVal === 'م') next = '';
    else if (currentVal === '') next = 'P';

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((s) => {
      if (s.rowId !== rowId) return s;
      const newAttendance = [...(s.attendance || [])];
      while (newAttendance.length < sessionCount) newAttendance.push('');
      newAttendance[sessionIndex] = next;
      return calculateStudentFinances(
        { ...s, attendance: newAttendance },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };

    persistData(updatedData);
    return next;
  };

  // Update attendance
  const updateAttendance = (groupId: string, rowId: number, sessionIndex: number, status: AttendanceStatus) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      const newAttendance = [...(student.attendance || [])];
      while (newAttendance.length < sessionCount) newAttendance.push('');
      newAttendance[sessionIndex] = status;
      return calculateStudentFinances(
        { ...student, attendance: newAttendance },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Atomically update student attendance and optional payment in one shot
  const recordAttendanceAndPayment = (
    groupId: string,
    rowId: number,
    sessionIndex: number,
    status: AttendanceStatus,
    paymentAmount?: number
  ) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;

      const newAttendance = [...(student.attendance || [])];
      while (newAttendance.length < sessionCount) newAttendance.push('');
      newAttendance[sessionIndex] = status;

      let newPayments = [...(student.payments || [])];
      while (newPayments.length < sessionCount) newPayments.push('');
      if (paymentAmount !== undefined && paymentAmount > 0) {
        const currentP = Number(newPayments[sessionIndex]) || 0;
        newPayments[sessionIndex] = currentP + paymentAmount;
      }

      return calculateStudentFinances(
        { ...student, attendance: newAttendance, payments: newPayments },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);

    if (paymentAmount !== undefined && paymentAmount > 0) {
      const student = group.students.find((s) => s.rowId === rowId);
      if (student) {
        recordPaymentTransaction({
          groupId,
          groupSubject: group.subject,
          teacherName: group.teacherName,
          studentRowId: rowId,
          studentName: student.name,
          studentPhone: student.phone,
          studentBarcode: student.barcode,
          sessionIndex,
          amount: paymentAmount,
          source: 'scanner'
        });
      }
    }
  };

  // Mark all students present for a session in a single batch operation
  const markAllPresent = (groupId: string, sessionIndex: number, studentRowIds?: number[]) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const rowIdSet = studentRowIds && studentRowIds.length > 0 ? new Set(studentRowIds) : null;
    const targetStudents = group.students.filter(
      (s) => !isSummaryRow(s, groupId) && (!rowIdSet || rowIdSet.has(s.rowId))
    );

    // Check if all target students are already 'P'. If so, toggle to clear ('')
    const allAlreadyPresent =
      targetStudents.length > 0 && targetStudents.every((s) => s.attendance[sessionIndex] === 'P');
    const targetStatus: AttendanceStatus = allAlreadyPresent ? '' : 'P';

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((student) => {
      if (isSummaryRow(student, groupId)) return student;
      if (rowIdSet && !rowIdSet.has(student.rowId)) return student;

      const newAttendance = [...(student.attendance || [])];
      while (newAttendance.length < sessionCount) newAttendance.push('');
      newAttendance[sessionIndex] = targetStatus;

      return calculateStudentFinances(
        { ...student, attendance: newAttendance },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Automated Absence Tracking: End session and automatically mark all unscanned/unattended students as Absent ('A')
  const endSessionAndMarkAbsent = (groupId: string, sessionIndex: number) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return { presentCount: 0, makeupCount: 0, absentCount: 0 };

    let presentCount = 0;
    let makeupCount = 0;
    let absentCount = 0;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((student) => {
      if (isSummaryRow(student, groupId)) return student;

      const currentStatus = student.attendance?.[sessionIndex] || '';
      const newAttendance = [...(student.attendance || [])];
      while (newAttendance.length < sessionCount) newAttendance.push('');

      if (currentStatus === 'P') {
        presentCount++;
      } else if (currentStatus === 'M') {
        makeupCount++;
      } else {
        // Any student who never scanned their barcode or has no record for this session becomes Absent ('A')
        newAttendance[sessionIndex] = 'A';
        absentCount++;
      }

      return calculateStudentFinances(
        { ...student, attendance: newAttendance },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);

    return { presentCount, makeupCount, absentCount };
  };

  // Record Covering/Make-up Attendance when a student attends another group's session
  const recordCoverAttendance = (
    activeGroupId: string,
    originalGroupId: string,
    studentRowId: number,
    sessionIndex: number,
    paymentAmount?: number,
    targetOriginalSessionIdx?: number
  ) => {
    const currentData = dataRef.current;
    const activeGroup = currentData.groupData[activeGroupId];
    if (!activeGroup) return;

    const originalGroup = currentData.groupData[originalGroupId];
    const originalStudent = originalGroup?.students.find((s) => s.rowId === studentRowId);
    if (!originalStudent) return;

    // 1. In ORIGINAL group (e.g. BAC05): mark the session as 'C' (Covered)
    const origSessionCount = originalGroup.sessionDates?.length || originalGroup.sessionCount || 4;
    let origIdx = targetOriginalSessionIdx !== undefined ? targetOriginalSessionIdx : sessionIndex;
    if (origIdx >= origSessionCount) origIdx = origSessionCount - 1;

    // If that session was already attended ('P' or 'C'), find the first open/unattended session
    if (originalStudent.attendance?.[origIdx] === 'P' || originalStudent.attendance?.[origIdx] === 'C') {
      const firstOpen = (originalStudent.attendance || []).findIndex(
        (att, i) => i < origSessionCount && att !== 'P' && att !== 'C'
      );
      if (firstOpen !== -1) origIdx = firstOpen;
    }

    const newOrigAttendance: AttendanceStatus[] = [...(originalStudent.attendance || [])];
    while (newOrigAttendance.length < origSessionCount) newOrigAttendance.push('');
    newOrigAttendance[origIdx] = 'C';

    const updatedOriginalStudent = calculateStudentFinances(
      { ...originalStudent, attendance: newOrigAttendance },
      originalGroup.type,
      currentData.pricingTiers,
      originalGroup
    );

    const updatedOriginalGroup: GroupSheet = {
      ...originalGroup,
      students: originalGroup.students.map((s) => (s.rowId === studentRowId ? updatedOriginalStudent : s))
    };

    // 2. In ACTIVE group (e.g. BAC01): record student attendance as 'M' (Make-up/Cover)
    let updatedActiveGroup: GroupSheet = { ...activeGroup };
    const existingInActive = activeGroup.students.find(
      (s) => s.name.trim().toLowerCase() === originalStudent.name.trim().toLowerCase()
    );

    if (existingInActive) {
      const newAttendance = [...(existingInActive.attendance || [])];
      newAttendance[sessionIndex] = 'M';
      let newPayments = [...(existingInActive.payments || [])];
      if (paymentAmount && paymentAmount > 0) {
        const currentP = Number(newPayments[sessionIndex]) || 0;
        newPayments[sessionIndex] = currentP + paymentAmount;
      }
      const updatedStudent = calculateStudentFinances(
        { ...existingInActive, attendance: newAttendance, payments: newPayments },
        activeGroup.type,
        currentData.pricingTiers,
        activeGroup
      );
      updatedActiveGroup.students = activeGroup.students.map((s) =>
        s.rowId === existingInActive.rowId ? updatedStudent : s
      );
    } else {
      const newRowId = (activeGroup.students || []).reduce((max, s) => Math.max(max, s.rowId || 0), 0) + 1;
      const initialAttendance: AttendanceStatus[] = Array(activeGroup.sessionCount || 4).fill('');
      initialAttendance[sessionIndex] = 'M';
      const initialPayments: (number | string)[] = Array(activeGroup.sessionCount || 4).fill('');
      if (paymentAmount && paymentAmount > 0) {
        initialPayments[sessionIndex] = paymentAmount;
      }
      const newCoverStudent = calculateStudentFinances(
        {
          rowId: newRowId,
          name: originalStudent.name,
          phone: originalStudent.phone,
          barcode: originalStudent.barcode || `${originalGroupId}-${originalStudent.rowId}`,
          discount: 'تعويض',
          attendance: initialAttendance,
          payments: initialPayments,
          fee: 0,
          totalReceived: paymentAmount || 0,
          teacherPay: 0,
          schoolEarn: 0,
          debt: 0,
          totalAttendance: 1
        },
        activeGroup.type,
        currentData.pricingTiers,
        activeGroup
      );
      updatedActiveGroup.students = [...activeGroup.students, newCoverStudent];
    }

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [originalGroupId]: updatedOriginalGroup,
        [activeGroupId]: updatedActiveGroup
      }
    };
    persistData(updatedData);

    if (paymentAmount && paymentAmount > 0) {
      recordPaymentTransaction({
        groupId: activeGroupId,
        groupSubject: activeGroup.subject,
        teacherName: activeGroup.teacherName,
        studentRowId: originalStudent.rowId,
        studentName: originalStudent.name,
        studentPhone: originalStudent.phone,
        studentBarcode: originalStudent.barcode,
        sessionIndex,
        amount: paymentAmount,
        source: 'scanner'
      });
    }
  };

  // Update payment installment
  const updatePayment = (groupId: string, rowId: number, paymentIndex: number, amount: number | string) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const studentBefore = group.students.find((s) => s.rowId === rowId);
    const oldP = Number(studentBefore?.payments?.[paymentIndex]) || 0;
    const newP = amount === '' ? 0 : Number(amount) || 0;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      const newPayments = [...(student.payments || [])];
      while (newPayments.length < sessionCount) newPayments.push('');
      newPayments[paymentIndex] = amount === '' ? '' : Number(amount) || 0;
      return calculateStudentFinances(
        { ...student, payments: newPayments },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
    saveToCloud(updatedData);

    // Only record transaction if payment actually increased!
    if (newP > oldP && studentBefore) {
      recordPaymentTransaction({
        groupId,
        groupSubject: group.subject,
        teacherName: group.teacherName,
        studentRowId: rowId,
        studentName: studentBefore.name,
        studentPhone: studentBefore.phone,
        studentBarcode: studentBefore.barcode,
        sessionIndex: paymentIndex,
        amount: newP - oldP,
        source: 'payment_modal'
      });
    }
  };

  // Atomically update student payments and discount
  const updateStudentFullFinances = (
    groupId: string,
    rowId: number,
    payments: (number | string)[],
    discount?: DiscountType
  ) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const newPayments = payments.map((p) => (p === '' ? '' : Number(p) || 0));
    while (newPayments.length < sessionCount) newPayments.push('');

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      const updated = {
        ...student,
        payments: newPayments,
        ...(discount !== undefined ? { discount } : {})
      };
      return calculateStudentFinances(updated, group.type, currentData.pricingTiers, group);
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
    saveToCloud(updatedData);

    const student = group.students.find((s) => s.rowId === rowId);
    if (student) {
      newPayments.forEach((p, idx) => {
        const oldP = Number(student.payments?.[idx]) || 0;
        const newP = Number(p) || 0;
        if (newP > oldP) {
          recordPaymentTransaction({
            groupId,
            groupSubject: group.subject,
            teacherName: group.teacherName,
            studentRowId: rowId,
            studentName: student.name,
            studentPhone: student.phone,
            studentBarcode: student.barcode,
            sessionIndex: idx,
            amount: newP - oldP,
            source: 'payment_modal'
          });
        }
      });
    }
  };

  // Batch update payments for multiple students for a specific session/day
  const batchUpdateSessionPayments = (
    groupId: string,
    sessionIndex: number,
    studentPayments: { rowId: number; amount: number | string }[]
  ) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const paymentMap = new Map<number, number | string>();
    studentPayments.forEach((sp) => paymentMap.set(sp.rowId, sp.amount));

    // Determine actual incremental payments before applying update
    const increments: { rowId: number; studentName: string; phone?: string; barcode?: string; amount: number }[] = [];
    group.students.forEach((student) => {
      if (paymentMap.has(student.rowId)) {
        const val = paymentMap.get(student.rowId);
        const newAmt = val === '' ? 0 : Number(val) || 0;
        const oldAmt = Number(student.payments?.[sessionIndex]) || 0;
        if (newAmt > oldAmt) {
          increments.push({
            rowId: student.rowId,
            studentName: student.name,
            phone: student.phone,
            barcode: student.barcode,
            amount: newAmt - oldAmt
          });
        }
      }
    });

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updatedStudents = group.students.map((student) => {
      if (!paymentMap.has(student.rowId)) return student;
      const val = paymentMap.get(student.rowId);
      const newPayments = [...(student.payments || [])];
      while (newPayments.length < sessionCount) newPayments.push('');
      newPayments[sessionIndex] = val === '' ? '' : Number(val) || 0;
      return calculateStudentFinances(
        { ...student, payments: newPayments },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
    saveToCloud(updatedData);

    // ONLY record transactions for genuine positive payment increments
    increments.forEach((inc) => {
      if (inc.amount > 0) {
        recordPaymentTransaction({
          groupId,
          groupSubject: group.subject,
          teacherName: group.teacherName,
          studentRowId: inc.rowId,
          studentName: inc.studentName,
          studentPhone: inc.phone,
          studentBarcode: inc.barcode,
          sessionIndex,
          amount: inc.amount,
          source: 'batch'
        });
      }
    });
  };

  // Batch update all session payments across multiple students/sessions
  const batchUpdateAllSessionsPayments = (
    groupId: string,
    updates: { rowId: number; payments: (number | string)[] }[]
  ) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const updateMap = new Map<number, (number | string)[]>();
    updates.forEach((u) => updateMap.set(u.rowId, u.payments));

    // Record positive incremental payment transactions
    group.students.forEach((student) => {
      if (updateMap.has(student.rowId)) {
        const newPayments = updateMap.get(student.rowId)!;
        newPayments.forEach((val, sessionIdx) => {
          const newAmt = val === '' ? 0 : Number(val) || 0;
          const oldAmt = Number(student.payments?.[sessionIdx]) || 0;
          if (newAmt > oldAmt) {
            recordPaymentTransaction({
              groupId,
              groupSubject: group.subject,
              teacherName: group.teacherName,
              studentRowId: student.rowId,
              studentName: student.name,
              studentPhone: student.phone,
              studentBarcode: student.barcode,
              sessionIndex: sessionIdx,
              amount: newAmt - oldAmt,
              source: 'batch'
            });
          }
        });
      }
    });

    const updatedStudents = group.students.map((student) => {
      if (!updateMap.has(student.rowId)) return student;
      const rawPayments = updateMap.get(student.rowId)!;
      const normalizedPayments = rawPayments.map((p) => (p === '' ? '' : Number(p) || 0));
      while (normalizedPayments.length < sessionCount) normalizedPayments.push('');

      return calculateStudentFinances(
        { ...student, payments: normalizedPayments },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };

    persistData(updatedData);
    saveToCloud(updatedData);
  };

  // Update discount
  const updateDiscount = (groupId: string, rowId: number, discount: DiscountType) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      return calculateStudentFinances(
        { ...student, discount },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Add new student
  const addStudent = (
    groupId: string,
    studentInfo: { name: string; phone: string; discount?: DiscountType; barcode?: string }
  ): StudentRecord | null => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return null;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
    const maxRowId = group.students.reduce((max, s) => Math.max(max, s.rowId || 0), 0);
    const rowId = maxRowId + 1;

    // Collect all existing barcodes across the center
    const allStudentsList: StudentRecord[] = [];
    Object.values(currentData.groupData).forEach((g) => allStudentsList.push(...g.students));

    // If student already has a barcode in another group, reuse it; otherwise generate a new unique one
    const existingSameName = allStudentsList.find(
      (s) => s.name.trim().toLowerCase() === studentInfo.name.trim().toLowerCase() && s.barcode
    );
    const barcode =
      studentInfo.barcode?.trim() ||
      existingSameName?.barcode ||
      generateUniqueStudentBarcode(allStudentsList, 'STU');

    const newStudentRaw: StudentRecord = {
      rowId,
      name: studentInfo.name.trim(),
      phone: studentInfo.phone ? studentInfo.phone.trim() : '',
      barcode,
      attendance: Array(sessionCount).fill(''),
      discount: studentInfo.discount || '1',
      fee: 0,
      payments: Array(sessionCount).fill(''),
      totalReceived: 0,
      teacherPay: 0,
      schoolEarn: 0,
      debt: 0,
      totalAttendance: 0
    };

    const calculatedStudent = calculateStudentFinances(newStudentRaw, group.type, currentData.pricingTiers, group);

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: {
          ...group,
          students: [...group.students, calculatedStudent]
        }
      }
    };
    persistData(updatedData);
    saveToCloud(updatedData);
    return calculatedStudent;
  };

  // Enroll student in multiple groups with immediate payments
  const enrollStudentMultiGroups = (
    studentInfo: { name: string; phone: string; discount?: DiscountType; barcode?: string },
    enrollments: { groupId: string; paymentAmount: number | string }[]
  ): { groupId: string; rowId: number; fee: number; paid: number; debt: number }[] => {
    const currentData = dataRef.current;
    const updatedGroupData = { ...currentData.groupData };
    const results: { groupId: string; rowId: number; fee: number; paid: number; debt: number }[] = [];

    // Collect existing barcodes across the center
    const allStudentsList: StudentRecord[] = [];
    Object.values(updatedGroupData).forEach((g) => allStudentsList.push(...g.students));

    const existingSameName = allStudentsList.find(
      (s) => s.name.trim().toLowerCase() === studentInfo.name.trim().toLowerCase() && s.barcode
    );
    const resolvedBarcode =
      studentInfo.barcode?.trim() ||
      existingSameName?.barcode ||
      generateUniqueStudentBarcode(allStudentsList, 'STU');

    enrollments.forEach(({ groupId, paymentAmount }) => {
      const group = updatedGroupData[groupId];
      if (!group) return;

      const sessionCount = group.sessionDates?.length || group.sessionCount || 4;
      const maxRowId = group.students.reduce((max, s) => Math.max(max, s.rowId || 0), 0);
      const rowId = maxRowId + 1;

      const initialPayments: (number | string)[] = Array(sessionCount).fill('');
      const payNum = Number(paymentAmount) || 0;
      if (payNum > 0) {
        initialPayments[0] = payNum;
      }

      const newStudentRaw: StudentRecord = {
        rowId,
        name: studentInfo.name.trim(),
        phone: studentInfo.phone ? studentInfo.phone.trim() : '',
        barcode: resolvedBarcode,
        attendance: Array(sessionCount).fill(''),
        discount: studentInfo.discount || '1',
        fee: 0,
        payments: initialPayments,
        totalReceived: payNum,
        teacherPay: 0,
        schoolEarn: 0,
        debt: 0,
        totalAttendance: 0
      };

      const calculatedStudent = calculateStudentFinances(newStudentRaw, group.type, currentData.pricingTiers, group);

      updatedGroupData[groupId] = {
        ...group,
        students: [...group.students, calculatedStudent]
      };

      results.push({
        groupId,
        rowId,
        fee: calculatedStudent.fee,
        paid: calculatedStudent.totalReceived,
        debt: calculatedStudent.debt
      });

      // Record transaction immediately for audit log & receipt history
      if (payNum > 0) {
        recordPaymentTransaction({
          groupId,
          groupSubject: group.subject,
          teacherName: group.teacherName,
          studentRowId: rowId,
          studentName: studentInfo.name.trim(),
          studentPhone: studentInfo.phone ? studentInfo.phone.trim() : '',
          studentBarcode: resolvedBarcode,
          sessionIndex: 0,
          amount: payNum,
          source: 'multi_group'
        });
      }
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: updatedGroupData
    };
    persistData(updatedData);
    saveToCloud(updatedData);

    return results;
  };

  // Atomically record payments for a student across multiple groups (existing or new enrollments)
  const recordMultiGroupPayment = (
    studentIdentifier: { name: string; barcode?: string; phone?: string; discount?: DiscountType },
    payments: { groupId: string; paymentAmount: number | string }[]
  ): { groupId: string; rowId: number; fee: number; paidNow: number; totalReceived: number; debt: number }[] => {
    const currentData = dataRef.current;
    const updatedGroupData = { ...currentData.groupData };
    const results: { groupId: string; rowId: number; fee: number; paidNow: number; totalReceived: number; debt: number }[] = [];
    const cleanName = studentIdentifier.name.trim();
    const cleanNormName = normalizeArabicName(cleanName);
    const barcodeUpper = studentIdentifier.barcode?.trim().toUpperCase();

    // Collect all existing barcodes across center if needed
    const allStudentsList: StudentRecord[] = [];
    Object.values(updatedGroupData).forEach((g) => allStudentsList.push(...g.students));
    const existingSame = allStudentsList.find(
      (s) =>
        (barcodeUpper && s.barcode && s.barcode.toUpperCase() === barcodeUpper) ||
        (cleanNormName && normalizeArabicName(s.name) === cleanNormName)
    );
    const resolvedBarcode =
      barcodeUpper ||
      existingSame?.barcode ||
      generateUniqueStudentBarcode(allStudentsList, 'STU');
    const resolvedPhone = studentIdentifier.phone?.trim() || existingSame?.phone || '';
    const resolvedDiscount = studentIdentifier.discount || existingSame?.discount || '1';

    payments.forEach(({ groupId, paymentAmount }) => {
      const group = updatedGroupData[groupId];
      if (!group) return;

      const payNum = Number(paymentAmount) || 0;
      const sessionCount = group.sessionDates?.length || group.sessionCount || 4;

      // Check if student already exists in this group
      const existingStudentIdx = group.students.findIndex(
        (s) =>
          !isSummaryRow(s, groupId) &&
          ((resolvedBarcode && s.barcode && s.barcode.toUpperCase() === resolvedBarcode) ||
            normalizeArabicName(s.name) === cleanNormName)
      );

      if (existingStudentIdx !== -1) {
        // Update existing student in this group
        const currentStudent = group.students[existingStudentIdx];
        const newPayments = [...(currentStudent.payments || [])];
        while (newPayments.length < sessionCount) newPayments.push('');

        if (payNum > 0) {
          const existingReceived = (currentStudent.payments || []).reduce<number>((sum, p) => {
            const val = typeof p === 'number' ? p : parseFloat(String(p));
            return sum + (isNaN(val) ? 0 : val);
          }, 0);

          // If the student already has 0 debt and already paid at least this amount, avoid double charging
          if (currentStudent.debt === 0 && existingReceived >= payNum && existingReceived > 0) {
            // Already paid, do not duplicate
          } else {
            // Find first session with 0/empty payment, or add to session 0
            let targetIdx = newPayments.findIndex((p) => p === '' || p === 0 || p === '0');
            if (targetIdx === -1) targetIdx = 0;
            const currentP = Number(newPayments[targetIdx]) || 0;
            newPayments[targetIdx] = currentP + payNum;
          }
        }

        const calculated = calculateStudentFinances(
          { ...currentStudent, payments: newPayments },
          group.type,
          currentData.pricingTiers,
          { ...group, groupId }
        );

        const newStudents = [...group.students];
        newStudents[existingStudentIdx] = calculated;
        updatedGroupData[groupId] = { ...group, students: newStudents };

        results.push({
          groupId,
          rowId: calculated.rowId,
          fee: calculated.fee,
          paidNow: payNum,
          totalReceived: calculated.totalReceived,
          debt: calculated.debt
        });
      } else {
        // Enroll student in this group
        const maxRowId = group.students.reduce((max, s) => Math.max(max, s.rowId || 0), 0);
        const rowId = maxRowId + 1;

        const initialPayments: (number | string)[] = Array(sessionCount).fill('');
        if (payNum > 0) {
          initialPayments[0] = payNum;
        }

        const newStudentRaw: StudentRecord = {
          rowId,
          name: cleanName,
          phone: resolvedPhone,
          barcode: resolvedBarcode,
          attendance: Array(sessionCount).fill(''),
          discount: resolvedDiscount,
          fee: 0,
          payments: initialPayments,
          totalReceived: payNum,
          teacherPay: 0,
          schoolEarn: 0,
          debt: 0,
          totalAttendance: 0
        };

        const calculated = calculateStudentFinances(newStudentRaw, group.type, currentData.pricingTiers, { ...group, groupId });

        updatedGroupData[groupId] = {
          ...group,
          students: [...group.students, calculated]
        };

        results.push({
          groupId,
          rowId,
          fee: calculated.fee,
          paidNow: payNum,
          totalReceived: calculated.totalReceived,
          debt: calculated.debt
        });
      }
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: updatedGroupData
    };
    persistData(updatedData);
    saveToCloud(updatedData);

    results.forEach((r) => {
      if (r.paidNow > 0) {
        const grp = updatedGroupData[r.groupId];
        recordPaymentTransaction({
          groupId: r.groupId,
          groupSubject: grp?.subject,
          teacherName: grp?.teacherName,
          studentRowId: r.rowId,
          studentName: cleanName,
          studentPhone: resolvedPhone,
          studentBarcode: resolvedBarcode,
          sessionIndex: 0,
          amount: r.paidNow,
          source: 'multi_group'
        });
      }
    });

    return results;
  };

  // Delete student with soft-delete archiving to recycle bin
  const deleteStudent = (groupId: string, rowId: number) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const studentToDelete = group.students.find((s) => s.rowId === rowId);
    const updatedStudents = group.students.filter((s) => s.rowId !== rowId);

    const archiveItem = studentToDelete ? {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      deletedAt: Date.now(),
      deletedAtStr: new Date().toLocaleString('ar-DZ'),
      groupId,
      groupSubject: group.subject,
      teacherName: group.teacherName,
      student: { ...studentToDelete },
      reason: 'حذف يدوي من القائمة'
    } : null;

    const existingDeleted = currentData.deletedStudents || [];
    const updatedDeleted = archiveItem ? [archiveItem, ...existingDeleted] : existingDeleted;

    const updatedData: CenterData = {
      ...currentData,
      deletedStudents: updatedDeleted,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
    saveToCloud(updatedData);
  };

  // Restore deleted student from recycle bin
  const restoreStudent = (archiveId: string): boolean => {
    const currentData = dataRef.current;
    const archive = currentData.deletedStudents || [];
    const item = archive.find((a) => a.id === archiveId);
    if (!item) return false;

    const group = currentData.groupData[item.groupId];
    if (!group) return false;

    // Check if student already exists in group by name
    const existing = group.students.find(
      (s) => normalizeArabicName(s.name) === normalizeArabicName(item.student.name)
    );
    if (existing) {
      const updatedDeleted = archive.filter((a) => a.id !== archiveId);
      const updatedData: CenterData = { ...currentData, deletedStudents: updatedDeleted };
      persistData(updatedData);
      saveToCloud(updatedData);
      return true;
    }

    const maxRowId = group.students.reduce((max, s) => Math.max(max, s.rowId || 0), 0);
    const newRowId = Math.max(maxRowId + 1, item.student.rowId || 1);
    const restoredStudent = calcStudentFinancesPure(
      { ...item.student, rowId: newRowId },
      group.type,
      currentData.pricingTiers,
      group
    );

    const updatedStudents = [...group.students, restoredStudent];
    const updatedDeleted = archive.filter((a) => a.id !== archiveId);

    const updatedData: CenterData = {
      ...currentData,
      deletedStudents: updatedDeleted,
      groupData: {
        ...currentData.groupData,
        [item.groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
    saveToCloud(updatedData);
    return true;
  };

  // Clear recycle bin
  const clearRecycleBin = () => {
    const currentData = dataRef.current;
    const updatedData: CenterData = { ...currentData, deletedStudents: [] };
    persistData(updatedData);
    saveToCloud(updatedData);
  };

  // Transfer student from one group to another
  const transferStudent = (fromGroupId: string, toGroupId: string, studentRowId: number): boolean => {
    const currentData = dataRef.current;
    const fromGroup = currentData.groupData[fromGroupId];
    const toGroup = currentData.groupData[toGroupId];
    if (!fromGroup || !toGroup) return false;

    const originalStudent = fromGroup.students.find((s) => s.rowId === studentRowId);
    if (!originalStudent) return false;

    const newStudent = addStudent(toGroupId, {
      name: originalStudent.name,
      phone: originalStudent.phone,
      discount: originalStudent.discount,
      barcode: originalStudent.barcode
    });

    if (!newStudent) return false;

    deleteStudent(fromGroupId, studentRowId);
    return true;
  };

  // Update student arbitrary fields
  const updateStudent = (groupId: string, rowId: number, fields: Partial<StudentRecord>) => {
    const currentData = dataRef.current;
    const group = currentData.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      return calculateStudentFinances(
        { ...student, ...fields },
        group.type,
        currentData.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...currentData,
      groupData: {
        ...currentData.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Add group
  const addGroup = (groupMeta: GroupMeta) => {
    let cleanId = groupMeta.id.trim().toUpperCase();
    if (
      !cleanId ||
      cleanId.includes('-') ||
      !isValidGroupId(cleanId).isValid ||
      data.groupData[cleanId] ||
      data.groups.some((g) => g.id.toUpperCase() === cleanId)
    ) {
      cleanId = getNextGroupId(groupMeta.isVip, data.groups);
    }
    const sessionCount = groupMeta.sessionCount || 8;
    const effectiveDay1 = groupMeta.day1 || 'السبت';
    const effectiveDay2 = groupMeta.day2;
    const sessionDates =
      groupMeta.sessionDates && groupMeta.sessionDates.length === sessionCount
        ? groupMeta.sessionDates
        : generateSessionDates(effectiveDay1, sessionCount, groupMeta.customStart, effectiveDay2);

    const newGroupSheet: GroupSheet = {
      groupId: cleanId,
      teacherName: groupMeta.teacherName,
      subject: groupMeta.subject,
      day1: groupMeta.day1,
      time1: groupMeta.time1,
      day2: groupMeta.day2,
      time2: groupMeta.time2,
      sessionDates,
      sessionCount,
      isVip: groupMeta.isVip,
      type: groupMeta.type,
      studentFee: groupMeta.studentFee,
      teacherPayPerStudent: groupMeta.teacherPayPerStudent,
      schoolSharePerStudent: groupMeta.schoolSharePerStudent,
      students: []
    };

    const updatedData: CenterData = {
      ...data,
      groups: [...data.groups, { ...groupMeta, id: cleanId, sessionCount, sessionDates }],
      groupData: {
        ...data.groupData,
        [cleanId]: newGroupSheet
      }
    };
    persistData(updatedData);
  };

  // Renew / Rollover finished group to a new cycle with new ID and carry over selected students
  const renewGroupWithStudents = (
    sourceGroupId: string,
    newGroupId: string,
    selectedStudentRowIds: number[],
    customGroupFields?: Partial<GroupMeta>
  ) => {
    const sourceGroup = data.groupData[sourceGroupId];
    const sourceMeta = data.groups.find((g) => g.id === sourceGroupId);
    if (!sourceGroup) return;

    const isVipGroup = customGroupFields?.isVip ?? sourceMeta?.isVip ?? sourceGroup?.isVip ?? isVipGroupId(newGroupId || sourceGroupId);
    let cleanNewId = newGroupId.trim().toUpperCase();
    if (
      !cleanNewId ||
      cleanNewId.includes('-') ||
      !isValidGroupId(cleanNewId).isValid ||
      data.groupData[cleanNewId] ||
      data.groups.some((g) => g.id.toUpperCase() === cleanNewId)
    ) {
      cleanNewId = getNextGroupId(isVipGroup, data.groups);
    }

    const sessionCount = customGroupFields?.sessionCount || sourceGroup.sessionCount || sourceMeta?.sessionCount || 4;
    const effectiveDay1 = customGroupFields?.day1 || sourceGroup.day1 || 'السبت';
    const effectiveDay2 = customGroupFields?.day2 || sourceGroup.day2;

    // Calculate the first session date for the new group:
    // "ex if the last session for inactive group was wednesday 16/09/2026, the new group first session should be next wednesday 23/09/2026"
    let startStr = customGroupFields?.customStart;
    if (!startStr) {
      const sourceDates = (sourceGroup.sessionDates || []).filter((d) => Boolean(d && typeof d === 'string' && d.trim()));
      const lastSessionDateStr = sourceDates.length > 0 ? sourceDates[sourceDates.length - 1] : null;
      const nextDate = getNextSessionDateAfter(lastSessionDateStr, effectiveDay1, effectiveDay2);
      startStr = formatToYYYYMMDD(nextDate);
    }

    const sessionDates =
      customGroupFields?.sessionDates && customGroupFields.sessionDates.length === sessionCount
        ? customGroupFields.sessionDates
        : generateSessionDates(
            effectiveDay1,
            sessionCount,
            startStr,
            effectiveDay2
          );

    // Filter genuine students who were selected
    const selectedStudents = sourceGroup.students.filter(
      (s) => selectedStudentRowIds.includes(s.rowId) && !isSummaryRow(s, sourceGroupId)
    );

    const groupType = customGroupFields?.type || sourceGroup.type || '4-2500';
    const studentFee = customGroupFields?.studentFee ?? sourceGroup.studentFee;
    const teacherPay = customGroupFields?.teacherPayPerStudent ?? sourceGroup.teacherPayPerStudent;
    const schoolShare = customGroupFields?.schoolSharePerStudent ?? sourceGroup.schoolSharePerStudent;

    const newStudents: StudentRecord[] = selectedStudents.map((s, idx) => {
      const initialRecord: StudentRecord = {
        rowId: idx + 1,
        name: s.name,
        phone: s.phone || '',
        discount: s.discount || '1',
        attendance: Array(sessionCount).fill(''),
        payments: Array(sessionCount).fill(''),
        fee: 0,
        totalReceived: 0,
        teacherPay: 0,
        schoolEarn: 0,
        debt: 0,
        totalAttendance: 0
      };

      return calculateStudentFinances(
        initialRecord,
        groupType,
        data.pricingTiers,
        {
          studentFee,
          teacherPayPerStudent: teacherPay,
          schoolSharePerStudent: schoolShare,
          sessionCount
        }
      );
    });

    const newGroupMeta: GroupMeta = {
      id: cleanNewId,
      teacherId: customGroupFields?.teacherId ?? sourceMeta?.teacherId ?? '',
      teacherName: customGroupFields?.teacherName ?? sourceGroup.teacherName,
      subject: customGroupFields?.subject ?? sourceGroup.subject,
      day1: customGroupFields?.day1 ?? sourceGroup.day1,
      time1: customGroupFields?.time1 ?? sourceGroup.time1,
      day2: customGroupFields?.day2 ?? sourceGroup.day2,
      time2: customGroupFields?.time2 ?? sourceGroup.time2,
      type: groupType,
      sessionCount,
      isVip: customGroupFields?.isVip ?? sourceGroup.isVip,
      studentFee,
      teacherPayPerStudent: teacherPay,
      schoolSharePerStudent: schoolShare,
      status: customGroupFields?.status
    };

    const newGroupSheet: GroupSheet = {
      groupId: cleanNewId,
      teacherName: newGroupMeta.teacherName,
      subject: newGroupMeta.subject,
      day1: newGroupMeta.day1,
      time1: newGroupMeta.time1,
      day2: newGroupMeta.day2,
      time2: newGroupMeta.time2,
      sessionDates,
      sessionCount,
      isVip: newGroupMeta.isVip,
      type: newGroupMeta.type,
      studentFee: newGroupMeta.studentFee,
      teacherPayPerStudent: newGroupMeta.teacherPayPerStudent,
      schoolSharePerStudent: newGroupMeta.schoolSharePerStudent,
      status: customGroupFields?.status,
      students: newStudents
    };

    const updatedData: CenterData = {
      ...data,
      groups: [...data.groups, newGroupMeta],
      groupData: {
        ...data.groupData,
        [cleanNewId]: newGroupSheet
      }
    };

    persistData(updatedData);
    setSelectedGroup(cleanNewId);
  };

  // Update group finances (student fee, teacher payment, school share)
  const updateGroupFinances = (
    groupId: string,
    finances: { studentFee: number; teacherPayPerStudent: number; schoolSharePerStudent: number }
  ) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const updatedGroup: GroupSheet = {
      ...group,
      studentFee: finances.studentFee,
      teacherPayPerStudent: finances.teacherPayPerStudent,
      schoolSharePerStudent: finances.schoolSharePerStudent
    };

    const recalculatedStudents = group.students.map((s) =>
      calculateStudentFinances(s, group.type, data.pricingTiers, updatedGroup)
    );
    updatedGroup.students = recalculatedStudents;

    const updatedGroupsMeta = data.groups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            studentFee: finances.studentFee,
            teacherPayPerStudent: finances.teacherPayPerStudent,
            schoolSharePerStudent: finances.schoolSharePerStudent
          }
        : g
    );

    persistData({
      ...data,
      groups: updatedGroupsMeta,
      groupData: {
        ...data.groupData,
        [groupId]: updatedGroup
      }
    });
  };

  // Update all info for a group (teacher, subject, schedule, tier, VIP, sessions, finances)
  const updateGroup = (groupId: string, fields: Partial<GroupMeta>) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const newSessionCount = fields.sessionCount || group.sessionCount || group.sessionDates.length || 8;
    const dayChanged = Boolean(fields.day1 && fields.day1 !== group.day1);
    let newSessionDates = [...group.sessionDates];

    if (dayChanged) {
      const effectiveDay = fields.day1 || group.day1 || 'السبت';
      // When scheduled day changes, regenerate session dates aligned with that weekday
      newSessionDates = generateSessionDates(effectiveDay, newSessionCount, formatToYYYYMMDD(new Date()));
    } else if (newSessionCount !== newSessionDates.length) {
      if (newSessionCount > newSessionDates.length) {
        const lastDate = newSessionDates[newSessionDates.length - 1];
        if (lastDate && /^\d{4}\/\d{2}\/\d{2}$/.test(lastDate)) {
          let cur = new Date(lastDate.replace(/\//g, '-'));
          for (let i = newSessionDates.length; i < newSessionCount; i++) {
            cur = new Date(cur);
            cur.setDate(cur.getDate() + 7);
            newSessionDates.push(formatToYYYYMMDD(cur));
          }
        } else {
          for (let i = newSessionDates.length; i < newSessionCount; i++) {
            newSessionDates.push(`حصة ${i + 1}`);
          }
        }
      } else {
        newSessionDates = newSessionDates.slice(0, newSessionCount);
      }
    }

    const updatedGroup: GroupSheet = {
      ...group,
      teacherName: fields.teacherName !== undefined ? fields.teacherName : group.teacherName,
      subject: fields.subject !== undefined ? fields.subject : group.subject,
      day1: fields.day1 !== undefined ? fields.day1 : group.day1,
      time1: fields.time1 !== undefined ? fields.time1 : group.time1,
      day2: fields.day2 !== undefined ? fields.day2 : group.day2,
      time2: fields.time2 !== undefined ? fields.time2 : group.time2,
      type: fields.type !== undefined ? fields.type : group.type,
      isVip: fields.isVip !== undefined ? fields.isVip : group.isVip,
      sessionCount: newSessionCount,
      sessionDates: newSessionDates,
      studentFee: fields.studentFee !== undefined ? fields.studentFee : group.studentFee,
      teacherPayPerStudent: fields.teacherPayPerStudent !== undefined ? fields.teacherPayPerStudent : group.teacherPayPerStudent,
      schoolSharePerStudent: fields.schoolSharePerStudent !== undefined ? fields.schoolSharePerStudent : group.schoolSharePerStudent,
      status: 'status' in fields ? fields.status : group.status
    };

    // Recalculate students if financial terms or sessions changed
    const recalculatedStudents = group.students.map((s) => {
      let att = [...s.attendance];
      let pay = [...(s.payments || [])];
      while (att.length < newSessionCount) att.push('');
      if (att.length > newSessionCount) att = att.slice(0, newSessionCount);
      while (pay.length < newSessionCount) pay.push('');
      if (pay.length > newSessionCount) pay = pay.slice(0, newSessionCount);

      return calculateStudentFinances(
        { ...s, attendance: att, payments: pay },
        updatedGroup.type,
        data.pricingTiers,
        updatedGroup
      );
    });
    updatedGroup.students = recalculatedStudents;

    const updatedGroupsMeta = data.groups.map((g) => {
      if (g.id === groupId) {
        const next: GroupMeta = {
          ...g,
          ...fields,
          sessionCount: newSessionCount
        };
        if ('status' in fields) {
          next.status = fields.status;
        }
        return next;
      }
      return g;
    });

    persistData({
      ...data,
      groups: updatedGroupsMeta,
      groupData: {
        ...data.groupData,
        [groupId]: updatedGroup
      }
    });
  };

  // Delete group
  const deleteGroup = (groupId: string) => {
    const updatedGroups = data.groups.filter((g) => g.id !== groupId);
    const updatedGroupData = { ...data.groupData };
    delete updatedGroupData[groupId];

    const nextSelected = selectedGroup === groupId ? (updatedGroups[0]?.id || '') : selectedGroup;
    setSelectedGroup(nextSelected);

    persistData({
      ...data,
      groups: updatedGroups,
      groupData: updatedGroupData
    });
  };

  // Rename an existing group (e.g. rename BACV06 to BACV10)
  const renameGroup = (oldId: string, newId: string): boolean => {
    const cleanOld = oldId.trim().toUpperCase();
    const cleanNew = newId.trim().toUpperCase();
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return false;

    const validation = isValidGroupId(cleanNew);
    if (!validation.isValid) return false;

    if (data.groupData[cleanNew] || data.groups.some((g) => g.id.toUpperCase() === cleanNew)) {
      return false;
    }

    const groupSheet = data.groupData[cleanOld];
    if (!groupSheet) return false;

    const isVip = isVipGroupId(cleanNew) || groupSheet.isVip;

    const newGroupData = { ...data.groupData };
    delete newGroupData[cleanOld];
    newGroupData[cleanNew] = {
      ...groupSheet,
      groupId: cleanNew,
      isVip
    };

    const newGroups = data.groups.map((g) =>
      g.id.toUpperCase() === cleanOld
        ? { ...g, id: cleanNew, isVip }
        : g
    );

    const updatedData: CenterData = {
      ...data,
      groups: newGroups,
      groupData: newGroupData
    };

    persistData(updatedData);

    if (selectedGroup.toUpperCase() === cleanOld) {
      setSelectedGroup(cleanNew);
    }

    return true;
  };

  // Add teacher
  const addTeacher = (teacher: Teacher) => {
    const updatedData: CenterData = {
      ...data,
      teachers: [...data.teachers, teacher]
    };
    persistData(updatedData);
  };

  // Update teacher
  const updateTeacher = (id: string, fields: Partial<Teacher>) => {
    const updatedTeachers = data.teachers.map((t) => (t.id === id ? { ...t, ...fields } : t));
    persistData({ ...data, teachers: updatedTeachers });
  };

  // Pay teacher
  const payTeacher = (
    teacherId: string,
    amount: number,
    paymentMethod: string = 'نقداً',
    notes: string = ''
  ): TeacherPaymentRecord | null => {
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (!teacher || Number(amount) <= 0) return null;

    const receiptNo = `TP-${teacher.id}-${Date.now().toString().slice(-4)}`;
    const newPayment: TeacherPaymentRecord = {
      id: `tp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toLocaleDateString('ar-DZ'),
      time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
      amount: Number(amount),
      paymentMethod,
      receiptNo,
      notes: notes.trim()
    };

    const currentHistory = teacher.paymentHistory || [];
    const updatedHistory = [newPayment, ...currentHistory];
    const newPaidAmount = (teacher.paidAmount || 0) + Number(amount);

    const updatedTeachers = data.teachers.map((t) =>
      t.id === teacherId ? { ...t, paidAmount: newPaidAmount, paymentHistory: updatedHistory } : t
    );

    persistData({ ...data, teachers: updatedTeachers });
    return newPayment;
  };

  // Delete/Cancel teacher payment
  const deleteTeacherPayment = (teacherId: string, paymentId: string) => {
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (!teacher || !teacher.paymentHistory) return;

    const paymentToDelete = teacher.paymentHistory.find((p) => p.id === paymentId);
    if (!paymentToDelete) return;

    const updatedHistory = teacher.paymentHistory.filter((p) => p.id !== paymentId);
    const newPaidAmount = Math.max(0, (teacher.paidAmount || 0) - paymentToDelete.amount);

    const updatedTeachers = data.teachers.map((t) =>
      t.id === teacherId ? { ...t, paidAmount: newPaidAmount, paymentHistory: updatedHistory } : t
    );

    persistData({ ...data, teachers: updatedTeachers });
  };

  // Update pricing tier
  const updatePricingTier = (id: string, fields: Partial<PricingTier>) => {
    const updatedTiers = data.pricingTiers.map((t) => (t.id === id ? { ...t, ...fields } : t));
    
    // Recalculate all students with the new tiers
    const updatedGroupData: Record<string, GroupSheet> = {};
    for (const [gid, gSheet] of Object.entries(data.groupData)) {
      const recalculatedStudents = gSheet.students.map((s) =>
        calculateStudentFinances(s, gSheet.type, updatedTiers)
      );
      updatedGroupData[gid] = { ...gSheet, students: recalculatedStudents };
    }

    persistData({
      ...data,
      pricingTiers: updatedTiers,
      groupData: updatedGroupData
    });
  };

  // Update session dates for a group
  const updateSessionDates = (groupId: string, dates: string[]) => {
    const group = data.groupData[groupId];
    if (!group) return;

    // Ensure students' attendance and payments arrays have at least dates.length elements
    const updatedStudents = group.students.map((s) => {
      let nextAtt = [...s.attendance];
      let nextPay = [...s.payments];

      if (dates.length > nextAtt.length) {
        const diff = dates.length - nextAtt.length;
        nextAtt = [...nextAtt, ...Array(diff).fill('')];
      }
      if (dates.length > nextPay.length) {
        const diff = dates.length - nextPay.length;
        nextPay = [...nextPay, ...Array(diff).fill('')];
      }

      return calculateStudentFinances(
        { ...s, attendance: nextAtt, payments: nextPay },
        group.type,
        data.pricingTiers
      );
    });

    const updatedGroup: GroupSheet = {
      ...group,
      sessionDates: dates,
      sessionCount: dates.length,
      students: updatedStudents
    };

    const updatedGroupsMeta = data.groups.map((g) =>
      g.id === groupId ? { ...g, sessionCount: dates.length } : g
    );

    persistData({
      ...data,
      groups: updatedGroupsMeta,
      groupData: {
        ...data.groupData,
        [groupId]: updatedGroup
      }
    });
  };

  // Dynamically change the number of sessions for a group
  const updateGroupSessionCount = (groupId: string, newCount: number) => {
    if (newCount < 1 || newCount > 30) return;
    const group = data.groupData[groupId];
    if (!group) return;

    let newDates = [...group.sessionDates];
    if (newCount > newDates.length) {
      for (let i = newDates.length; i < newCount; i++) {
        newDates.push(`حصة ${i + 1}`);
      }
    } else if (newCount < newDates.length) {
      newDates = newDates.slice(0, newCount);
    }

    updateSessionDates(groupId, newDates);
  };

  // Reset to default seed data
  const resetToDefault = () => {
    const { cleaned } = sanitizeData(initialSeedData as unknown as CenterData);
    persistData(cleaned);
  };

  // Export data as JSON file
  const exportDataJson = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `da3m_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import data from JSON file
  const importDataJson = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString) as CenterData;
      if (parsed && parsed.groupData && parsed.teachers) {
        const { cleaned } = sanitizeData(parsed);
        persistData(cleaned);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to parse imported json', e);
      return false;
    }
  };

  // Group Stats
  const getGroupStats = (groupId: string) => {
    const group = data.groupData[groupId];
    if (!group || !group.students) {
      return {
        studentCount: 0,
        totalExpected: 0,
        totalReceived: 0,
        totalTeacherPay: 0,
        totalSchoolEarn: 0,
        totalDebt: 0,
        attendanceRate: 0
      };
    }

    const realStudents = group.students.filter((s) => !isSummaryRow(s, groupId));
    const studentCount = realStudents.length;
    let totalExpected = 0;
    let totalReceived = 0;
    let totalTeacherPay = 0;
    let totalSchoolEarn = 0;
    let totalDebt = 0;
    let totalPresentSlots = 0;
    const cycleSessions = group.sessionCount || 4;
    let totalPossibleSlots = 0;

    const groupEnded = isGroupEnded(group, undefined, dataRef.current.pricingTiers);

    realStudents.forEach((s) => {
      totalExpected += s.fee || 0;
      totalReceived += s.totalReceived || 0;
      totalTeacherPay += s.teacherPay || 0;
      totalSchoolEarn += s.schoolEarn || 0;
      totalDebt += s.debt && s.debt > 0 ? s.debt : 0;
      totalPresentSlots += (s.attendance || []).filter((a) => a === 'P' || a === 'M').length;

      const info = getStudentSessionInfo(s.attendance, cycleSessions, s.totalReceived, groupEnded);
      const isOneSessionUnpaid = groupEnded && (s.attendance || []).filter((a) => a === 'P' || a === 'M').length === 1 && (s.totalReceived || 0) === 0 && s.discount !== 'تعويض';
      totalPossibleSlots += info.countedSessions > 0 ? info.countedSessions : (isOneSessionUnpaid ? 0 : cycleSessions);
    });

    const attendanceRate = totalPossibleSlots > 0 ? Math.round((totalPresentSlots / totalPossibleSlots) * 100) : 0;

    return {
      studentCount,
      totalExpected,
      totalReceived,
      totalTeacherPay,
      totalSchoolEarn,
      totalDebt,
      attendanceRate
    };
  };

  // Center Stats with dynamic period and group filters
  const getCenterStats = (filter?: CenterStatsFilter): CenterStatsResult => {
    let totalStudentsSet = new Set<string>();
    let totalGroupsCount = 0;
    let totalTeachersSet = new Set<string>();
    let totalExpected = 0;
    let totalReceived = 0;
    let totalTeacherPay = 0;
    let totalSchoolEarn = 0;
    let totalDebt = 0;
    let matchingSessionsCount = 0;

    const pType = filter?.periodType || 'all';
    let minDate: string | null = null;
    let maxDate: string | null = null;
    let periodLabel = 'كامل الموسم';

    if (pType === 'today') {
      const todayStr = formatToYYYYMMDD(new Date());
      minDate = todayStr;
      maxDate = todayStr;
      periodLabel = `اليوم (${todayStr})`;
    } else if (pType === 'this_week') {
      const now = new Date();
      const day = now.getDay();
      const diffToSat = (day + 1) % 7;
      const sat = new Date(now);
      sat.setDate(now.getDate() - diffToSat);
      const fri = new Date(sat);
      fri.setDate(sat.getDate() + 6);
      minDate = formatToYYYYMMDD(sat);
      maxDate = formatToYYYYMMDD(fri);
      periodLabel = `هذا الأسبوع (${minDate} - ${maxDate})`;
    } else if (pType === 'this_month') {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      minDate = `${y}/${m}/01`;
      maxDate = `${y}/${m}/31`;
      periodLabel = `شهر ${m}/${y}`;
    } else if (pType === 'prev_month') {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prev.getFullYear();
      const pm = String(prev.getMonth() + 1).padStart(2, '0');
      minDate = `${py}/${pm}/01`;
      maxDate = `${py}/${pm}/31`;
      periodLabel = `شهر ${pm}/${py}`;
    } else if (pType === 'custom') {
      minDate = filter?.startDate ? formatToYYYYMMDD(filter.startDate) : null;
      maxDate = filter?.endDate ? formatToYYYYMMDD(filter.endDate) : null;
      periodLabel = `فترة مخصصة (${minDate || 'البداية'} إلى ${maxDate || 'النهاية'})`;
    }

    const isAllPeriod = !minDate && !maxDate;
    const targetGroupId = filter?.groupId && filter.groupId !== 'all' ? filter.groupId : null;
    const targetGroupType = filter?.groupType && filter.groupType !== 'all' ? filter.groupType : null;

    // Calculate overall center totals across all groups
    let totalCenterStudents = 0;
    let totalCenterActiveStudents = 0;
    let totalCenterActiveGroups = 0;
    Object.entries(data.groupData).forEach(([gid, g]) => {
      const groupMeta: GroupMeta = data.groups.find((gm) => gm.id === gid) || {
        id: gid,
        teacherId: '',
        teacherName: g.teacherName || '',
        subject: g.subject || '',
        day1: g.day1 || '',
        time1: g.time1 || '',
        day2: g.day2,
        time2: g.time2,
        type: g.type || 'normal',
        isVip: gid.startsWith('BACV') || Boolean(g.isVip),
        sessionCount: g.sessionCount || 4
      };
      const isAct = isGroupActive(groupMeta, g, data.pricingTiers);
      const real = (g.students || []).filter((s) => !isSummaryRow(s, gid));
      totalCenterStudents += real.length;
      if (isAct) {
        totalCenterActiveStudents += real.length;
        totalCenterActiveGroups++;
      }
    });
    const totalCenterGroups = data.groups.length;

    let activeStudentsCount = 0;
    let activeGroupsCount = 0;

    Object.entries(data.groupData).forEach(([gid, g]) => {
      if (targetGroupId && gid !== targetGroupId) return;

      const isVipGroup = Boolean(gid.startsWith('BACV') || g.isVip || (g.type && g.type.includes('10000')));
      if (targetGroupType === 'regular' && isVipGroup) return;
      if (targetGroupType === 'vip' && !isVipGroup) return;

      const groupMeta: GroupMeta = data.groups.find((gm) => gm.id === gid) || {
        id: gid,
        teacherId: '',
        teacherName: g.teacherName || '',
        subject: g.subject || '',
        day1: g.day1 || '',
        time1: g.time1 || '',
        day2: g.day2,
        time2: g.time2,
        type: g.type || 'normal',
        isVip: isVipGroup,
        sessionCount: g.sessionCount || 4
      };
      const isCurrentGroupActive = isGroupActive(groupMeta, g, data.pricingTiers);

      const sessionDates = g.sessionDates || [];
      const totalSessions = g.sessionCount || sessionDates.length || 4;
      const teacherRatio = isVipGroup ? 0.75 : 0.60;

      let matchedIndices: number[] = [];
      if (isAllPeriod) {
        matchedIndices = sessionDates.map((_, i) => i);
      } else {
        sessionDates.forEach((dStr, idx) => {
          const norm = formatToYYYYMMDD(dStr);
          if ((!minDate || norm >= minDate) && (!maxDate || norm <= maxDate)) {
            matchedIndices.push(idx);
          }
        });
      }

      // If group has no sessions in selected period and we are filtering by dates, skip
      if (!isAllPeriod && matchedIndices.length === 0) return;

      totalGroupsCount++;
      if (isCurrentGroupActive) {
        activeGroupsCount++;
      }
      if (g.teacherName) totalTeachersSet.add(g.teacherName);
      matchingSessionsCount += matchedIndices.length;

      const realStudents = (g.students || []).filter((s) => !isSummaryRow(s, gid));

      if (isCurrentGroupActive) {
        activeStudentsCount += realStudents.length;
      }

      realStudents.forEach((s) => {
        let fee = 0;
        let rec = 0;
        let tea = 0;
        let sch = 0;
        let debt = 0;

        if (isAllPeriod) {
          fee = s.fee || 0;
          rec = s.totalReceived || 0;
          tea = s.teacherPay || (s.discount === '0' ? 0 : Math.round(fee * teacherRatio));
          sch = s.schoolEarn || (fee - tea);
          debt = s.debt || Math.max(0, fee - rec);
        } else {
          const fraction = totalSessions > 0 ? matchedIndices.length / totalSessions : 1;
          fee = Math.round((s.fee || 0) * fraction);
          rec = matchedIndices.reduce((sum, idx) => sum + (Number(s.payments?.[idx]) || 0), 0);
          tea = s.discount === '0' ? 0 : Math.round(fee * teacherRatio);
          sch = fee - tea;
          debt = Math.max(0, fee - rec);
        }

        totalStudentsSet.add(`${s.name}_${gid}`);
        totalExpected += fee;
        totalReceived += rec;
        totalTeacherPay += tea;
        totalSchoolEarn += sch;
        totalDebt += debt;
      });
    });

    const totalStudents = isAllPeriod && !targetGroupId && !targetGroupType
      ? Object.values(data.groupData).reduce((sum, g) => sum + (g.students || []).filter((s) => !isSummaryRow(s, g.groupId)).length, 0)
      : totalStudentsSet.size;

    const totalTeachers = isAllPeriod && !targetGroupId && !targetGroupType
      ? data.teachers.length
      : totalTeachersSet.size;

    return {
      totalStudents,
      activeStudents: isAllPeriod && !targetGroupId && !targetGroupType ? totalCenterActiveStudents : activeStudentsCount,
      activeGroups: isAllPeriod && !targetGroupId && !targetGroupType ? totalCenterActiveGroups : activeGroupsCount,
      totalCenterStudents,
      totalCenterGroups,
      totalCenterActiveStudents,
      totalCenterActiveGroups,
      totalGroups: isAllPeriod && !targetGroupId && !targetGroupType ? data.groups.length : totalGroupsCount,
      totalTeachers,
      totalExpected,
      totalReceived,
      totalTeacherPay,
      totalSchoolEarn,
      totalDebt,
      matchingSessionsCount,
      periodLabel
    };
  };

  // Update center settings (center name, cycle, academic year)
  const updateCenterSettings = (settings: Partial<{ centerName: string; cycle: string; academicYear: string }>) => {
    const currentData = dataRef.current;
    const updatedData: CenterData = {
      ...currentData,
      ...(settings.centerName ? { centerName: settings.centerName } : {}),
      ...(settings.cycle ? { cycle: settings.cycle } : {}),
      ...(settings.academicYear ? { academicYear: settings.academicYear } : {})
    };
    persistData(updatedData);
  };

  return (
    <AppContext.Provider
      value={{
        data,
        isLoading,
        selectedGroup,
        setSelectedGroup,
        theme,
        toggleTheme,
        lang,
        toggleLang,
        cloudSyncStatus,
        lastSyncedAt,
        syncNow,
        printQueue,
        addToPrintQueue,
        removeFromPrintQueue,
        clearPrintQueue,
        endSessionAndMarkAbsent,
        recordCoverAttendance,
        recordAttendanceAndPayment,
        cycleAttendance,
        updateAttendance,
        markAllPresent,
        updatePayment,
        updateStudentFullFinances,
        batchUpdateSessionPayments,
        batchUpdateAllSessionsPayments,
        updateDiscount,
        addStudent,
        enrollStudentMultiGroups,
        recordMultiGroupPayment,
        deleteStudent,
        restoreStudent,
        clearRecycleBin,
        transferStudent,
        updateStudent,
        addGroup,
        renewGroupWithStudents,
        updateGroup,
        renameGroup,
        deleteGroup,
        updateGroupFinances,
        addTeacher,
        updateTeacher,
        payTeacher,
        deleteTeacherPayment,
        updatePricingTier,
        updateSessionDates,
        updateGroupSessionCount,
        resetToDefault,
        exportDataJson,
        importDataJson,
        getGroupStats,
        getCenterStats,
        updateCenterSettings
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
