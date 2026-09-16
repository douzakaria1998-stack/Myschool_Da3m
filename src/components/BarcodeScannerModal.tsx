'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StudentRecord, GroupSheet, QueuedReceipt } from '../types';
import {
  Scan,
  X,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Printer,
  Clock,
  ArrowRight,
  UserCheck,
  UserX,
  CreditCard,
  FileText,
  ListOrdered,
  HelpCircle,
  Sparkles,
  Layers,
  ChevronDown,
  Plus,
  Trash2
} from 'lucide-react';
import { playSuccessChime, playWarningAlert } from '../utils/soundUtils';
import { printSingleThermalReceipt, printBatchThermalReceipts, ThermalReceiptData } from '../utils/printUtils';
import {
  isSummaryRow,
  formatToYYYYMMDD,
  isSessionDateToday,
  detectCurrentActiveGroupAndSession,
  ActiveGroupDetectionResult,
  formatGroupTime,
  getDefaultSessionIndex
} from '../utils/sessionUtils';
import { getBarcodeCandidates, normalizeArabicName } from '../utils/barcodeUtils';

interface Props {
  initialGroupId?: string;
  onClose: () => void;
}

export default function BarcodeScannerModal({ initialGroupId, onClose }: Props) {
  const {
    data,
    updateAttendance,
    updatePayment,
    recordAttendanceAndPayment,
    recordCoverAttendance,
    endSessionAndMarkAbsent,
    printQueue,
    addToPrintQueue,
    removeFromPrintQueue,
    clearPrintQueue
  } = useApp();

  // Smart Session Auto-Detection Engine
  const [autoDetectSchedule, setAutoDetectSchedule] = useState<boolean>(false);
  const [currentDetection, setCurrentDetection] = useState<ActiveGroupDetectionResult>(() =>
    detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date())
  );

  // Fast continuous scan mode: automatically marks attendance and warns of debt without blocking the scanner
  const [fastScanMode, setFastScanMode] = useState<boolean>(false);

  // Active Groups configuration (supports multiple concurrent groups running at the same time!)
  const [activeGroups, setActiveGroups] = useState<{ groupId: string; sessionIndex: number }[]>(() => {
    // 1. If initialGroupId is explicitly passed, ALWAYS prioritize it as the primary active group!
    if (initialGroupId && data.groupData[initialGroupId]) {
      const gSheet = data.groupData[initialGroupId];
      const sIdx = getDefaultSessionIndex(gSheet, new Date());
      return [{ groupId: initialGroupId, sessionIndex: sIdx }];
    }

    // 2. Otherwise try auto-detection based on current schedule
    const initialDetect = detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date());
    if (initialDetect.matchingGroups.length > 0) {
      return initialDetect.matchingGroups.map((m) => ({
        groupId: m.group.groupId,
        sessionIndex: m.sessionIndex
      }));
    }
    if (initialDetect.activeGroup) {
      return [{ groupId: initialDetect.activeGroup.groupId, sessionIndex: initialDetect.activeSessionIndex }];
    }

    // 3. Fallback to first available group with smart default session
    const defaultGid = initialGroupId || data.groups[0]?.id || 'BAC01';
    const gSheet = data.groupData[defaultGid];
    const sIdx = gSheet ? getDefaultSessionIndex(gSheet, new Date()) : 0;
    return [{ groupId: defaultGid, sessionIndex: sIdx }];
  });

  // Keep primary active group synced if initialGroupId prop changes
  useEffect(() => {
    if (initialGroupId && data.groupData[initialGroupId]) {
      const gSheet = data.groupData[initialGroupId];
      const sIdx = getDefaultSessionIndex(gSheet, new Date());
      setActiveGroups((prev) => {
        if (prev.length > 0 && prev[0].groupId === initialGroupId && prev[0].sessionIndex === sIdx) {
          return prev;
        }
        const filtered = prev.filter((ag) => ag.groupId !== initialGroupId);
        return [{ groupId: initialGroupId, sessionIndex: sIdx }, ...filtered];
      });
    }
  }, [initialGroupId]);

  // Backward-compatible accessors for primary active group
  const primaryActive = activeGroups[0] || {
    groupId: initialGroupId || data.groups[0]?.id || 'BAC01',
    sessionIndex: data.groupData[initialGroupId || 'BAC01']
      ? getDefaultSessionIndex(data.groupData[initialGroupId || 'BAC01'], new Date())
      : 0
  };
  const activeGroupId = primaryActive.groupId;
  const activeSessionIdx = primaryActive.sessionIndex;
  const activeGroup = data.groupData[activeGroupId] as GroupSheet | undefined;

  // Handlers to manage active groups
  const handleAddActiveGroup = (defaultGid?: string) => {
    const existingIds = new Set(activeGroups.map((g) => g.groupId));
    const candidate = data.groups.find((g) => !existingIds.has(g.id)) || data.groups[0];
    if (!candidate) return;

    const gid = defaultGid || candidate.id;
    const groupSheet = data.groupData[gid];
    const sIdx = groupSheet ? getDefaultSessionIndex(groupSheet, new Date()) : 0;
    setActiveGroups((prev) => [...prev, { groupId: gid, sessionIndex: sIdx }]);
  };

  const handleRemoveActiveGroup = (index: number) => {
    if (activeGroups.length <= 1) {
      alert('يجب أن يبقى فوج نشط واحد على الأقل في محطة المسح');
      return;
    }
    setActiveGroups((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateActiveGroup = (index: number, newGroupId: string) => {
    const groupSheet = data.groupData[newGroupId];
    const sIdx = groupSheet ? getDefaultSessionIndex(groupSheet, new Date()) : 0;
    setActiveGroups((prev) =>
      prev.map((item, i) => (i === index ? { groupId: newGroupId, sessionIndex: sIdx } : item))
    );
    resetForNextStudent();
  };

  const handleUpdateActiveSession = (index: number, newSessionIdx: number) => {
    setActiveGroups((prev) =>
      prev.map((item, i) => (i === index ? { ...item, sessionIndex: newSessionIdx } : item))
    );
  };

  // Periodic re-check of active schedule every 25 seconds
  useEffect(() => {
    const checkSchedule = () => {
      const res = detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date());
      setCurrentDetection(res);
      if (autoDetectSchedule && res.matchingGroups.length > 0) {
        const detectedConfigs = res.matchingGroups.map((m) => ({
          groupId: m.group.groupId,
          sessionIndex: m.sessionIndex
        }));
        setActiveGroups((prev) => {
          const prevKeys = prev.map((g) => `${g.groupId}-${g.sessionIndex}`).sort().join(',');
          const detKeys = detectedConfigs.map((g) => `${g.groupId}-${g.sessionIndex}`).sort().join(',');
          if (prevKeys !== detKeys && prev.length <= 1) {
            return detectedConfigs;
          }
          return prev;
        });
      }
    };
    checkSchedule();
    const timer = setInterval(checkSchedule, 25000);
    return () => clearInterval(timer);
  }, [data.groupData, data.groups, autoDetectSchedule]);

  // Scanner Barcode Input State
  const [barcodeInput, setBarcodeInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scanned Student resolution
  const [scannedResult, setScannedResult] = useState<{
    student: StudentRecord;
    homeGroupId: string;
    isInActiveGroup: boolean;
    studentEnrolledGroups: string[];
  } | null>(null);

  // Scan session execution context (records which active group was matched for payment & attendance)
  const [currentScanContext, setCurrentScanContext] = useState<{
    groupId: string;
    sessionIdx: number;
    isCover: boolean;
    originalGid?: string;
    student: StudentRecord;
  } | null>(null);

  // Multi-Match Candidate state (when student is enrolled in 2+ active groups)
  const [multiActiveCandidate, setMultiActiveCandidate] = useState<{
    student: StudentRecord;
    matchingActiveGroups: { groupId: string; sessionIndex: number }[];
    result: {
      student: StudentRecord;
      homeGroupId: string;
      isInActiveGroup: boolean;
      studentEnrolledGroups: string[];
    };
  } | null>(null);

  // Workflow Dialog States
  // 1. Covering Dialog: When student is not in any active group
  const [showCoverDialog, setShowCoverDialog] = useState(false);
  const [selectedOriginalGroup, setSelectedOriginalGroup] = useState('');
  const [coverTargetActiveGroupId, setCoverTargetActiveGroupId] = useState<string>('');

  // 2. Unpaid / Payment Dialog: When student has debt or unpaid session
  const [showUnpaidDialog, setShowUnpaidDialog] = useState(false);
  const [willPayNow, setWillPayNow] = useState<boolean | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [unpaidInfo, setUnpaidInfo] = useState<{
    effectiveDebt: number;
    expectedCycleFee: number;
    perSessionPrice: number;
    totalPaid: number;
    isNewUnpaid: boolean;
  } | null>(null);

  // 3. Flash Success Message
  const [flashSuccess, setFlashSuccess] = useState<{
    name: string;
    statusText: string;
    details: string;
  } | null>(null);

  // 4. End Session Confirmation Modal
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [endSessionTarget, setEndSessionTarget] = useState<{ groupId: string; sessionIndex: number } | 'ALL' | null>(null);
  const [endSessionStats, setEndSessionStats] = useState<{
    presentCount: number;
    makeupCount: number;
    absentCount: number;
    groupLabel?: string;
  } | null>(null);

  // 5. Print Queue Modal view
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Keep scanner input focused at all times for hardware scanners
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !showCoverDialog &&
        !showUnpaidDialog &&
        !showEndSessionConfirm &&
        !showQueueModal &&
        !multiActiveCandidate &&
        document.activeElement !== scannerInputRef.current
      ) {
        scannerInputRef.current?.focus();
      }
    }, 400);
    return () => clearInterval(timer);
  }, [showCoverDialog, showUnpaidDialog, showEndSessionConfirm, showQueueModal, multiActiveCandidate]);

  // Global scanner keystroke interceptor: captures rapid scanner typing anywhere in the window
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an interactive modal/dialog or payment input is active
      if (showCoverDialog || showUnpaidDialog || showEndSessionConfirm || showQueueModal || Boolean(multiActiveCandidate)) {
        return;
      }

      // If user is already focused on another input, let them type normally
      if (
        document.activeElement &&
        document.activeElement.tagName === 'INPUT' &&
        document.activeElement !== scannerInputRef.current
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      // Enter key: finalize scan
      if (e.key === 'Enter') {
        const candidate = (document.activeElement === scannerInputRef.current ? barcodeInput : buffer).trim();
        if (candidate.length >= 1) {
          e.preventDefault();
          buffer = '';
          handleBarcodeSubmit(undefined, candidate);
        }
        return;
      }

      // Ignore navigation keys
      if (e.key === 'Tab' || e.key === 'Escape' || (e.key.length > 1 && e.key !== 'Backspace')) {
        return;
      }

      // Reset buffer on long pauses
      if (timeDiff > 400 && buffer.length > 0) {
        buffer = '';
      }

      if (e.key === 'Backspace') {
        buffer = buffer.slice(0, -1);
      } else if (e.key.length === 1) {
        buffer += e.key;
      }

      // Sync with input field if it was not focused
      if (document.activeElement !== scannerInputRef.current && buffer.length > 0) {
        setBarcodeInput(buffer);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showCoverDialog, showUnpaidDialog, showEndSessionConfirm, showQueueModal, multiActiveCandidate, barcodeInput]);

  // Clean up scan timer on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Reset scanner state for the next student
  const resetForNextStudent = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setBarcodeInput('');
    setScannedResult(null);
    setCurrentScanContext(null);
    setMultiActiveCandidate(null);
    setShowCoverDialog(false);
    setSelectedOriginalGroup('');
    setCoverTargetActiveGroupId('');
    setShowUnpaidDialog(false);
    setWillPayNow(null);
    setPayAmount('');
    setUnpaidInfo(null);
    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 50);
  };

  // Find student across all groups by barcode, phone, ID or name using decoded candidate permutations
  const findStudentByCode = (code: string, targetGroupId: string = activeGroupId) => {
    if (!code) return null;
    const cleanRaw = code.trim();
    const candidates = getBarcodeCandidates(cleanRaw);
    if (candidates.length === 0) return null;

    const doesStudentMatch = (s: StudentRecord, gid: string): boolean => {
      if (isSummaryRow(s, gid)) return false;

      const sBarcodeUpper = (s.barcode || '').trim().toUpperCase();
      const sBarcodeAlpha = sBarcodeUpper.replace(/[^A-Z0-9]/g, '');
      const sIdUpper = `${gid}-${s.rowId}`.toUpperCase();
      const sId2 = `${gid}-${String(s.rowId).padStart(2, '0')}`.toUpperCase();
      const sId3 = `${gid}-${String(s.rowId).padStart(3, '0')}`.toUpperCase();
      const sIdAlpha = `${gid}${s.rowId}`.toUpperCase();
      const sRowStr = String(s.rowId);
      const sPhoneClean = (s.phone || '').replace(/[^0-9]/g, '');
      const sNameNorm = normalizeArabicName(s.name);

      for (const cand of candidates) {
        const candUpper = cand.trim().toUpperCase();
        const candAlpha = candUpper.replace(/[^A-Z0-9]/g, '');
        const candDigits = cand.replace(/[^0-9]/g, '');
        const candNorm = normalizeArabicName(cand);

        // 1. Unique Student Barcode match (e.g. STU-26000008 or STU-26000017)
        if (sBarcodeUpper && (candUpper === sBarcodeUpper || (sBarcodeAlpha && candAlpha === sBarcodeAlpha))) {
          return true;
        }

        // 2. Exact Group ID + rowId permutations (e.g. BACV01-8 ONLY matches student in BACV01 with row 8)
        if (
          candUpper === sIdUpper ||
          candUpper === sId2 ||
          candUpper === sId3 ||
          (candAlpha && candAlpha === sIdAlpha)
        ) {
          return true;
        }

        // 3. Phone number match
        if (sPhoneClean && candDigits && candDigits.length >= 8 && (candDigits === sPhoneClean || sPhoneClean.endsWith(candDigits))) {
          return true;
        }

        // 4. Name match (normalized)
        if (sNameNorm && (candNorm === sNameNorm || sNameNorm.includes(candNorm) || candNorm.includes(sNameNorm))) {
          return true;
        }
      }

      // 5. Manual entry of row number ONLY if user typed a short number (1-3 digits) directly
      if (/^\d{1,3}$/.test(cleanRaw) && gid === targetGroupId && sRowStr === cleanRaw) {
        return true;
      }

      return false;
    };

    let foundStudent: StudentRecord | null = null;
    let homeGid = '';

    // 1. Search in target/active group first
    const targetGroup = data.groupData[targetGroupId] || activeGroup;
    if (targetGroup?.students) {
      const matchInActive = targetGroup.students.find((s) => doesStudentMatch(s, targetGroupId));
      if (matchInActive) {
        foundStudent = matchInActive;
        homeGid = targetGroupId;
      }
    }

    // 2. Search across all other groups if not found in target
    if (!foundStudent) {
      for (const [gid, sheet] of Object.entries(data.groupData)) {
        if (gid === targetGroupId) continue;
        for (const s of sheet.students || []) {
          if (doesStudentMatch(s, gid)) {
            foundStudent = s;
            homeGid = gid;
            break;
          }
        }
        if (foundStudent) break;
      }
    }

    if (!foundStudent) return null;

    // Collect all groups this student is enrolled in (linked by unique barcode and name)
    const studentCleanName = normalizeArabicName(foundStudent.name);
    const enrolledGroups: string[] = [];
    for (const [gid, sheet] of Object.entries(data.groupData)) {
      if (
        sheet.students.some(
          (s) =>
            !isSummaryRow(s, gid) &&
            ((foundStudent?.barcode && s.barcode && s.barcode === foundStudent.barcode) ||
              normalizeArabicName(s.name) === studentCleanName)
        )
      ) {
        enrolledGroups.push(gid);
      }
    }

    return {
      student: foundStudent,
      homeGroupId: homeGid,
      isInActiveGroup: enrolledGroups.includes(targetGroupId),
      studentEnrolledGroups: enrolledGroups
    };
  };

  // Process a scanned card / barcode
  const handleBarcodeSubmit = (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    const rawCode = (directCode !== undefined ? directCode : barcodeInput).trim();
    if (!rawCode) return;

    // If an unpaid dialog was currently open, dismiss it (previous student is already recorded as Present)
    if (showUnpaidDialog) {
      setShowUnpaidDialog(false);
      setWillPayNow(null);
      setPayAmount('');
      setUnpaidInfo(null);
    }

    // Use current active groups list
    let currentActiveGroups = activeGroups;

    // Smart Session Auto-Detection at the moment of scan
    if (autoDetectSchedule) {
      const liveDetect = detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date());
      if (liveDetect.matchingGroups.length > 0) {
        currentActiveGroups = liveDetect.matchingGroups.map((m) => ({
          groupId: m.group.groupId,
          sessionIndex: m.sessionIndex
        }));
        setActiveGroups(currentActiveGroups);
      }
    }

    const primaryGid = currentActiveGroups[0]?.groupId || activeGroupId;
    const result = findStudentByCode(rawCode, primaryGid);

    if (!result) {
      playWarningAlert();
      alert(`لم يتم العثور على أي تلميذ مسجل بالرمز أو الاسم: "${rawCode}"\n\nنصيحة: تأكد من تمرير بطاقة الباركود بشكل سليم أو كتابة رقم التلميذ مباشرة.`);
      setBarcodeInput('');
      return;
    }

    // 1. Identify which of the currently active groups this student belongs to
    const matchingActive = currentActiveGroups.filter((ag) =>
      result.studentEnrolledGroups.includes(ag.groupId)
    );

    if (matchingActive.length === 0) {
      // Step 2: Session Validation & Covering Logic: Not in ANY active group!
      setScannedResult(result);
      setCoverTargetActiveGroupId(currentActiveGroups[0]?.groupId || primaryGid);
      setSelectedOriginalGroup(result.studentEnrolledGroups[0] || result.homeGroupId);
      setShowCoverDialog(true);
      return;
    }

    if (matchingActive.length === 1) {
      // Exactly 1 match among active groups -> INSTANT AUTOMATIC ROUTE!
      const targetAg = matchingActive[0];
      const targetGroup = data.groupData[targetAg.groupId];
      const targetStudent = targetGroup?.students?.find(
        (s) =>
          !isSummaryRow(s, targetAg.groupId) &&
          ((result.student.barcode && s.barcode && s.barcode.toUpperCase() === result.student.barcode.toUpperCase()) ||
            normalizeArabicName(s.name) === normalizeArabicName(result.student.name))
      ) || result.student;

      const resolvedResult = {
        ...result,
        student: targetStudent,
        homeGroupId: targetAg.groupId,
        isInActiveGroup: true
      };
      setScannedResult(resolvedResult);
      proceedToPaymentCheck(targetStudent, targetAg.groupId, targetAg.sessionIndex, false);
      return;
    }

    // matchingActive.length > 1:
    // Student enrolled in 2+ groups that are running concurrently at this exact moment!
    // Check if the student has already been marked 'P' in one of them:
    const unattendedMatches = matchingActive.filter((ag) => {
      const g = data.groupData[ag.groupId];
      const s = g?.students?.find(
        (st) =>
          !isSummaryRow(st, ag.groupId) &&
          ((result.student.barcode && st.barcode && st.barcode.toUpperCase() === result.student.barcode.toUpperCase()) ||
            normalizeArabicName(st.name) === normalizeArabicName(result.student.name))
      );
      return s?.attendance?.[ag.sessionIndex] !== 'P';
    });

    if (unattendedMatches.length === 1) {
      // Student already attended the first group, automatically record for the remaining one!
      const targetAg = unattendedMatches[0];
      const targetGroup = data.groupData[targetAg.groupId];
      const targetStudent = targetGroup?.students?.find(
        (s) =>
          !isSummaryRow(s, targetAg.groupId) &&
          ((result.student.barcode && s.barcode && s.barcode.toUpperCase() === result.student.barcode.toUpperCase()) ||
            normalizeArabicName(s.name) === normalizeArabicName(result.student.name))
      ) || result.student;

      const resolvedResult = {
        ...result,
        student: targetStudent,
        homeGroupId: targetAg.groupId,
        isInActiveGroup: true
      };
      setScannedResult(resolvedResult);
      proceedToPaymentCheck(targetStudent, targetAg.groupId, targetAg.sessionIndex, false);
    } else {
      // Prompt admin with a quick 1-click modal to choose which group the student is attending
      setMultiActiveCandidate({
        student: result.student,
        matchingActiveGroups: matchingActive,
        result
      });
    }
  };

  // Step 3: Payment Verification
  const proceedToPaymentCheck = (
    student: StudentRecord,
    groupId: string,
    sessionIdx: number = activeSessionIdx,
    isCover: boolean = false,
    originalGid?: string
  ) => {
    // Record current scan execution context
    setCurrentScanContext({
      groupId,
      sessionIdx,
      isCover,
      originalGid,
      student
    });

    const isAlreadyPresent = student.attendance?.[sessionIdx] === 'P';

    // Pricing & financial expectations for this group
    const targetGroup = data.groupData[groupId] || activeGroup;
    const targetMeta = data.groups.find((g) => g.id === groupId);
    const isVipGroup =
      groupId.toUpperCase().startsWith('BACV') ||
      groupId.toUpperCase().includes('VIP') ||
      Boolean(targetGroup?.isVip) ||
      Boolean(targetMeta?.isVip) ||
      Boolean(targetGroup?.type?.includes('10000')) ||
      Boolean(targetMeta?.type?.includes('10000'));

    const targetType = targetGroup?.type || targetMeta?.type || (isVipGroup ? '4-10000' : '4-2500');
    const tier = data.pricingTiers?.find((t) => t.id === targetType);

    let basePrice = 2500;
    if (typeof targetGroup?.studentFee === 'number' && targetGroup.studentFee > 0) {
      basePrice = targetGroup.studentFee;
    } else if (typeof targetMeta?.studentFee === 'number' && targetMeta.studentFee > 0) {
      basePrice = targetMeta.studentFee;
    } else if (tier && typeof tier.price === 'number' && tier.price > 0) {
      basePrice = tier.price;
    } else if (isVipGroup) {
      basePrice = 10000;
    } else {
      basePrice = 2500;
    }

    const cycleSessions = targetGroup?.sessionDates?.length || targetGroup?.sessionCount || tier?.sessions || 4;

    const expectedCycleFee = student.discount === '0'
      ? 0
      : (student.discount === '0.8' ? Math.round(basePrice * 0.8) : basePrice);
    const perSessionPrice = Math.round(expectedCycleFee / cycleSessions);

    // Total payments recorded so far for this student in this group
    const totalPaid = (student.payments || []).reduce<number>((sum, p) => {
      const val = typeof p === 'number' ? p : parseFloat(String(p));
      return sum + (isNaN(val) ? 0 : val);
    }, 0) || student.totalReceived || 0;

    // Remaining debt or required payment:
    const effectiveDebt = Math.max(0, expectedCycleFee - totalPaid);

    let isPaid = false;
    if (student.discount === '0') {
      // 100% discount / scholarship / exempt
      isPaid = true;
    } else if (student.debt > 0) {
      // Unpaid debt
      isPaid = false;
    } else if (totalPaid <= 0 && expectedCycleFee > 0) {
      // In a new group where student hasn't paid anything: UNPAID!
      isPaid = false;
    } else if (totalPaid >= expectedCycleFee && expectedCycleFee > 0) {
      // Paid full cycle fee
      isPaid = true;
    } else if (student.fee > 0 && student.debt <= 0 && totalPaid > 0) {
      // Fees covered
      isPaid = true;
    } else if (Number(student.payments?.[sessionIdx]) > 0) {
      // Paid for this specific session
      isPaid = true;
    } else if (totalPaid >= (sessionIdx + 1) * perSessionPrice && perSessionPrice > 0) {
      // Sufficient payments to cover up to this session
      isPaid = true;
    } else {
      isPaid = false;
    }

    // CRITICAL: Always record attendance as Present ('P') immediately upon barcode scan!
    if (isCover && originalGid) {
      recordCoverAttendance(groupId, originalGid, student.rowId, sessionIdx);
    } else {
      updateAttendance(groupId, student.rowId, sessionIdx, 'P');
    }

    if (isPaid) {
      // Paid -> Chime, Flash Success, Reset for next student
      playSuccessChime();
      setFlashSuccess({
        name: student.name,
        statusText: isAlreadyPresent
          ? 'التلميذ مسجل حاضر بالفعل ✓'
          : (isCover ? 'حاضر (حصة تعويض) ✓' : 'حاضر (مسدد بالكامل) ✓'),
        details: `فوج ${groupId} • الحصة ${sessionIdx + 1}`
      });

      setTimeout(() => {
        setFlashSuccess(null);
        resetForNextStudent();
      }, 1200);
    } else {
      // Not Paid -> Student IS ALREADY marked Present ('P')!
      playWarningAlert();

      if (fastScanMode) {
        // Fast Scan Mode: notify of debt via prominent banner without blocking the barcode scanner
        setFlashSuccess({
          name: student.name,
          statusText: `حاضر ⚠️ (مدين: ${effectiveDebt.toLocaleString()} دج)`,
          details: `فوج ${groupId} • الحصة ${sessionIdx + 1}`
        });

        setTimeout(() => {
          setFlashSuccess(null);
          resetForNextStudent();
        }, 1400);
      } else {
        // Standard Mode: display dialog to collect payment or confirm debtor status
        setUnpaidInfo({
          effectiveDebt,
          expectedCycleFee,
          perSessionPrice,
          totalPaid,
          isNewUnpaid: totalPaid === 0
        });
        setShowUnpaidDialog(true);
        setPayAmount(String(effectiveDebt > 0 ? effectiveDebt : perSessionPrice));
      }
    }
  };

  // Payment Processing: User chose "No, student will not pay now" (Confirm debtor presence)
  const handleUnpaidNoPayment = (allowEntryAsDebtor: boolean = true) => {
    if (!scannedResult || !currentScanContext) return;
    const { groupId, sessionIdx, isCover, originalGid, student } = currentScanContext;

    // Student attendance has already been recorded as Present ('P').
    const debtToShow = unpaidInfo?.effectiveDebt || student.debt || 0;
    setFlashSuccess({
      name: student.name,
      statusText: 'تم تأكيد الحضور كمدين ⚠️',
      details: `فوج ${groupId} • المتبقي في الذمة: ${debtToShow.toLocaleString()} دج`
    });

    setTimeout(() => {
      setFlashSuccess(null);
      resetForNextStudent();
    }, 1200);
  };

  // Payment Processing: "Save and Print" or "Next and Print Later"
  const handleProcessPayment = (printImmediately: boolean) => {
    if (!scannedResult || !currentScanContext) return;
    const { groupId, sessionIdx, isCover, originalGid, student } = currentScanContext;

    const amountNum = Number(payAmount) || 0;
    const targetGroup = data.groupData[groupId];

    // 1. Save payment & mark attendance atomically
    if (isCover && originalGid) {
      recordCoverAttendance(groupId, originalGid, student.rowId, sessionIdx, amountNum);
    } else {
      recordAttendanceAndPayment(groupId, student.rowId, sessionIdx, isCover ? 'M' : 'P', amountNum);
    }

    playSuccessChime();

    // Receipt preparation
    const receiptNo = `${groupId}-${student.rowId.toString().padStart(3, '0')}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-DZ');
    const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    const totalFee = unpaidInfo?.expectedCycleFee || student.fee || (targetGroup?.type?.includes('10000') ? 10000 : 2500);
    const totalPaid = (student.totalReceived || 0) + amountNum;
    const balance = totalPaid - totalFee;

    const receiptData: ThermalReceiptData = {
      receiptNo,
      centerName: data.centerName,
      cycle: data.cycle,
      academicYear: data.academicYear,
      date: dateStr,
      time: timeStr,
      studentName: student.name,
      studentPhone: student.phone,
      groupId: groupId,
      subject: targetGroup?.subject || '',
      teacherName: targetGroup?.teacherName || '',
      amount: amountNum,
      totalFee,
      totalPaid,
      balance,
      isCover,
      originalGroup: originalGid
    };

    if (printImmediately) {
      // Button 1: Save and Print
      printSingleThermalReceipt(receiptData);
    } else {
      // Button 2: Next and Print Later (Push to Print Queue)
      addToPrintQueue({
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        receiptNo,
        groupId: groupId,
        subject: targetGroup?.subject || '',
        teacherName: targetGroup?.teacherName || '',
        studentRowId: student.rowId,
        studentName: student.name,
        studentPhone: student.phone,
        amount: amountNum,
        totalFee,
        totalPaid,
        balance,
        date: dateStr,
        time: timeStr,
        sessionIndex: sessionIdx,
        isCover,
        originalGroup: originalGid
      });
    }

    setFlashSuccess({
      name: student.name,
      statusText: printImmediately ? 'تم الدفع وطباعة الوصل فوراً ✓' : 'تم الدفع وتأجيل الطباعة للطابور ✓',
      details: `فوج ${groupId} • تم استلام: ${amountNum.toLocaleString()} دج`
    });

    setTimeout(() => {
      setFlashSuccess(null);
      resetForNextStudent();
    }, 1200);
  };

  // Automated Absence Tracking: End Session
  const handleConfirmEndSession = () => {
    if (endSessionTarget === 'ALL') {
      let totalPresent = 0;
      let totalMakeup = 0;
      let totalAbsent = 0;
      activeGroups.forEach((ag) => {
        const stats = endSessionAndMarkAbsent(ag.groupId, ag.sessionIndex);
        totalPresent += stats.presentCount;
        totalMakeup += stats.makeupCount;
        totalAbsent += stats.absentCount;
      });
      setEndSessionStats({
        presentCount: totalPresent,
        makeupCount: totalMakeup,
        absentCount: totalAbsent,
        groupLabel: `جميع الأفواج النشطة (${activeGroups.map((g) => g.groupId).join(' ، ')})`
      });
    } else if (endSessionTarget) {
      const stats = endSessionAndMarkAbsent(endSessionTarget.groupId, endSessionTarget.sessionIndex);
      setEndSessionStats({
        ...stats,
        groupLabel: `فوج ${endSessionTarget.groupId} (الحصة ${endSessionTarget.sessionIndex + 1})`
      });
    }
    setShowEndSessionConfirm(false);
  };

  // Helper to compute attendance stats for a specific group & session
  const getGroupStats = (gid: string, sIdx: number) => {
    const groupSheet = data.groupData[gid];
    if (!groupSheet?.students) return { present: 0, makeup: 0, absent: 0, unmarked: 0, total: 0 };
    let present = 0;
    let makeup = 0;
    let absent = 0;
    let unmarked = 0;
    const real = groupSheet.students.filter((s) => !isSummaryRow(s, gid));
    real.forEach((s) => {
      const val = s.attendance?.[sIdx];
      const st = typeof val === 'string' ? val.trim().toUpperCase() : '';
      if (st === 'P' || st === 'ح') present++;
      else if (st === 'M' || st === 'م') makeup++;
      else if (st === 'A' || st === 'غ') absent++;
      else unmarked++;
    });
    return { present, makeup, absent, unmarked, total: real.length };
  };

  // Real-time aggregate live counts across all active groups
  const sessionStats = useMemo(() => {
    let present = 0;
    let makeup = 0;
    let absent = 0;
    let unmarked = 0;
    let total = 0;

    activeGroups.forEach((ag) => {
      const st = getGroupStats(ag.groupId, ag.sessionIndex);
      present += st.present;
      makeup += st.makeup;
      absent += st.absent;
      unmarked += st.unmarked;
      total += st.total;
    });

    return { present, makeup, absent, unmarked, total };
  }, [activeGroups, data.groupData]);

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '720px',
          maxHeight: '88vh',
          width: '95%',
          padding: '10px 14px',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-lg)',
          boxShadow: 'var(--md-elevation-4)',
          position: 'relative',
          overflowY: 'auto'
        }}
      >
        {/* Modal Top Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              الأفواج النشطة ({activeGroups.length}):
            </span>
            <span
              style={{
                fontSize: '0.66rem',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                padding: '2px 6px',
                borderRadius: '6px',
                fontWeight: 700
              }}
            >
              مسح متزامن ⚡
            </span>

            <button
              type="button"
              onClick={() => handleAddActiveGroup()}
              className="m3-btn m3-btn-sm"
              style={{
                backgroundColor: '#059669',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.72rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '5px',
                height: '24px'
              }}
              title="إضافة فوج آخر نشط في نفس الوقت"
            >
              <Plus size={12} />
              <span>إضافة فوج نشط</span>
            </button>

            {activeGroups.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setEndSessionTarget('ALL');
                  setShowEndSessionConfirm(true);
                }}
                className="m3-btn m3-btn-sm"
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '3px 7px',
                  borderRadius: '5px',
                  height: '24px'
                }}
                title="إنهاء وتسجيل الغياب لجميع الأفواج النشطة دفعة واحدة"
              >
                <UserX size={11} />
                <span>إنهاء الكل ({activeGroups.length})</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Print Queue Button */}
            <button
              onClick={() => setShowQueueModal(true)}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                padding: '2px 7px',
                height: '26px',
                borderColor: printQueue.length > 0 ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                backgroundColor: printQueue.length > 0 ? 'var(--md-sys-color-primary-container)' : 'transparent',
                color: printQueue.length > 0 ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'
              }}
              title="عرض وطباعة الوصلات المؤجلة في قائمة الانتظار"
            >
              <Printer size={13} />
              <span>طابور الطباعة ({printQueue.length})</span>
            </button>

            <button
              onClick={onClose}
              className="m3-btn-text"
              style={{ borderRadius: '50%', width: '26px', height: '26px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar: Multi-Active Groups Cards Container */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            padding: '6px 8px',
            borderRadius: 'var(--md-shape-md)',
            marginBottom: '8px',
            border: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          {/* Active Group Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: activeGroups.length > 1 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
              gap: '6px'
            }}
          >
            {activeGroups.map((ag, idx) => {
              const gSheet = data.groupData[ag.groupId];
              const gStats = getGroupStats(ag.groupId, ag.sessionIndex);
              return (
                <div
                  key={`${ag.groupId}-${idx}`}
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    padding: '8px 10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                    position: 'relative'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--md-sys-color-primary)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          flexShrink: 0
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            color: 'var(--md-sys-color-on-surface)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          فوج {ag.groupId} ({gSheet?.subject || ''})
                        </div>
                        <div
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--md-sys-color-on-surface-variant)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          الأستاذ: {gSheet?.teacherName || '—'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {activeGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveActiveGroup(idx)}
                          className="m3-btn-text"
                          style={{
                            color: '#dc2626',
                            borderRadius: '50%',
                            width: '22px',
                            height: '22px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="إزالة هذا الفوج من المحطة"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Selectors */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '1px' }}>
                        الفوج:
                      </span>
                      <select
                        value={ag.groupId}
                        onChange={(e) => handleUpdateActiveGroup(idx, e.target.value)}
                        className="m3-input"
                        style={{ padding: '3px 6px', fontSize: '0.78rem', fontWeight: 700, width: '100%', height: '28px' }}
                      >
                        {data.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            فوج {g.id} ({g.subject})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '1px' }}>
                        الحصة المستهدفة:
                      </span>
                      <select
                        value={ag.sessionIndex}
                        onChange={(e) => handleUpdateActiveSession(idx, Number(e.target.value))}
                        className="m3-input"
                        style={{ padding: '3px 6px', fontSize: '0.78rem', fontWeight: 700, width: '100%', height: '28px' }}
                      >
                        {Array.from({ length: gSheet?.sessionCount || 4 }).map((_, sIdx) => (
                          <option key={sIdx} value={sIdx}>
                            الحصة {sIdx + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Card Footer: Live Badges + End Session Button */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px dashed var(--md-sys-color-outline-variant)',
                      paddingTop: '5px',
                      marginTop: '1px',
                      gap: '4px',
                      flexWrap: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '1px 5px',
                          borderRadius: '5px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: '#166534',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        حاضر: {gStats.present}/{gStats.total}
                      </span>

                      {gStats.absent > 0 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '1px 5px',
                            borderRadius: '5px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fca5a5',
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            color: '#b91c1c',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          غائب: {gStats.absent}
                        </span>
                      )}

                      {gStats.unmarked > 0 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '1px 5px',
                            borderRadius: '5px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: '#475569',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          لم يمسح: {gStats.unmarked}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEndSessionTarget({ groupId: ag.groupId, sessionIndex: ag.sessionIndex });
                        setShowEndSessionConfirm(true);
                      }}
                      className="m3-btn m3-btn-sm"
                      style={{
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        fontWeight: 800,
                        fontSize: '0.68rem',
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        borderRadius: '5px',
                        height: '24px'
                      }}
                      title={`إنهاء حصة فوج ${ag.groupId} وتسجيل الغياب`}
                    >
                      <UserX size={11} />
                      <span style={{ whiteSpace: 'nowrap' }}>إنهاء الحصة (A)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Session Counter Banner (Slim Single-Line) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            marginBottom: '8px',
            textAlign: 'center'
          }}
        >
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>حاضر (P):</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 900 }}>{sessionStats.present}</span>
          </div>
          <div style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>تعويض (M):</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 900 }}>{sessionStats.makeup}</span>
          </div>
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>غائب (A):</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 900 }}>{sessionStats.absent}</span>
          </div>
          <div style={{ backgroundColor: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface)', padding: '3px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>لم يمسح:</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 900 }}>{sessionStats.unmarked}</span>
          </div>
        </div>

        {/* Barcode Scanner Box Area (Ultra-Compact & Sleek) */}
        <form onSubmit={handleBarcodeSubmit} style={{ marginBottom: '6px' }}>
          <div
            style={{
              border: '1.5px dashed var(--md-sys-color-primary)',
              borderRadius: 'var(--md-shape-md)',
              padding: '8px 12px',
              textAlign: 'center',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Scan size={18} color="var(--md-sys-color-primary)" className="animate-pulse" />
                <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--md-sys-color-on-primary-container)' }}>
                  وجّه قارئ الباركود نحو بطاقة التلميذ
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(21, 128, 61, 0.12)', color: '#15803d', padding: '1px 6px', borderRadius: '8px', fontSize: '0.66rem', fontWeight: 700 }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} className="animate-pulse" />
                  <span>جاهز للمسح</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFastScanMode((prev) => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    border: '1px solid',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: fastScanMode ? '#16a34a' : 'rgba(0,0,0,0.04)',
                    borderColor: fastScanMode ? '#15803d' : 'var(--md-sys-color-outline-variant)',
                    color: fastScanMode ? '#ffffff' : 'var(--md-sys-color-on-surface-variant)'
                  }}
                  title="تفعيل وضع المسح الفوري المتواصل: تسجيل الحضور مباشرة للجميع فوراً دون توقف"
                >
                  <Sparkles size={11} />
                  <span>مسح فوري متواصل: {fastScanMode ? 'مفعّل ⚡' : 'معطل'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px', width: '100%', maxWidth: '340px', marginTop: '2px' }}>
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBarcodeInput(val);
                    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                    if (val.trim().length >= 1) {
                      scanTimeoutRef.current = setTimeout(() => {
                        handleBarcodeSubmit(undefined, val);
                      }, 350);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (scanTimeoutRef.current) {
                        clearTimeout(scanTimeoutRef.current);
                        scanTimeoutRef.current = null;
                      }
                      handleBarcodeSubmit();
                    }
                  }}
                  placeholder="امسح البطاقة أو اكتب الرمز هنا..."
                  className="m3-input"
                  style={{
                    textAlign: 'center',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    padding: '4px 8px',
                    height: '32px',
                    backgroundColor: '#fff',
                    borderColor: 'var(--md-sys-color-primary)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                  autoFocus
                />
                <button type="submit" className="m3-btn m3-btn-primary" style={{ fontWeight: 700, padding: '4px 12px', fontSize: '0.8rem', height: '32px' }}>
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Flash Success Banner */}
        {flashSuccess && (
          <div
            style={{
              backgroundColor: '#dcfce7',
              border: '1.5px solid #86efac',
              borderRadius: 'var(--md-shape-md)',
              padding: '8px 12px',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
              marginBottom: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <CheckCircle2 size={20} color="#15803d" />
              <span style={{ fontWeight: 900, fontSize: '1rem', color: '#15803d' }}>
                {flashSuccess.name}
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#166534' }}>
                — {flashSuccess.statusText}
              </span>
            </div>
            {flashSuccess.details && (
              <div style={{ fontSize: '0.76rem', color: '#14532d', marginTop: '2px' }}>
                {flashSuccess.details}
              </div>
            )}
          </div>
        )}

        {/* DIALOG 1: COVERING / MAKE-UP SESSION POPUP */}
        {showCoverDialog && scannedResult && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: 'var(--md-shape-md)',
              padding: '8px 12px',
              marginBottom: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', marginBottom: '6px' }}>
              <AlertTriangle size={18} />
              <h3 style={{ fontSize: '0.88rem', fontWeight: 800 }}>
                تنبيه: التلميذ ليس مسجلاً في أي من الأفواج النشطة حالياً
              </h3>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: '8px', lineHeight: 1.4 }}>
              التلميذ <strong>&quot;{scannedResult.student.name}&quot;</strong> مسجل في أفواج ({scannedResult.studentEnrolledGroups?.join(' ، ') || scannedResult.homeGroupId}).
              {' '}<strong>هل التلميذ في حصة تعويض؟</strong>
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                  الفوج النشط المراد حضوره (تعويض):
                </label>
                <select
                  value={coverTargetActiveGroupId || activeGroups[0]?.groupId}
                  onChange={(e) => setCoverTargetActiveGroupId(e.target.value)}
                  className="m3-input"
                  style={{ width: '100%', fontWeight: 700, padding: '3px 6px', fontSize: '0.76rem', height: '28px' }}
                >
                  {activeGroups.map((ag) => {
                    const gSheet = data.groupData[ag.groupId];
                    return (
                      <option key={ag.groupId} value={ag.groupId}>
                        فوج {ag.groupId} ({gSheet?.subject || ''}) • الحصة {ag.sessionIndex + 1}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                  الفوج الأصلي الذي تغيب فيه:
                </label>
                <select
                  value={selectedOriginalGroup}
                  onChange={(e) => setSelectedOriginalGroup(e.target.value)}
                  className="m3-input"
                  style={{ width: '100%', fontWeight: 700, padding: '3px 6px', fontSize: '0.76rem', height: '28px' }}
                >
                  {scannedResult.studentEnrolledGroups && scannedResult.studentEnrolledGroups.length > 0 && (
                    <optgroup label="أفواج التلميذ المسجل بها">
                      {scannedResult.studentEnrolledGroups.map((gid) => {
                        const gMeta = data.groups.find((g) => g.id === gid);
                        return (
                          <option key={gid} value={gid}>
                            فوج {gid} ★ ({gMeta?.subject || data.groupData[gid]?.subject || ''})
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  <optgroup label="باقي أفواج المركز">
                    {data.groups
                      .filter((g) => !scannedResult.studentEnrolledGroups?.includes(g.id))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          فوج {g.id} ({g.subject})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const targetGid = coverTargetActiveGroupId || activeGroups[0]?.groupId || activeGroupId;
                  const targetAg = activeGroups.find((g) => g.groupId === targetGid);
                  const targetSessionIdx = targetAg ? targetAg.sessionIndex : activeSessionIdx;
                  setShowCoverDialog(false);
                  proceedToPaymentCheck(scannedResult.student, targetGid, targetSessionIdx, true, selectedOriginalGroup);
                }}
                className="m3-btn m3-btn-primary"
                style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 700, fontSize: '0.74rem', height: '28px', padding: '3px 10px' }}
              >
                نعم (تسجيل كحصة تعويض)
              </button>
              <button
                type="button"
                onClick={resetForNextStudent}
                className="m3-btn m3-btn-outlined"
                style={{ borderColor: '#d97706', color: '#b45309', fontSize: '0.74rem', height: '28px', padding: '3px 8px' }}
              >
                لا (إلغاء العملية)
              </button>
            </div>
          </div>
        )}

        {/* DIALOG 2: UNPAID / PAYMENT VERIFICATION POPUP (Ultra-Compact) */}
        {showUnpaidDialog && scannedResult && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1.5px solid #f87171',
              borderRadius: 'var(--md-shape-md)',
              padding: '8px 12px',
              marginBottom: '6px',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
            }}
          >
            {/* Alert Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Volume2 size={18} color="#b91c1c" className="animate-pulse" />
                <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                  ✓ مسجل حاضر الآن
                </span>
                <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#b91c1c' }}>
                  تنبيه: على التلميذ مستحقات مالية
                </span>
              </div>

              <span
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontWeight: 900,
                  fontSize: '0.84rem',
                  whiteSpace: 'nowrap'
                }}
              >
                المطلوب للتسديد: {(unpaidInfo?.effectiveDebt || scannedResult.student.debt || 0).toLocaleString()} دج
              </span>
            </div>

            {/* Compact Student & Group Info Card */}
            <div
              style={{
                fontSize: '0.78rem',
                color: '#991b1b',
                marginBottom: '8px',
                lineHeight: 1.5,
                backgroundColor: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #fecaca'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div>
                  التلميذ: <strong style={{ fontSize: '0.88rem', color: '#7f1d1d' }}>{scannedResult.student.name}</strong>
                </div>
                <div>
                  الفوج:{' '}
                  <strong>
                    {currentScanContext?.groupId || activeGroupId} (
                    {data.groupData[currentScanContext?.groupId || activeGroupId]?.subject || ''} -{' '}
                    {data.groupData[currentScanContext?.groupId || activeGroupId]?.teacherName || ''})
                  </strong>{' '}
                  • الحصة {(currentScanContext?.sessionIdx ?? activeSessionIdx) + 1}
                </div>
              </div>

              <div style={{ marginTop: '3px' }}>
                {unpaidInfo?.isNewUnpaid ? (
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      padding: '1px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      border: '1px solid #fca5a5'
                    }}
                  >
                    ⚠️ تلميذ مسجل في هذا الفوج ولم يسدد أي مبلغ بعد (فوج جديد)
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#fff7ed',
                      color: '#c2410c',
                      padding: '1px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      border: '1px solid #fdba74'
                    }}
                  >
                    تم تسديد: {(unpaidInfo?.totalPaid || 0).toLocaleString()} دج من أصل {(unpaidInfo?.expectedCycleFee || 0).toLocaleString()} دج (متبقي كدين)
                  </span>
                )}
              </div>
            </div>

            {willPayNow === null ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#7f1d1d' }}>
                  هل يريد التلميذ الدفع الآن؟
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setWillPayNow(true)}
                    className="m3-btn m3-btn-primary"
                    style={{
                      backgroundColor: '#15803d',
                      borderColor: '#15803d',
                      fontWeight: 800,
                      padding: '3px 12px',
                      height: '28px',
                      fontSize: '0.76rem',
                      borderRadius: '5px'
                    }}
                  >
                    نعم (تسديد الآن وطباعة وصل)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnpaidNoPayment(true)}
                    className="m3-btn m3-btn-outlined"
                    style={{
                      borderColor: '#b91c1c',
                      color: '#b91c1c',
                      backgroundColor: '#fff',
                      fontWeight: 800,
                      padding: '3px 10px',
                      height: '28px',
                      fontSize: '0.76rem',
                      borderRadius: '5px'
                    }}
                  >
                    متابعة كمدين (حاضر بالفعل ✓)
                  </button>
                  <button
                    type="button"
                    onClick={resetForNextStudent}
                    className="m3-btn m3-btn-text"
                    style={{ fontWeight: 700, fontSize: '0.74rem', height: '28px', padding: '3px 8px' }}
                  >
                    إغلاق ومتابعة المسح
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#991b1b' }}>
                      المبلغ المستلم (دج):
                    </label>

                    <input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="m3-input"
                      style={{
                        width: '120px',
                        height: '28px',
                        fontWeight: 900,
                        fontSize: '0.92rem',
                        padding: '2px 6px',
                        color: '#15803d'
                      }}
                      autoFocus
                    />

                    {/* Quick selection pills */}
                    {unpaidInfo && unpaidInfo.effectiveDebt > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(unpaidInfo.effectiveDebt))}
                        className="m3-btn m3-btn-outlined"
                        style={{ fontSize: '0.7rem', padding: '2px 7px', height: '24px', borderColor: '#b91c1c', color: '#991b1b', fontWeight: 800, borderRadius: '4px' }}
                      >
                        كامل المبلغ ({unpaidInfo.effectiveDebt.toLocaleString()} دج)
                      </button>
                    )}
                    {unpaidInfo && unpaidInfo.perSessionPrice > 0 && unpaidInfo.perSessionPrice !== unpaidInfo.effectiveDebt && (
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(unpaidInfo.perSessionPrice))}
                        className="m3-btn m3-btn-outlined"
                        style={{ fontSize: '0.7rem', padding: '2px 7px', height: '24px', borderColor: '#b91c1c', color: '#991b1b', fontWeight: 800, borderRadius: '4px' }}
                      >
                        حصة واحدة ({unpaidInfo.perSessionPrice.toLocaleString()} دج)
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact Action buttons */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => handleProcessPayment(true)}
                    className="m3-btn m3-btn-primary"
                    style={{
                      backgroundColor: '#00639b',
                      borderColor: '#00639b',
                      fontWeight: 800,
                      fontSize: '0.74rem',
                      height: '28px',
                      padding: '3px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '5px'
                    }}
                    title="حفظ الدفعة، تسجيل الحضور وطباعة الوصل الحراري فوراً"
                  >
                    <Printer size={13} />
                    <span>حفظ وطباعة الوصل فوراً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProcessPayment(false)}
                    className="m3-btn"
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.74rem',
                      height: '28px',
                      padding: '3px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '5px'
                    }}
                    title="حفظ الدفعة، تسجيل الحضور وإضافة الوصل إلى طابور الطباعة لطباعته لاحقاً"
                  >
                    <ArrowRight size={13} />
                    <span>التالي وطباعة لاحقاً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWillPayNow(null)}
                    className="m3-btn m3-btn-text"
                    style={{ fontWeight: 700, fontSize: '0.74rem', height: '28px', padding: '3px 8px' }}
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DIALOG 3: END SESSION CONFIRMATION MODAL */}
        {showEndSessionConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 150
            }}
            onClick={() => setShowEndSessionConfirm(false)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: 'var(--md-shape-xl)',
                maxWidth: '480px',
                width: '90%',
                boxShadow: 'var(--md-elevation-4)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '12px' }}>
                <UserX size={26} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  تأكيد إنهاء الحصة وتسجيل الغياب التلقائي
                </h3>
              </div>

              <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.6, marginBottom: '16px' }}>
                {endSessionTarget === 'ALL' ? (
                  <>
                    أنت على وشك إنهاء الحصص لجميع الأفواج النشطة حالياً:{' '}
                    <strong>({activeGroups.map((g) => g.groupId).join(' ، ')})</strong>.
                    <br />
                    سيقوم النظام بتسجيل جميع التلاميذ الذين لم يحضروا في هذه الأفواج كـ{' '}
                    <strong style={{ color: '#b91c1c' }}>غائب (A)</strong> تلقائياً.
                  </>
                ) : (
                  <>
                    أنت على وشك إنهاء <strong>الحصة {(endSessionTarget?.sessionIndex ?? activeSessionIdx) + 1}</strong> لفوج{' '}
                    <strong>{endSessionTarget?.groupId || activeGroupId}</strong>.
                    <br />
                    سيقوم النظام بالبحث عن جميع التلاميذ المسجلين بهذا الفوج الذين لم يمسحوا بطاقاتهم، وتسجيلهم كـ{' '}
                    <strong style={{ color: '#b91c1c' }}>غائب (A)</strong> تلقائياً وإعادة حساب المستحقات والديون.
                  </>
                )}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEndSessionConfirm(false)}
                  className="m3-btn m3-btn-text"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndSession}
                  className="m3-btn m3-btn-primary"
                  style={{ backgroundColor: '#b91c1c', borderColor: '#b91c1c', fontWeight: 700 }}
                >
                  نعم، أنهِ وسجل الغياب الآن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG 4: END SESSION RESULTS SUMMARY TOAST */}
        {endSessionStats && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '2px solid #a7f3d0',
              borderRadius: 'var(--md-shape-lg)',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px'
            }}
          >
            <CheckCircle2 size={32} color="#059669" style={{ margin: '0 auto 6px' }} />
            <h4 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#065f46' }}>
              تم إنهاء {endSessionStats.groupLabel ? `حصة ${endSessionStats.groupLabel}` : 'الحصة'} بنجاح وحساب الغياب التلقائي!
            </h4>
            <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: '4px' }}>
              تم تسجيل: <strong>{endSessionStats.presentCount} حاضر</strong> •{' '}
              <strong>{endSessionStats.makeupCount} تعويض</strong> •{' '}
              <strong style={{ color: '#b91c1c' }}>{endSessionStats.absentCount} غائب</strong>
            </div>
            <button
              onClick={() => setEndSessionStats(null)}
              className="m3-btn m3-btn-sm m3-btn-outlined"
              style={{ marginTop: '10px', fontSize: '0.78rem' }}
            >
              إغلاق
            </button>
          </div>
        )}

        {/* MODAL: MULTIPLE ACTIVE GROUPS CANDIDATE RESOLUTION */}
        {multiActiveCandidate && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 170
            }}
            onClick={() => setMultiActiveCandidate(null)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: 'var(--md-shape-xl)',
                maxWidth: '520px',
                width: '90%',
                boxShadow: 'var(--md-elevation-4)',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                <Layers size={26} />
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '6px', color: 'var(--md-sys-color-on-surface)' }}>
                تحديد الفوج المطلوب للتلميذ
              </h3>

              <p style={{ fontSize: '0.88rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
                التلميذ <strong style={{ color: 'var(--md-sys-color-primary)', fontSize: '1rem' }}>{multiActiveCandidate.student.name}</strong> مسجل في أكثر من فوج نشط في نفس الوقت.
                <br />
                يرجى الضغط على الفوج الذي يحضره التلميذ الآن:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                {multiActiveCandidate.matchingActiveGroups.map((ag) => {
                  const gSheet = data.groupData[ag.groupId];
                  return (
                    <button
                      key={ag.groupId}
                      type="button"
                      onClick={() => {
                        const targetStudent = gSheet?.students?.find(
                          (s) =>
                            !isSummaryRow(s, ag.groupId) &&
                            ((multiActiveCandidate.result.student.barcode && s.barcode && s.barcode.toUpperCase() === multiActiveCandidate.result.student.barcode.toUpperCase()) ||
                              normalizeArabicName(s.name) === normalizeArabicName(multiActiveCandidate.result.student.name))
                        ) || multiActiveCandidate.result.student;

                        const resolved = {
                          ...multiActiveCandidate.result,
                          student: targetStudent,
                          homeGroupId: ag.groupId,
                          isInActiveGroup: true
                        };
                        setScannedResult(resolved);
                        setMultiActiveCandidate(null);
                        proceedToPaymentCheck(targetStudent, ag.groupId, ag.sessionIndex, false);
                      }}
                      className="m3-btn"
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        color: 'var(--md-sys-color-on-surface)',
                        border: '2px solid var(--md-sys-color-primary)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--md-sys-color-primary)', fontWeight: 900 }}>
                          فوج {ag.groupId} ({gSheet?.subject || ''})
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
                          الأستاذ: {gSheet?.teacherName || '—'} • الحصة {ag.sessionIndex + 1}
                        </div>
                      </div>
                      <span
                        style={{
                          backgroundColor: 'var(--md-sys-color-primary)',
                          color: '#fff',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.78rem'
                        }}
                      >
                        حضور هذا الفوج ✓
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setMultiActiveCandidate(null)}
                className="m3-btn m3-btn-text"
                style={{ fontWeight: 700 }}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* DIALOG 5: PRINT QUEUE MODAL */}
        {showQueueModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 160
            }}
            onClick={() => setShowQueueModal(false)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: 'var(--md-shape-xl)',
                maxWidth: '650px',
                width: '90%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--md-elevation-4)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                  paddingBottom: '12px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={22} color="var(--md-sys-color-primary)" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    طابور الوصلات المؤجلة للطباعة ({printQueue.length})
                  </h3>
                </div>
                <button
                  onClick={() => setShowQueueModal(false)}
                  className="m3-btn-text"
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {printQueue.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--md-sys-color-outline)' }}>
                  طابور الطباعة فارغ حالياً. عند الضغط على "التالي وطباعة لاحقاً" أثناء مسح البطاقات، ستظهر الوصلات هنا.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button
                      onClick={() => {
                        printBatchThermalReceipts(
                          printQueue.map((q) => ({
                            receiptNo: q.receiptNo,
                            centerName: data.centerName,
                            cycle: data.cycle,
                            academicYear: data.academicYear,
                            date: q.date,
                            time: q.time,
                            studentName: q.studentName,
                            studentPhone: q.studentPhone,
                            groupId: q.groupId,
                            subject: q.subject,
                            teacherName: q.teacherName,
                            amount: q.amount,
                            totalFee: q.totalFee,
                            totalPaid: q.totalPaid,
                            balance: q.balance,
                            isCover: q.isCover,
                            originalGroup: q.originalGroup
                          }))
                        );
                      }}
                      className="m3-btn m3-btn-primary"
                      style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={16} />
                      <span>طباعة جميع الوصلات المؤجلة دفعة واحدة ({printQueue.length})</span>
                    </button>

                    <button
                      onClick={clearPrintQueue}
                      className="m3-btn m3-btn-outlined m3-btn-sm"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      تفريغ الطابور
                    </button>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 'var(--md-shape-md)' }}>
                    {printQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: idx % 2 === 1 ? 'var(--md-sys-color-surface-container-lowest)' : 'transparent'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{item.studentName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                            فوج {item.groupId} ({item.subject}) • وصل رقم #{item.receiptNo} • {item.date} {item.time}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#15803d' }}>
                            {item.amount.toLocaleString()} دج
                          </span>
                          <button
                            onClick={() => {
                              printSingleThermalReceipt({
                                receiptNo: item.receiptNo,
                                centerName: data.centerName,
                                cycle: data.cycle,
                                academicYear: data.academicYear,
                                date: item.date,
                                time: item.time,
                                studentName: item.studentName,
                                studentPhone: item.studentPhone,
                                groupId: item.groupId,
                                subject: item.subject,
                                teacherName: item.teacherName,
                                amount: item.amount,
                                totalFee: item.totalFee,
                                totalPaid: item.totalPaid,
                                balance: item.balance,
                                isCover: item.isCover,
                                originalGroup: item.originalGroup
                              });
                              removeFromPrintQueue(item.id);
                            }}
                            className="m3-btn m3-btn-outlined m3-btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            طباعة الآن
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
