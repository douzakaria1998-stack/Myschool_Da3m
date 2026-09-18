'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { StudentRecord, GroupSheet, QueuedReceipt, DiscountType, AttendanceStatus } from '../types';
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
  Trash2,
  UserPlus,
  Search,
  ArrowLeftRight,
  CalendarCheck,
  CalendarPlus,
  RefreshCw,
  Phone,
  Tag,
  DollarSign,
  Check,
  RotateCcw,
  CheckCircle,
  Bell,
  CheckCheck
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
  getTodayArabicDayName,
  getDefaultSessionIndex
} from '../utils/sessionUtils';
import Link from 'next/link';
import { getBarcodeCandidates, normalizeArabicName, normalizeScannedBarcode } from '../utils/barcodeUtils';

export interface PendingCoverRequest {
  id: string;
  student: StudentRecord;
  homeGroupId: string;
  studentEnrolledGroups: string[];
  targetActiveGroupId: string;
  sessionIdx: number;
  time: string;
}

interface Props {
  initialGroupId?: string;
  onClose?: () => void;
  isScreen?: boolean;
}

export default function BarcodeScannerModal({ initialGroupId, onClose, isScreen = false }: Props) {
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
    clearPrintQueue,
    addStudent,
    transferStudent,
    updateStudentFullFinances
  } = useApp();

  // Smart Session Auto-Detection Engine (Active by default)
  const [autoDetectSchedule, setAutoDetectSchedule] = useState<boolean>(true);
  const [currentDetection, setCurrentDetection] = useState<ActiveGroupDetectionResult>(() =>
    detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date())
  );

  // Fast continuous scan mode
  const [fastScanMode, setFastScanMode] = useState<boolean>(false);

  // Active Groups configuration
  const [activeGroups, setActiveGroups] = useState<{ groupId: string; sessionIndex: number }[]>(() => {
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
    return [];
  });

  // Covering groups added specifically for today
  const [coveringGroupIds, setCoveringGroupIds] = useState<string[]>([]);
  const [showAddCoverGroupModal, setShowAddCoverGroupModal] = useState(false);
  const [newCoverGroupId, setNewCoverGroupId] = useState<string>('');
  const [newCoverGroupSessionIdx, setNewCoverGroupSessionIdx] = useState<number>(0);

  // Recent scans live history list (on the Right side)
  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      studentName: string;
      groupId: string;
      sessionIndex: number;
      status: 'P' | 'M' | 'DEBT' | 'COVER_REQ';
      debt?: number;
      time: string;
    }>
  >([]);

  // =========================================================================
  // LIVE ACTION / NOTIFICATION QUEUE (ON THE LEFT SIDE)
  // All scanner notifications (covering requests, unpaid students) appear here!
  // =========================================================================
  const [pendingCoverRequests, setPendingCoverRequests] = useState<PendingCoverRequest[]>([]);
  const [confirmActionModal, setConfirmActionModal] = useState<{
    type: 'cover' | 'transfer';
    req: PendingCoverRequest;
  } | null>(null);

  const [pendingDebtors, setPendingDebtors] = useState<
    Array<{
      id: string;
      student: StudentRecord;
      groupId: string;
      sessionIdx: number;
      debt: number;
      time: string;
    }>
  >([]);

  // Primary active group helper
  const primaryActive = activeGroups[0] || null;
  const activeGroupId = primaryActive?.groupId || '';
  const activeSessionIdx = primaryActive?.sessionIndex ?? 0;
  const activeGroup = activeGroupId ? (data.groupData[activeGroupId] as GroupSheet | undefined) : undefined;

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
    const targetGroup = activeGroups[index];
    if (targetGroup && coveringGroupIds.includes(targetGroup.groupId)) {
      setCoveringGroupIds((prev) => prev.filter((id) => id !== targetGroup.groupId));
    }
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
  };

  const handleUpdateActiveSession = (index: number, newSessionIdx: number) => {
    setActiveGroups((prev) =>
      prev.map((item, i) => (i === index ? { ...item, sessionIndex: newSessionIdx } : item))
    );
  };

  // Add covering group for today handler
  const handleConfirmAddCoverGroup = () => {
    const gid = newCoverGroupId || data.groups[0]?.id;
    if (!gid) return;
    setCoveringGroupIds((prev) => Array.from(new Set([...prev, gid])));
    setActiveGroups((prev) => {
      if (prev.some((g) => g.groupId === gid)) {
        return prev.map((g) => (g.groupId === gid ? { ...g, sessionIndex: newCoverGroupSessionIdx } : g));
      }
      return [...prev, { groupId: gid, sessionIndex: newCoverGroupSessionIdx }];
    });
    setShowAddCoverGroupModal(false);
  };

  // Periodic re-check of active schedule every 20 seconds
  useEffect(() => {
    const checkSchedule = () => {
      const res = detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date());
      setCurrentDetection(res);
      if (autoDetectSchedule) {
        if (res.matchingGroups.length > 0) {
          const detected = res.matchingGroups.map((m) => ({
            groupId: m.group.groupId,
            sessionIndex: m.sessionIndex
          }));
          setActiveGroups((prev) => {
            const currentCoverings = prev.filter((g) => coveringGroupIds.includes(g.groupId));
            const combined = [...detected];
            currentCoverings.forEach((cg) => {
              if (!currentActiveGroupsHas(combined, cg.groupId)) {
                combined.push(cg);
              }
            });
            const prevKeys = prev.map((g) => `${g.groupId}-${g.sessionIndex}`).sort().join(',');
            const newKeys = combined.map((g) => `${g.groupId}-${g.sessionIndex}`).sort().join(',');
            return prevKeys !== newKeys ? combined : prev;
          });
        } else {
          setActiveGroups((prev) => {
            const currentCoverings = prev.filter((g) => coveringGroupIds.includes(g.groupId));
            return currentCoverings.length > 0 ? currentCoverings : [];
          });
        }
      }
    };

    const currentActiveGroupsHas = (arr: { groupId: string }[], gid: string) => arr.some((g) => g.groupId === gid);

    checkSchedule();
    const timer = setInterval(checkSchedule, 20000);
    return () => clearInterval(timer);
  }, [data.groupData, data.groups, autoDetectSchedule, coveringGroupIds]);

  // Scanner Barcode Input State
  const [barcodeInput, setBarcodeInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-Match Candidate state (when student enrolled in 2 concurrent active groups)
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

  // Flash Success / Warning Notification Banner (top of right scanner box)
  const [flashSuccess, setFlashSuccess] = useState<{
    name: string;
    statusText: string;
    details: string;
    isWarning?: boolean;
  } | null>(null);

  // End Session Confirmation Modal
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [endSessionTarget, setEndSessionTarget] = useState<{ groupId: string; sessionIndex: number } | 'ALL' | null>(null);
  const [endSessionStats, setEndSessionStats] = useState<{
    presentCount: number;
    makeupCount: number;
    absentCount: number;
    groupLabel?: string;
  } | null>(null);

  // Print Queue Modal view
  const [showQueueModal, setShowQueueModal] = useState(false);

  // ==========================================
  // LEFT OPERATIONS PANEL STATE
  // Tabs: 'queue' (Live Queue) | 'add' (Add student) | 'pay' (Paid student) | 'change' (Change student) | 'cover' (Covering)
  // ==========================================
  const [leftTab, setLeftTab] = useState<'queue' | 'add' | 'pay' | 'change' | 'cover'>('queue');

  // Tab: Add Student State
  const [addGid, setAddGid] = useState<string>(() => activeGroupId || data.groups[0]?.id || '');
  const [addName, setAddName] = useState<string>('');
  const [addPhone, setAddPhone] = useState<string>('');
  const [addDiscount, setAddDiscount] = useState<DiscountType>('1');
  const [addInitialPay, setAddInitialPay] = useState<string>('');
  const [addSuccess, setAddSuccess] = useState<{ name: string; barcode: string; group: string; rowId: number } | null>(null);

  // Tab: Pay Student State
  const [paySearchQuery, setPaySearchQuery] = useState<string>('');
  const [paySelectedStudent, setPaySelectedStudent] = useState<{ student: StudentRecord; groupId: string } | null>(null);
  const [payCustomAmount, setPayCustomAmount] = useState<string>('');
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  // Tab: Change Student Group State
  const [changeSearchQuery, setChangeSearchQuery] = useState<string>('');
  const [changeSelectedStudent, setChangeSelectedStudent] = useState<{ student: StudentRecord; fromGroupId: string } | null>(null);
  const [changeTargetGroupId, setChangeTargetGroupId] = useState<string>('');
  const [changeSuccessMsg, setChangeSuccessMsg] = useState<string | null>(null);

  // Tab: Covering Student Attendance State
  const [coverSearchQuery, setCoverSearchQuery] = useState<string>('');
  const [coverSelectedStudent, setCoverSelectedStudent] = useState<{ student: StudentRecord; originalGroupId: string } | null>(null);
  const [coverTargetGid, setCoverTargetGid] = useState<string>(() => activeGroupId || data.groups[0]?.id || '');
  const [coverSessionIdx, setCoverSessionIdx] = useState<number>(() => activeSessionIdx || 0);
  const [coverAmountInput, setCoverAmountInput] = useState<string>('');
  const [coverSuccessMsg, setCoverSuccessMsg] = useState<string | null>(null);

  // Sync addGid and coverTargetGid when activeGroupId changes
  useEffect(() => {
    if (activeGroupId) {
      if (!addGid) setAddGid(activeGroupId);
      if (!coverTargetGid) setCoverTargetGid(activeGroupId);
    }
  }, [activeGroupId]);

  // Keep scanner input focused ONLY when user is NOT typing in an operations form input!
  useEffect(() => {
    const timer = setInterval(() => {
      const activeEl = document.activeElement;
      const isUserTypingElsewhere =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT') &&
        activeEl !== scannerInputRef.current;

      if (
        !isUserTypingElsewhere &&
        !showEndSessionConfirm &&
        !showQueueModal &&
        !showAddCoverGroupModal &&
        !multiActiveCandidate &&
        document.activeElement !== scannerInputRef.current
      ) {
        scannerInputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [showEndSessionConfirm, showQueueModal, showAddCoverGroupModal, multiActiveCandidate]);

  // Clean up scan timer on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Find student across all groups by barcode, phone, ID or name
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

        if (sBarcodeUpper && (candUpper === sBarcodeUpper || (sBarcodeAlpha && candAlpha === sBarcodeAlpha))) {
          return true;
        }

        if (
          candUpper === sIdUpper ||
          candUpper === sId2 ||
          candUpper === sId3 ||
          (candAlpha && candAlpha === sIdAlpha)
        ) {
          return true;
        }

        if (sPhoneClean && candDigits && candDigits.length >= 8 && (candDigits === sPhoneClean || sPhoneClean.endsWith(candDigits))) {
          return true;
        }

        if (sNameNorm && (candNorm === sNameNorm || sNameNorm.includes(candNorm) || candNorm.includes(sNameNorm))) {
          return true;
        }
      }

      if (/^\d{1,3}$/.test(cleanRaw) && gid === targetGroupId && sRowStr === cleanRaw) {
        return true;
      }

      return false;
    };

    let foundStudent: StudentRecord | null = null;
    let homeGid = '';

    const targetGroup = data.groupData[targetGroupId] || activeGroup;
    if (targetGroup?.students) {
      const matchInActive = targetGroup.students.find((s) => doesStudentMatch(s, targetGroupId));
      if (matchInActive) {
        foundStudent = matchInActive;
        homeGid = targetGroupId;
      }
    }

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

  // =========================================================================
  // HARDWARE BARCODE SCANNER BACKGROUND INTERCEPTOR
  // =========================================================================
  // HARDWARE BARCODE SCANNER INTERCEPTION (GLOBAL CAPTURE PHASE)
  // Ensures hardware barcode scanner keystrokes are diverted to attendance engine
  // without leaking or polluting ANY search input in the operations panel!
  // =========================================================================
  const scannerBurstRef = useRef<{ char: string; time: number }[]>([]);
  const isScannerActiveRef = useRef<boolean>(false);
  const preBurstValueRef = useRef<string>('');
  const burstTargetElRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const scannerResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to safely restore a React-controlled input DOM element and its internal React state
  const restoreReactInputElement = (el: HTMLInputElement | HTMLTextAreaElement, originalValue: string) => {
    try {
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor?.set) {
        descriptor.set.call(el, originalValue);
      } else {
        el.value = originalValue;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.error('Failed to restore input value', err);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showEndSessionConfirm || showQueueModal || showAddCoverGroupModal) {
        return;
      }

      const now = Date.now();
      const burst = scannerBurstRef.current;
      const lastKeyTime = burst.length > 0 ? burst[burst.length - 1].time : 0;
      const interval = now - lastKeyTime;

      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const isFocusedElsewhere =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        activeEl !== scannerInputRef.current;

      // Handle Enter (completion of hardware scanner stream or manual submit)
      if (e.key === 'Enter') {
        const isFocusedOnScanner = document.activeElement === scannerInputRef.current;
        const burstChars = burst.map((b) => b.char).join('').trim();
        const avgInterval = burst.length > 1 ? (now - burst[0].time) / (burst.length - 1) : 999;
        const isHardwareBurst =
          isScannerActiveRef.current ||
          burstChars.toUpperCase().startsWith('STU') ||
          (burstChars.length >= 4 && avgInterval < 55) ||
          Boolean(findStudentByCode(burstChars));

        if (isFocusedOnScanner) {
          e.preventDefault();
          scannerBurstRef.current = [];
          isScannerActiveRef.current = false;
          handleBarcodeSubmit();
          return;
        }

        // Hardware scanner typed while admin was focused elsewhere in the operations panel!
        if (isHardwareBurst && burstChars.length >= 2) {
          e.preventDefault();
          e.stopPropagation();

          // Restore the focused input back to its clean pre-burst state
          if (burstTargetElRef.current && burstTargetElRef.current !== scannerInputRef.current) {
            restoreReactInputElement(burstTargetElRef.current, preBurstValueRef.current);
          }

          scannerBurstRef.current = [];
          isScannerActiveRef.current = false;
          handleBarcodeSubmit(undefined, burstChars);
          return;
        }

        // Normal Enter press
        scannerBurstRef.current = [];
        isScannerActiveRef.current = false;
        return;
      }

      // Ignore navigation / special keys
      if (e.key === 'Tab' || e.key === 'Escape' || (e.key.length > 1 && e.key !== 'Backspace')) {
        return;
      }

      // Reset auto-clear timer (if typing paused for more than 110ms, burst is done/cancelled)
      if (scannerResetTimerRef.current) {
        clearTimeout(scannerResetTimerRef.current);
      }
      scannerResetTimerRef.current = setTimeout(() => {
        scannerBurstRef.current = [];
        isScannerActiveRef.current = false;
      }, 110);

      if (e.key === 'Backspace') {
        if (scannerBurstRef.current.length > 0) {
          scannerBurstRef.current.pop();
        }
        return;
      }

      // Single printable character
      if (e.key.length === 1) {
        // If burst is empty or there was a long pause, initialize new burst buffer
        if (burst.length === 0 || interval > 120) {
          burstTargetElRef.current = activeEl;
          preBurstValueRef.current = activeEl?.value || '';
          scannerBurstRef.current = [{ char: e.key, time: now }];
          isScannerActiveRef.current = false;
          return; // Let first key through tentatively
        }

        // Second or subsequent character in rapid succession
        scannerBurstRef.current.push({ char: e.key, time: now });

        // Hardware scanner speed check: superhuman interval (< 45ms)
        if (interval < 45) {
          isScannerActiveRef.current = true;
        }

        // If hardware scanner is active while focused in another input:
        if (isScannerActiveRef.current && isFocusedElsewhere) {
          // 1. Block character from EVER entering the input element!
          e.preventDefault();
          e.stopPropagation();

          // 2. Roll back the first character that slipped through before burst detection!
          if (burstTargetElRef.current && burstTargetElRef.current !== scannerInputRef.current) {
            restoreReactInputElement(burstTargetElRef.current, preBurstValueRef.current);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [
    showEndSessionConfirm,
    showQueueModal,
    showAddCoverGroupModal,
    activeGroups,
    data.groupData,
    data.groups,
    autoDetectSchedule
  ]);

  // Process a scanned card / barcode
  const handleBarcodeSubmit = (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    const rawCode = (directCode !== undefined ? directCode : barcodeInput).trim();
    if (!rawCode) return;

    // Display scanned code in right-hand barcode input box
    if (directCode) {
      setBarcodeInput(directCode);
      setTimeout(() => {
        setBarcodeInput('');
      }, 1800);
    }

    let currentActiveGroups = activeGroups;

    if (autoDetectSchedule) {
      const liveDetect = detectCurrentActiveGroupAndSession(data.groupData, data.groups, new Date());
      if (liveDetect.matchingGroups.length > 0) {
        const detected = liveDetect.matchingGroups.map((m) => ({
          groupId: m.group.groupId,
          sessionIndex: m.sessionIndex
        }));
        const coverings = currentActiveGroups.filter((g) => coveringGroupIds.includes(g.groupId));
        currentActiveGroups = [...detected];
        coverings.forEach((cg) => {
          if (!currentActiveGroups.some((g) => g.groupId === cg.groupId)) {
            currentActiveGroups.push(cg);
          }
        });
        setActiveGroups(currentActiveGroups);
      }
    }

    if (currentActiveGroups.length === 0) {
      playWarningAlert();
      setFlashSuccess({
        name: 'لا يوجد أي فوج نشط الآن',
        statusText: 'يرجى تفعيل فوج دراسي أو إضافة فوج تعويض',
        details: 'يمكنك الضغط على زر "+ إضافة فوج نشط" أو "+ إضافة فوج تعويض لهذا اليوم 🔄"',
        isWarning: true
      });
      setBarcodeInput('');
      return;
    }

    const primaryGid = currentActiveGroups[0]?.groupId || activeGroupId;
    const result = findStudentByCode(rawCode, primaryGid);

    if (!result) {
      playWarningAlert();
      setFlashSuccess({
        name: `رمز غير مسجل: "${rawCode}"`,
        statusText: 'لم يتم العثور على التلميذ في أي فوج',
        details: 'يمكنك إضافة تلميذ جديد مباشرة من تبويب "➕ إضافة تلميذ" على اليسار 👈',
        isWarning: true
      });
      setBarcodeInput('');
      return;
    }

    // 1. Check which of the currently active groups this student belongs to
    const matchingActive = currentActiveGroups.filter((ag) =>
      result.studentEnrolledGroups.includes(ag.groupId)
    );

    // =========================================================================
    // CASE A: Student NOT in any active group (COVERING / TRANSFER REQUEST)
    // As requested: The notification goes to the LEFT SIDE, NOT the bottom of the right side!
    // =========================================================================
    if (matchingActive.length === 0) {
      const nowStr = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
      const targetGid = currentActiveGroups[0]?.groupId || primaryGid;
      const targetSession = currentActiveGroups[0]?.sessionIndex ?? activeSessionIdx;

      const newCoverReq: PendingCoverRequest = {
        id: `${Date.now()}-${Math.random()}`,
        student: result.student,
        homeGroupId: result.studentEnrolledGroups[0] || result.homeGroupId,
        studentEnrolledGroups: result.studentEnrolledGroups,
        targetActiveGroupId: targetGid,
        sessionIdx: targetSession,
        time: nowStr
      };

      setPendingCoverRequests((prev) => {
        const filtered = prev.filter(
          (r) => r.student.name.trim() !== result.student.name.trim() || r.targetActiveGroupId !== targetGid
        );
        return [...filtered, newCoverReq];
      });

      // Switch left tab to live queue so admin sees it instantly!
      setLeftTab('queue');
      playWarningAlert();

      // Short flash notice on right
      setFlashSuccess({
        name: result.student.name,
        statusText: `تلميذ من فوج آخر (${result.studentEnrolledGroups[0] || result.homeGroupId})`,
        details: `طلب التعويض / النقل معروض في اللوحة اليسرى 👈`,
        isWarning: true
      });

      // Add to recent scans log on right
      setRecentScans((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          studentName: result.student.name,
          groupId: targetGid,
          sessionIndex: targetSession,
          status: 'COVER_REQ',
          time: nowStr
        },
        ...prev.slice(0, 9)
      ]);

      setBarcodeInput('');
      return;
    }

    // =========================================================================
    // CASE B: Exactly 1 match among active groups -> INSTANT AUTOMATIC ROUTE!
    // =========================================================================
    if (matchingActive.length === 1) {
      const targetAg = matchingActive[0];
      const targetGroup = data.groupData[targetAg.groupId];
      const targetStudent =
        targetGroup?.students?.find(
          (s) =>
            !isSummaryRow(s, targetAg.groupId) &&
            ((result.student.barcode && s.barcode && s.barcode.toUpperCase() === result.student.barcode.toUpperCase()) ||
              normalizeArabicName(s.name) === normalizeArabicName(result.student.name))
        ) || result.student;

      proceedToPaymentCheck(targetStudent, targetAg.groupId, targetAg.sessionIndex, false);
      setBarcodeInput('');
      return;
    }

    // =========================================================================
    // CASE C: Student enrolled in 2+ concurrent active groups
    // =========================================================================
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
      const targetAg = unattendedMatches[0];
      const targetGroup = data.groupData[targetAg.groupId];
      const targetStudent =
        targetGroup?.students?.find(
          (s) =>
            !isSummaryRow(s, targetAg.groupId) &&
            ((result.student.barcode && s.barcode && s.barcode.toUpperCase() === result.student.barcode.toUpperCase()) ||
              normalizeArabicName(s.name) === normalizeArabicName(result.student.name))
        ) || result.student;

      proceedToPaymentCheck(targetStudent, targetAg.groupId, targetAg.sessionIndex, false);
      setBarcodeInput('');
    } else {
      setMultiActiveCandidate({
        student: result.student,
        matchingActiveGroups: matchingActive,
        result
      });
      setBarcodeInput('');
    }
  };

  // Payment Verification & Attendance Recording
  const proceedToPaymentCheck = (
    student: StudentRecord,
    groupId: string,
    sessionIdx: number = activeSessionIdx,
    isCover: boolean = false,
    originalGid?: string
  ) => {
    const isAlreadyPresent = student.attendance?.[sessionIdx] === 'P';

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

    const expectedCycleFee =
      student.discount === '0'
        ? 0
        : student.discount === '0.8'
        ? Math.round(basePrice * 0.8)
        : basePrice;
    const perSessionPrice = Math.round(expectedCycleFee / cycleSessions);

    const totalPaid =
      (student.payments || []).reduce<number>((sum, p) => {
        const val = typeof p === 'number' ? p : parseFloat(String(p));
        return sum + (isNaN(val) ? 0 : val);
      }, 0) || student.totalReceived || 0;

    const effectiveDebt = Math.max(0, expectedCycleFee - totalPaid);

    let isPaid = false;
    if (student.discount === '0') {
      isPaid = true;
    } else if (student.debt > 0) {
      isPaid = false;
    } else if (totalPaid <= 0 && expectedCycleFee > 0) {
      isPaid = false;
    } else if (totalPaid >= expectedCycleFee && expectedCycleFee > 0) {
      isPaid = true;
    } else if (student.fee > 0 && student.debt <= 0 && totalPaid > 0) {
      isPaid = true;
    } else if (Number(student.payments?.[sessionIdx]) > 0) {
      isPaid = true;
    } else if (totalPaid >= (sessionIdx + 1) * perSessionPrice && perSessionPrice > 0) {
      isPaid = true;
    } else {
      isPaid = false;
    }

    // CRITICAL: Always record attendance immediately upon scan so student walks into class!
    if (isCover && originalGid) {
      recordCoverAttendance(groupId, originalGid, student.rowId, sessionIdx);
    } else {
      updateAttendance(groupId, student.rowId, sessionIdx, 'P');
    }

    const nowTimeStr = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Add to Live Recent Scans History on the Right
    setRecentScans((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        studentName: student.name,
        groupId,
        sessionIndex: sessionIdx,
        status: isPaid ? (isCover ? 'M' : 'P') : 'DEBT',
        debt: effectiveDebt,
        time: nowTimeStr
      },
      ...prev.slice(0, 9)
    ]);

    if (isPaid) {
      // Paid student: Instant chime & quick confirmation
      playSuccessChime();
      setFlashSuccess({
        name: student.name,
        statusText: isAlreadyPresent
          ? 'مسجل حاضر بالفعل ✓'
          : isCover
          ? 'حاضر (حصة تعويض) ✓'
          : 'حاضر (مسدد بالكامل) ✓',
        details: `فوج ${groupId} • الحصة ${sessionIdx + 1}`
      });

      setTimeout(() => setFlashSuccess(null), 1600);
    } else {
      // Unpaid student:
      // 1. Marked present immediately!
      // 2. Warning chime plays.
      // 3. PUSHED TO THE UNPAID WAITING QUEUE ON THE LEFT SIDE!
      // 4. Scanner on the right NEVER BLOCKS other students!
      playWarningAlert();

      setPendingDebtors((prev) => {
        // Add to queue (from oldest to newest) without duplicates
        const filtered = prev.filter((d) => d.student.name.trim() !== student.name.trim() || d.groupId !== groupId);
        return [
          ...filtered,
          {
            id: `${Date.now()}-${Math.random()}`,
            student,
            groupId,
            sessionIdx,
            debt: effectiveDebt,
            time: nowTimeStr
          }
        ];
      });

      setLeftTab('queue');

      setFlashSuccess({
        name: student.name,
        statusText: `حاضر ⚠️ (مدين: ${effectiveDebt.toLocaleString()} دج)`,
        details: `أُضيف لقائمة انتظار غير المسددين على اليسار 👈`,
        isWarning: true
      });

      setTimeout(() => setFlashSuccess(null), 1800);
    }
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
      if (st === 'P' || st === 'ح' || st === 'C') present++;
      else if (st === 'M' || st === 'م') makeup++;
      else if (st === 'A' || st === 'غ') absent++;
      else unmarked++;
    });
    return { present, makeup, absent, unmarked, total: real.length };
  };

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

  // Search helper for operations panel
  const searchStudentsAcrossCenter = useCallback(
    (query: string) => {
      if (!query || query.trim().length < 2) return [];
      const qClean = query.trim().toLowerCase();
      const qDigits = query.replace(/[^0-9]/g, '');
      const qNorm = normalizeArabicName(query);

      const results: { student: StudentRecord; groupId: string }[] = [];
      for (const [gid, sheet] of Object.entries(data.groupData)) {
        for (const s of sheet.students || []) {
          if (isSummaryRow(s, gid)) continue;
          const sNameNorm = normalizeArabicName(s.name);
          const sBarcode = (s.barcode || '').toLowerCase();
          const sPhone = (s.phone || '').replace(/[^0-9]/g, '');

          if (
            sNameNorm.includes(qNorm) ||
            (sBarcode && sBarcode.includes(qClean)) ||
            (qDigits.length >= 3 && sPhone.includes(qDigits))
          ) {
            results.push({ student: s, groupId: gid });
            if (results.length >= 8) return results;
          }
        }
      }
      return results;
    },
    [data.groupData]
  );

  // ==========================================
  // HANDLERS FOR LIVE ACTION QUEUE (LEFT PANEL)
  // ==========================================

  // Choice 1: Temporary Covering (stays in original group, credited with 'C')
  const handleAcceptTemporaryCover = (req: PendingCoverRequest) => {
    const { student, homeGroupId, targetActiveGroupId, sessionIdx } = req;

    recordCoverAttendance(targetActiveGroupId, homeGroupId, student.rowId, sessionIdx);
    playSuccessChime();

    // Update status in recent scans
    setRecentScans((prev) =>
      prev.map((s) =>
        s.studentName === student.name && s.groupId === targetActiveGroupId
          ? { ...s, status: 'M' }
          : s
      )
    );

    setFlashSuccess({
      name: student.name,
      statusText: `تم تسجيل حضور التعويض في فوجه الأصلي (${homeGroupId}) ✓`,
      details: `يحضر الآن كتعويض في فوج ${targetActiveGroupId} (الحصة ${sessionIdx + 1})`
    });

    setPendingCoverRequests((prev) => prev.filter((r) => r.id !== req.id));
    setTimeout(() => setFlashSuccess(null), 2500);
  };

  // Choice 2: Permanent Transfer (transfers student to active group permanently)
  const handleAcceptPermanentTransfer = (req: PendingCoverRequest) => {
    const { student, homeGroupId, targetActiveGroupId, sessionIdx } = req;

    const ok = transferStudent(homeGroupId, targetActiveGroupId, student.rowId);
    if (ok) {
      // Mark as present 'P' in new group
      updateAttendance(targetActiveGroupId, student.rowId, sessionIdx, 'P');
      playSuccessChime();

      setRecentScans((prev) =>
        prev.map((s) =>
          s.studentName === student.name && s.groupId === targetActiveGroupId
            ? { ...s, status: 'P' }
            : s
        )
      );

      setFlashSuccess({
        name: student.name,
        statusText: `تم تحويل التلميذ نهائياً إلى فوج ${targetActiveGroupId} ✓`,
        details: `تم نقله من ${homeGroupId} وتسجيله حاضراً في الحصة ${sessionIdx + 1}`
      });

      setPendingCoverRequests((prev) => prev.filter((r) => r.id !== req.id));
      setTimeout(() => setFlashSuccess(null), 2500);
    } else {
      alert('تعذر إتمام عملية النقل');
    }
  };

  // Choice 3: Cancel Cover Request - does NOT take attendance
  const handleCancelCoverRequest = (reqId: string) => {
    const req = pendingCoverRequests.find((r) => r.id === reqId);
    setPendingCoverRequests((prev) => prev.filter((r) => r.id !== reqId));

    if (req) {
      // Remove from recent scans
      setRecentScans((prev) =>
        prev.filter(
          (s) =>
            !(
              s.studentName === req.student.name &&
              s.groupId === req.targetActiveGroupId &&
              s.status === 'COVER_REQ'
            )
        )
      );

      setFlashSuccess({
        name: req.student.name,
        statusText: 'تم إلغاء الطلب ولم يتم احتساب الحضور ✕',
        details: 'تم إلغاء العملية بناءً على طلب المسؤول',
        isWarning: true
      });
      setTimeout(() => setFlashSuccess(null), 2000);
    }
  };

  // Debtor Quick Action: Settle Payment
  const handleSettleDebtorInQueue = (debtorItem: typeof pendingDebtors[0], amount?: number, printNow: boolean = true) => {
    const { student, groupId, sessionIdx, debt } = debtorItem;
    const amountNum = amount !== undefined ? amount : debt;
    if (amountNum <= 0) return;

    recordAttendanceAndPayment(groupId, student.rowId, sessionIdx, 'P', amountNum);
    playSuccessChime();

    const receiptNo = `${groupId}-${student.rowId.toString().padStart(3, '0')}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-DZ');
    const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    const targetGroup = data.groupData[groupId];
    const totalFee = student.fee || 2500;
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
      groupId,
      subject: targetGroup?.subject || '',
      teacherName: targetGroup?.teacherName || '',
      amount: amountNum,
      totalFee,
      totalPaid,
      balance,
      isCover: false
    };

    if (printNow) {
      printSingleThermalReceipt(receiptData);
    } else {
      addToPrintQueue({
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        receiptNo,
        groupId,
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
        isCover: false
      });
    }

    // Remove from pending debtors
    setPendingDebtors((prev) => prev.filter((d) => d.id !== debtorItem.id));

    // Update status in recent scans
    setRecentScans((prev) =>
      prev.map((s) => (s.studentName === student.name && s.groupId === groupId ? { ...s, status: 'P', debt: 0 } : s))
    );

    setFlashSuccess({
      name: student.name,
      statusText: `تم تسديد ${amountNum.toLocaleString()} دج بنجاح ✓`,
      details: printNow ? 'تمت طباعة الوصل الحراري' : 'أُضيف لطابور الطباعة'
    });

    setTimeout(() => setFlashSuccess(null), 2000);
  };

  // Debtor Quick Action: Confirm entry as debtor (dismiss from waiting queue, keep attendance)
  const handleDismissDebtorFromQueue = (debtorId: string) => {
    setPendingDebtors((prev) => prev.filter((d) => d.id !== debtorId));
  };

  // Debtor Action 3: Cancel debtor attendance - reverses attendance (does NOT take attendance)
  const handleCancelDebtorAttendance = (debtorItem: typeof pendingDebtors[0]) => {
    const { student, groupId, sessionIdx } = debtorItem;

    // Reset attendance in sheet back to empty string
    updateAttendance(groupId, student.rowId, sessionIdx, '');

    // Remove from pending debtors queue
    setPendingDebtors((prev) => prev.filter((d) => d.id !== debtorItem.id));

    // Remove from recent scans
    setRecentScans((prev) =>
      prev.filter(
        (s) => !(s.studentName === student.name && s.groupId === groupId && s.sessionIndex === sessionIdx)
      )
    );

    setFlashSuccess({
      name: student.name,
      statusText: 'تم إلغاء الحضور ولم يتم احتسابه ✕',
      details: `فوج ${groupId} • الحصة ${sessionIdx + 1}`,
      isWarning: true
    });

    setTimeout(() => setFlashSuccess(null), 2000);
  };

  // ==========================================
  // HANDLERS FOR MANUAL TABS (ADD, PAY, TRANSFER, COVER)
  // ==========================================

  // Tab 2: Add Student
  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      alert('يرجى كتابة اسم التلميذ');
      return;
    }
    const targetGid = addGid || activeGroupId || data.groups[0]?.id;
    if (!targetGid) {
      alert('يرجى اختيار الفوج المستهدف');
      return;
    }

    const created = addStudent(targetGid, {
      name: addName.trim(),
      phone: addPhone.trim(),
      discount: addDiscount
    });

    if (created) {
      const payNum = parseFloat(addInitialPay);
      if (!isNaN(payNum) && payNum > 0) {
        updatePayment(targetGid, created.rowId, 0, payNum);
      }
      playSuccessChime();
      setAddSuccess({
        name: created.name,
        barcode: created.barcode || '',
        group: targetGid,
        rowId: created.rowId
      });
      setAddName('');
      setAddPhone('');
      setAddInitialPay('');
    } else {
      alert('حدث خطأ أثناء إضافة التلميذ');
    }
  };

  // Tab 3: Pay Student Search Submit
  const handlePayStudentSubmit = (printImmediately: boolean) => {
    if (!paySelectedStudent) return;
    const { student, groupId } = paySelectedStudent;
    const amountNum = parseFloat(payCustomAmount) || 0;
    if (amountNum <= 0) {
      alert('يرجى إدخال مبلغ صحيح للتسديد');
      return;
    }

    const targetGroup = data.groupData[groupId];
    const sessionCount = targetGroup?.sessionDates?.length || targetGroup?.sessionCount || 4;
    const currentPayments = Array.isArray(student.payments) ? [...student.payments] : Array(sessionCount).fill('');
    currentPayments[0] = (parseFloat(String(currentPayments[0] || 0)) || 0) + amountNum;
    updateStudentFullFinances(groupId, student.rowId, currentPayments, student.discount);

    playSuccessChime();

    const receiptNo = `${groupId}-${student.rowId.toString().padStart(3, '0')}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-DZ');
    const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
    const totalFee = student.fee || 2500;
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
      groupId,
      subject: targetGroup?.subject || '',
      teacherName: targetGroup?.teacherName || '',
      amount: amountNum,
      totalFee,
      totalPaid,
      balance,
      isCover: false
    };

    if (printImmediately) {
      printSingleThermalReceipt(receiptData);
    } else {
      addToPrintQueue({
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        receiptNo,
        groupId,
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
        sessionIndex: 0,
        isCover: false
      });
    }

    setPaySuccessMsg(`تم تسجيل دفعة بقيمة ${amountNum.toLocaleString()} دج للتلميذ "${student.name}" بنجاح ✓`);
    setPaySelectedStudent(null);
    setPaySearchQuery('');
    setPayCustomAmount('');
    setTimeout(() => setPaySuccessMsg(null), 4000);
  };

  // Tab 4: Manual Change Student Group
  const handleTransferStudentSubmit = () => {
    if (!changeSelectedStudent) return;
    const { student, fromGroupId } = changeSelectedStudent;
    if (!changeTargetGroupId || changeTargetGroupId === fromGroupId) {
      alert('يرجى اختيار فوج وجهة مختلف عن الفوج الحالي');
      return;
    }

    const success = transferStudent(fromGroupId, changeTargetGroupId, student.rowId);
    if (success) {
      playSuccessChime();
      setChangeSuccessMsg(`تم نقل التلميذ "${student.name}" من فوج ${fromGroupId} إلى فوج ${changeTargetGroupId} بنجاح ✓`);
      setChangeSelectedStudent(null);
      setChangeSearchQuery('');
      setTimeout(() => setChangeSuccessMsg(null), 4000);
    } else {
      alert('تعذر إتمام عملية النقل');
    }
  };

  // Tab 5: Manual Covering Registration
  const handleCoverStudentSubmit = () => {
    if (!coverSelectedStudent) return;
    const { student, originalGroupId } = coverSelectedStudent;
    const targetGid = coverTargetGid || activeGroupId;
    if (!targetGid) {
      alert('يرجى تحديد الفوج المستهدف لحصة التعويض');
      return;
    }

    const payAmt = parseFloat(coverAmountInput) || 0;
    recordCoverAttendance(targetGid, originalGroupId, student.rowId, coverSessionIdx, payAmt);
    playSuccessChime();

    setRecentScans((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        studentName: student.name,
        groupId: targetGid,
        sessionIndex: coverSessionIdx,
        status: 'M',
        time: new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })
      },
      ...prev.slice(0, 9)
    ]);

    setCoverSuccessMsg(
      `تم تسجيل حضور التعويض للتلميذ "${student.name}" في فوجه الأصلي ${originalGroupId} وفوج ${targetGid} بنجاح ✓`
    );
    setCoverSelectedStudent(null);
    setCoverSearchQuery('');
    setCoverAmountInput('');
    setTimeout(() => setCoverSuccessMsg(null), 4000);
  };

  // Total pending items in the Live Queue
  const totalQueueCount = pendingCoverRequests.length + pendingDebtors.length;

  // ==========================================
  // RENDER: CODEBAR SECTION (اليمين)
  // Continuous scanning, clean, unobstructed!
  // ==========================================
  const renderCodebarSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Codebar Header Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            الأفواج النشطة ({activeGroups.length}):
          </span>

          {/* Button 1: Add Covering Group for Today */}
          <button
            type="button"
            onClick={() => {
              setNewCoverGroupId(data.groups[0]?.id || '');
              setNewCoverGroupSessionIdx(0);
              setShowAddCoverGroupModal(true);
            }}
            className="m3-btn m3-btn-sm"
            style={{
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.74rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
            }}
            title="إضافة فوج تعويض خاص لهذا اليوم يظهر فوراً في محطة المسح"
          >
            <Sparkles size={13} />
            <span>+ إضافة فوج تعويض لهذا اليوم 🔄</span>
          </button>

          {/* Button 2: Add Normal Active Group */}
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
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            title="إضافة فوج آخر نشط في نفس الوقت"
          >
            <Plus size={12} />
            <span>+ إضافة فوج نشط</span>
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
                padding: '4px 7px',
                borderRadius: '6px'
              }}
            >
              <UserX size={11} />
              <span>إنهاء الكل ({activeGroups.length})</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setShowQueueModal(true)}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.74rem',
              padding: '3px 8px',
              borderColor: printQueue.length > 0 ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
              backgroundColor: printQueue.length > 0 ? 'var(--md-sys-color-primary-container)' : 'transparent',
              color: printQueue.length > 0 ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'
            }}
          >
            <Printer size={13} />
            <span>طابور الطباعة ({printQueue.length})</span>
          </button>
        </div>
      </div>

      {/* Active Group Cards Container */}
      <div
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          padding: '8px',
          borderRadius: 'var(--md-shape-md)',
          border: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        {activeGroups.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: activeGroups.length > 1 ? 'repeat(auto-fit, minmax(230px, 1fr))' : '1fr',
              gap: '8px'
            }}
          >
            {activeGroups.map((ag, idx) => {
              const gSheet = data.groupData[ag.groupId];
              const gStats = getGroupStats(ag.groupId, ag.sessionIndex);
              const isCoveringToday = coveringGroupIds.includes(ag.groupId);

              return (
                <div
                  key={`${ag.groupId}-${idx}`}
                  style={{
                    backgroundColor: isCoveringToday ? '#fffbeb' : 'var(--md-sys-color-surface)',
                    borderRadius: '8px',
                    border: isCoveringToday ? '2px solid #f59e0b' : '1px solid var(--md-sys-color-outline-variant)',
                    padding: '8px 10px',
                    boxShadow: isCoveringToday ? '0 2px 8px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                    position: 'relative'
                  }}
                >
                  {isCoveringToday && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#fef3c7',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginBottom: '2px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          color: '#b45309',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        ⭐ فوج تعويض لهذا اليوم 🔄
                      </span>
                      <button
                        type="button"
                        onClick={() => setCoveringGroupIds((prev) => prev.filter((id) => id !== ag.groupId))}
                        className="m3-btn-text"
                        style={{ fontSize: '0.65rem', color: '#b45309', padding: '0 4px', fontWeight: 800 }}
                        title="إلغاء وسم التعويض عن هذا الفوج"
                      >
                        إلغاء التعويض ✕
                      </button>
                    </div>
                  )}

                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: isCoveringToday ? '#f59e0b' : 'var(--md-sys-color-primary)',
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
                  </div>

                  {/* Card Selectors */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>
                        الفوج:
                      </span>
                      <select
                        value={ag.groupId}
                        onChange={(e) => handleUpdateActiveGroup(idx, e.target.value)}
                        className="m3-input"
                        style={{ padding: '3px 6px', fontSize: '0.76rem', fontWeight: 700, width: '100%', height: '28px' }}
                      >
                        {data.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            فوج {g.id} ({g.subject})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>
                        الحصة:
                      </span>
                      <select
                        value={ag.sessionIndex}
                        onChange={(e) => handleUpdateActiveSession(idx, Number(e.target.value))}
                        className="m3-input"
                        style={{ padding: '3px 6px', fontSize: '0.76rem', fontWeight: 700, width: '100%', height: '28px' }}
                      >
                        {Array.from({ length: gSheet?.sessionCount || 4 }).map((_, sIdx) => (
                          <option key={sIdx} value={sIdx}>
                            الحصة {sIdx + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px dashed var(--md-sys-color-outline-variant)',
                      paddingTop: '5px',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: '#166534'
                        }}
                      >
                        حاضر: {gStats.present}/{gStats.total}
                      </span>
                      {gStats.absent > 0 && (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fca5a5',
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            color: '#b91c1c'
                          }}
                        >
                          غائب: {gStats.absent}
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
                        borderRadius: '5px',
                        height: '24px'
                      }}
                    >
                      إنهاء الحصة (A)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#fff7ed',
              border: '1.5px dashed #fdba74',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#ea580c', fontWeight: 800, fontSize: '0.86rem' }}>
              <Clock size={16} />
              <span>لا يوجد أي فوج دراسي في هذا الوقت</span>
            </div>
            <p style={{ margin: '4px 0 8px', fontSize: '0.74rem', color: '#7c2d12' }}>
              تظهر الأفواج تلقائياً، أو يمكنك إضافة فوج تعويض لهذا اليوم أو تفعيل فوج يدوياً.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setNewCoverGroupId(data.groups[0]?.id || '');
                  setNewCoverGroupSessionIdx(0);
                  setShowAddCoverGroupModal(true);
                }}
                className="m3-btn m3-btn-sm"
                style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.72rem', fontWeight: 800 }}
              >
                + إضافة فوج تعويض لهذا اليوم 🔄
              </button>
              <button
                type="button"
                onClick={() => handleAddActiveGroup()}
                className="m3-btn m3-btn-outlined m3-btn-sm"
                style={{ fontSize: '0.72rem', fontWeight: 700 }}
              >
                + تفعيل فوج يدوياً
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Session Counter Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          textAlign: 'center'
        }}
      >
        <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>حاضر (P):</span>
          <span style={{ fontSize: '0.94rem', fontWeight: 900 }}>{sessionStats.present}</span>
        </div>
        <div style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>تعويض (M/C):</span>
          <span style={{ fontSize: '0.94rem', fontWeight: 900 }}>{sessionStats.makeup}</span>
        </div>
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>غائب (A):</span>
          <span style={{ fontSize: '0.94rem', fontWeight: 900 }}>{sessionStats.absent}</span>
        </div>
        <div style={{ backgroundColor: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface)', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>لم يمسح:</span>
          <span style={{ fontSize: '0.94rem', fontWeight: 900 }}>{sessionStats.unmarked}</span>
        </div>
      </div>

      {/* Barcode Scanner Box Area */}
      <form onSubmit={handleBarcodeSubmit}>
        <div
          style={{
            border: '2px dashed var(--md-sys-color-primary)',
            borderRadius: 'var(--md-shape-md)',
            padding: '10px 14px',
            textAlign: 'center',
            backgroundColor: 'var(--md-sys-color-primary-container)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Scan size={20} color="var(--md-sys-color-primary)" className="animate-pulse" />
              <span style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--md-sys-color-on-primary-container)' }}>
                وجّه قارئ الباركود نحو بطاقة التلميذ
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(21, 128, 61, 0.12)', color: '#15803d', padding: '1px 7px', borderRadius: '8px', fontSize: '0.66rem', fontWeight: 800 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} className="animate-pulse" />
                <span>الماسح يعمل في الخلفية ⚡</span>
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
                  backgroundColor: fastScanMode ? '#16a34a' : 'rgba(0,0,0,0.04)',
                  borderColor: fastScanMode ? '#15803d' : 'var(--md-sys-color-outline-variant)',
                  color: fastScanMode ? '#ffffff' : 'var(--md-sys-color-on-surface-variant)'
                }}
              >
                <Sparkles size={11} />
                <span>مسح متواصل: {fastScanMode ? 'مفعّل ⚡' : 'معطل'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', width: '100%', maxWidth: '380px' }}>
              <input
                ref={scannerInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => {
                  const val = normalizeScannedBarcode(e.target.value);
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
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  padding: '5px 10px',
                  height: '34px',
                  backgroundColor: '#fff',
                  borderColor: 'var(--md-sys-color-primary)'
                }}
              />
              <button type="submit" className="m3-btn m3-btn-primary" style={{ fontWeight: 800, padding: '4px 14px', fontSize: '0.82rem', height: '34px' }}>
                تأكيد
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Short Toast Banner on Right */}
      {flashSuccess && (
        <div
          style={{
            backgroundColor: flashSuccess.isWarning ? '#fff7ed' : '#dcfce7',
            border: flashSuccess.isWarning ? '1.5px solid #fdba74' : '1.5px solid #86efac',
            borderRadius: 'var(--md-shape-md)',
            padding: '8px 12px',
            textAlign: 'center',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {flashSuccess.isWarning ? (
              <AlertTriangle size={18} color="#c2410c" />
            ) : (
              <CheckCircle2 size={18} color="#15803d" />
            )}
            <span style={{ fontWeight: 900, fontSize: '0.94rem', color: flashSuccess.isWarning ? '#c2410c' : '#15803d' }}>
              {flashSuccess.name}
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: flashSuccess.isWarning ? '#9a3412' : '#166534' }}>
              — {flashSuccess.statusText}
            </span>
          </div>
          {flashSuccess.details && (
            <div style={{ fontSize: '0.74rem', color: flashSuccess.isWarning ? '#7c2d12' : '#14532d', marginTop: '2px' }}>
              {flashSuccess.details}
            </div>
          )}
        </div>
      )}

      {/* Live Recent Scans History Card (Right side) */}
      <div
        style={{
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: 'var(--md-shape-md)',
          backgroundColor: 'var(--md-sys-color-surface)',
          padding: '10px 12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ListOrdered size={15} color="var(--md-sys-color-primary)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              سجل المسح المباشر (آخر العمليات في هذه الجلسة):
            </span>
          </div>
          {recentScans.length > 0 && (
            <button
              onClick={() => setRecentScans([])}
              className="m3-btn-text"
              style={{ fontSize: '0.68rem', color: 'var(--md-sys-color-outline)' }}
            >
              مسح السجل
            </button>
          )}
        </div>

        {recentScans.length === 0 ? (
          <div style={{ fontSize: '0.76rem', color: 'var(--md-sys-color-outline)', textAlign: 'center', padding: '12px' }}>
            لا توجد عمليات مسح حتى الآن. مرر بطاقات التلاميذ ليظهر سجل الحضور هنا تلقائياً.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  fontSize: '0.76rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
                    {scan.time}
                  </span>
                  <strong style={{ color: 'var(--md-sys-color-on-surface)' }}>{scan.studentName}</strong>
                  <span style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.7rem' }}>
                    ({scan.groupId} • ح{scan.sessionIndex + 1})
                  </span>
                </div>

                <div>
                  {scan.status === 'P' && (
                    <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.68rem' }}>
                      حاضر ✓
                    </span>
                  )}
                  {scan.status === 'M' && (
                    <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.68rem' }}>
                      تعويض 🔄
                    </span>
                  )}
                  {scan.status === 'DEBT' && (
                    <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.68rem' }}>
                      مدين ({scan.debt?.toLocaleString()} دج) ⚠️
                    </span>
                  )}
                  {scan.status === 'COVER_REQ' && (
                    <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.68rem' }}>
                      طلب تعويض 👈
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ==========================================
  // RENDER: OPERATIONS & LIVE ACTION QUEUE (اليسار)
  // All notifications (covering requests, unpaid waiting list) appear here!
  // ==========================================
  const renderOperationsPanel = () => {
    const paySearchResults = searchStudentsAcrossCenter(paySearchQuery);
    const changeSearchResults = searchStudentsAcrossCenter(changeSearchQuery);
    const coverSearchResults = searchStudentsAcrossCenter(coverSearchQuery);

    return (
      <div
        style={{
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-lg)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            padding: '12px 14px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 900, color: 'var(--md-sys-color-on-surface)' }}>
              لوحة الإجراءات المباشرة والعمليات السريعة
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              تظهر هنا فورياً تنبيهات الباركود (التعويض، غير المسددين) وتعمل بالتوازي دون تعطيل المسح
            </p>
          </div>
          {totalQueueCount > 0 ? (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 900,
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
              className="animate-pulse"
            >
              ● {totalQueueCount} إجراء معلق بحاجة لمتابعة
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
            >
              ● جاهز لاستقبال الإشعارات
            </span>
          )}
        </div>

        {/* Tabs Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          {/* TAB 1: Live Queue */}
          <button
            type="button"
            onClick={() => setLeftTab('queue')}
            style={{
              padding: '9px 2px',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: leftTab === 'queue' ? 'var(--md-sys-color-surface)' : 'transparent',
              color: leftTab === 'queue' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderBottom: leftTab === 'queue' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent'
            }}
          >
            <Bell size={13} />
            <span>قائمة الإجراءات</span>
            {totalQueueCount > 0 && (
              <span
                style={{
                  backgroundColor: '#b91c1c',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 900
                }}
              >
                {totalQueueCount}
              </span>
            )}
          </button>

          {/* TAB 2: Add Student */}
          <button
            type="button"
            onClick={() => setLeftTab('add')}
            style={{
              padding: '9px 2px',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: leftTab === 'add' ? 'var(--md-sys-color-surface)' : 'transparent',
              color: leftTab === 'add' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderBottom: leftTab === 'add' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent'
            }}
          >
            <UserPlus size={13} />
            <span>إضافة تلميذ</span>
          </button>

          {/* TAB 3: Pay Student */}
          <button
            type="button"
            onClick={() => setLeftTab('pay')}
            style={{
              padding: '9px 2px',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: leftTab === 'pay' ? 'var(--md-sys-color-surface)' : 'transparent',
              color: leftTab === 'pay' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderBottom: leftTab === 'pay' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent'
            }}
          >
            <CreditCard size={13} />
            <span>تسديد مستحقات</span>
          </button>

          {/* TAB 4: Change Student */}
          <button
            type="button"
            onClick={() => setLeftTab('change')}
            style={{
              padding: '9px 2px',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: leftTab === 'change' ? 'var(--md-sys-color-surface)' : 'transparent',
              color: leftTab === 'change' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderBottom: leftTab === 'change' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent'
            }}
          >
            <ArrowLeftRight size={13} />
            <span>نقل تلميذ</span>
          </button>

          {/* TAB 5: Covering */}
          <button
            type="button"
            onClick={() => setLeftTab('cover')}
            style={{
              padding: '9px 2px',
              fontSize: '0.74rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: leftTab === 'cover' ? 'var(--md-sys-color-surface)' : 'transparent',
              color: leftTab === 'cover' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderBottom: leftTab === 'cover' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent'
            }}
          >
            <CalendarCheck size={13} />
            <span>تسجيل تعويض</span>
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '14px', minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          {/* ========================================================================= */}
          {/* TAB 1: LIVE NOTIFICATION & ACTION QUEUE                                   */}
          {/* ========================================================================= */}
          {leftTab === 'queue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* SECTION A: SCANNER COVERING & TRANSFER REQUEST CARD (COMPACT) */}
              {pendingCoverRequests.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
                    <AlertTriangle size={16} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>
                      طلبات التعويض والتحويل ({pendingCoverRequests.length}):
                    </span>
                  </div>

                  {pendingCoverRequests.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        backgroundColor: '#fffbeb',
                        border: '1px solid #f59e0b',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        flexWrap: 'wrap',
                        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)'
                      }}
                    >
                      {/* Name and Origin Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.92rem', color: '#92400e' }}>
                          {req.student.name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#78350f', backgroundColor: '#fde68a', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          فوج {req.homeGroupId}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#92400e' }}>
                          ➔ يحضر في: {req.targetActiveGroupId}
                        </span>
                      </div>

                      {/* Compact Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {/* Cover Button */}
                        <button
                          type="button"
                          onClick={() => setConfirmActionModal({ type: 'cover', req })}
                          className="m3-btn m3-btn-sm"
                          style={{
                            backgroundColor: '#d97706',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            padding: '3px 10px',
                            height: '28px',
                            fontWeight: 800,
                            borderRadius: '6px'
                          }}
                          title="تسجيل كحصة تعويض في الفوج الأصلي"
                        >
                          🔄 تعويض
                        </button>

                        {/* Move Button */}
                        <button
                          type="button"
                          onClick={() => setConfirmActionModal({ type: 'transfer', req })}
                          className="m3-btn m3-btn-sm"
                          style={{
                            backgroundColor: '#4f46e5',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            padding: '3px 10px',
                            height: '28px',
                            fontWeight: 800,
                            borderRadius: '6px'
                          }}
                          title="نقل التلميذ نهائياً لهذا الفوج"
                        >
                          🔀 نقل
                        </button>

                        {/* Cancel Button - does NOT take attendance */}
                        <button
                          type="button"
                          onClick={() => handleCancelCoverRequest(req.id)}
                          className="m3-btn m3-btn-sm"
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#92400e',
                            border: '1px solid #d97706',
                            fontSize: '0.74rem',
                            padding: '3px 8px',
                            height: '28px',
                            fontWeight: 700,
                            borderRadius: '6px'
                          }}
                          title="إلغاء الطلب وعدم احتساب الحضور"
                        >
                          ✕ إلغاء
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION B: UNPAID / DEBTORS WAITING LIST (COMPACT) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={16} color="var(--md-sys-color-primary)" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                      قائمة غير المسددين ({pendingDebtors.length}):
                    </span>
                  </div>
                  {pendingDebtors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPendingDebtors([])}
                      className="m3-btn-text"
                      style={{ fontSize: '0.68rem', color: '#b91c1c' }}
                    >
                      تفريغ القائمة
                    </button>
                  )}
                </div>

                {pendingDebtors.length === 0 && pendingCoverRequests.length === 0 ? (
                  <div
                    style={{
                      border: '1.5px dashed var(--md-sys-color-outline-variant)',
                      borderRadius: '8px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      color: 'var(--md-sys-color-outline)'
                    }}
                  >
                    <CheckCheck size={28} color="#059669" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#065f46' }}>
                      لا توجد طلبات تعويض أو ديون معلقة حالياً
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
                      عند مسح بطاقة تلميذ غير مسدد أو تلميذ من فوج آخر، سيظهر هنا فوراً لاتخاذ الإجراء المناسب.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pendingDebtors.map((debtor, idx) => (
                      <div
                        key={debtor.id}
                        style={{
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          flexWrap: 'wrap',
                          boxShadow: '0 1px 3px rgba(239, 68, 68, 0.08)'
                        }}
                      >
                        {/* Student Name and Debt Amount */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#b91c1c',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.68rem',
                              fontWeight: 900
                            }}
                          >
                            {idx + 1}
                          </span>
                          <strong style={{ fontSize: '0.92rem', color: '#7f1d1d' }}>
                            {debtor.student.name}
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#991b1b', backgroundColor: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            المبلغ المطلوب: {debtor.debt.toLocaleString()} دج
                          </span>
                        </div>

                        {/* 3 Compact Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {/* 1. Pay */}
                          <button
                            type="button"
                            onClick={() => handleSettleDebtorInQueue(debtor, debtor.debt, true)}
                            className="m3-btn m3-btn-sm"
                            style={{
                              backgroundColor: '#15803d',
                              color: '#fff',
                              fontSize: '0.74rem',
                              padding: '3px 8px',
                              height: '28px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              borderRadius: '6px'
                            }}
                            title="تسديد المبلغ وطباعة الوصل فوراً"
                          >
                            <Printer size={12} />
                            <span>تسديد ({debtor.debt}) 🖨️</span>
                          </button>

                          {/* 2. Accept without paying (keep attendance) */}
                          <button
                            type="button"
                            onClick={() => handleDismissDebtorFromQueue(debtor.id)}
                            className="m3-btn m3-btn-sm"
                            style={{
                              backgroundColor: '#fff',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              height: '28px',
                              fontWeight: 800,
                              borderRadius: '6px'
                            }}
                            title="قبول الدخول كمدين مع تثبيت الحضور"
                          >
                            قبول كمدين ✓
                          </button>

                          {/* 3. Cancel attendance (don't take attendance) */}
                          <button
                            type="button"
                            onClick={() => handleCancelDebtorAttendance(debtor)}
                            className="m3-btn m3-btn-sm"
                            style={{
                              backgroundColor: '#fff',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              fontSize: '0.72rem',
                              padding: '3px 8px',
                              height: '28px',
                              fontWeight: 800,
                              borderRadius: '6px'
                            }}
                            title="إلغاء الحضور وعدم احتسابه نهائياً"
                          >
                            ✕ إلغاء الحضور
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* ========================================================================= */}
          {/* TAB 2: ADD NEW STUDENT                                                    */}
          {/* ========================================================================= */}
          {leftTab === 'add' && (
            <div>
              {addSuccess && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: 'var(--md-shape-md)',
                    padding: '10px 12px',
                    marginBottom: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065f46', fontWeight: 800, fontSize: '0.86rem' }}>
                    <CheckCircle size={18} />
                    <span>تمت إضافة التلميذ بنجاح وتوليد بطاقته!</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '4px', lineHeight: 1.5 }}>
                    الاسم: <strong>{addSuccess.name}</strong> • الفوج: <strong>{addSuccess.group}</strong>
                    <br />
                    الرمز الشريطي: <strong style={{ letterSpacing: '1px' }}>{addSuccess.barcode}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddSuccess(null)}
                    className="m3-btn m3-btn-outlined m3-btn-sm"
                    style={{ fontSize: '0.72rem', height: '26px', marginTop: '6px' }}
                  >
                    إضافة تلميذ آخر
                  </button>
                </div>
              )}

              <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                    الفوج المستهدف:
                  </label>
                  <select
                    value={addGid}
                    onChange={(e) => setAddGid(e.target.value)}
                    className="m3-input"
                    style={{ width: '100%', height: '32px', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    {data.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        فوج {g.id} ({g.subject} - {g.teacherName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                    اسم التلميذ الكامل *:
                  </label>
                  <input
                    type="text"
                    id="add-student-name-input"
                    value={addName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/(STU-[A-Za-z0-9]+|STU[A-Za-z0-9]+|\b\d{8}\b)/i);
                      if (match) {
                        const code = match[0];
                        const cleaned = val.replace(code, '').trim();
                        setAddName(cleaned);
                        handleBarcodeSubmit(undefined, code);
                        return;
                      }
                      setAddName(val);
                    }}
                    placeholder="مثال: أمين بلقاسم"
                    className="m3-input"
                    style={{ width: '100%', height: '32px', fontSize: '0.82rem', fontWeight: 700 }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                      رقم الهاتف (اختياري):
                    </label>
                    <input
                      type="text"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="05 / 06 / 07..."
                      className="m3-input"
                      style={{ width: '100%', height: '32px', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                      التخفيض:
                    </label>
                    <select
                      value={addDiscount}
                      onChange={(e) => setAddDiscount(e.target.value as DiscountType)}
                      className="m3-input"
                      style={{ width: '100%', height: '32px', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      <option value="1">كامل (0% خصم)</option>
                      <option value="0.8">أخوة (20% خصم)</option>
                      <option value="0">مجاني / معفى</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                    دفعة أولية للتسديد الفوري (اختياري - دج):
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      value={addInitialPay}
                      onChange={(e) => setAddInitialPay(e.target.value)}
                      placeholder="0 دج أو ادخل المبلغ..."
                      className="m3-input"
                      style={{ flex: 1, height: '32px', fontSize: '0.82rem', fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      onClick={() => setAddInitialPay('2500')}
                      className="m3-btn m3-btn-outlined m3-btn-sm"
                      style={{ fontSize: '0.72rem', height: '32px' }}
                    >
                      2500 دج
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddInitialPay('1000')}
                      className="m3-btn m3-btn-outlined m3-btn-sm"
                      style={{ fontSize: '0.72rem', height: '32px' }}
                    >
                      1000 دج
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="m3-btn m3-btn-primary"
                  style={{
                    marginTop: '6px',
                    height: '36px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <UserPlus size={15} />
                  <span>إضافة التلميذ وتوليد بطاقة الباركود ⚡</span>
                </button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PAY STUDENT (MANUAL SEARCH)                                        */}
          {/* ========================================================================= */}
          {leftTab === 'pay' && (
            <div>
              {paySuccessMsg && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: 'var(--md-shape-md)',
                    padding: '8px 12px',
                    color: '#065f46',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    marginBottom: '10px'
                  }}
                >
                  {paySuccessMsg}
                </div>
              )}

              <div style={{ marginBottom: '10px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                  البحث عن التلميذ (بالاسم أو الهاتف أو الباركود):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="pay-search-input"
                    value={paySearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/(STU-[A-Za-z0-9]+|STU[A-Za-z0-9]+|\b\d{8}\b)/i);
                      if (match) {
                        const code = match[0];
                        const cleaned = val.replace(code, '').trim();
                        setPaySearchQuery(cleaned);
                        handleBarcodeSubmit(undefined, code);
                        return;
                      }
                      setPaySearchQuery(val);
                      if (paySelectedStudent) setPaySelectedStudent(null);
                    }}
                    placeholder="اكتب اسم التلميذ أو جزءاً منه..."
                    className="m3-input"
                    style={{ width: '100%', height: '34px', paddingRight: '28px', fontSize: '0.82rem' }}
                  />
                  <Search
                    size={14}
                    style={{ position: 'absolute', right: '8px', top: '10px', color: 'var(--md-sys-color-outline)' }}
                  />
                </div>

                {paySearchQuery.trim().length >= 2 && !paySelectedStudent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 50,
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}
                  >
                    {paySearchResults.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '0.74rem', color: 'var(--md-sys-color-outline)', textAlign: 'center' }}>
                        لا يوجد تلميذ بهذا الاسم
                      </div>
                    ) : (
                      paySearchResults.map(({ student, groupId }) => (
                        <div
                          key={`${groupId}-${student.rowId}`}
                          onClick={() => {
                            setPaySelectedStudent({ student, groupId });
                            setPayCustomAmount(String(student.debt > 0 ? student.debt : 2500));
                          }}
                          style={{
                            padding: '8px 10px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                        >
                          <div>
                            <strong>{student.name}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginRight: '6px' }}>
                              فوج {groupId}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: student.debt > 0 ? '#b91c1c' : '#15803d'
                            }}
                          >
                            {student.debt > 0 ? `دين: ${student.debt} دج` : 'خالص ✓'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {paySelectedStudent && (
                <div
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.94rem', color: 'var(--md-sys-color-primary)' }}>
                        {paySelectedStudent.student.name}
                      </strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        فوج {paySelectedStudent.groupId} ({data.groupData[paySelectedStudent.groupId]?.subject || ''})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaySelectedStudent(null)}
                      className="m3-btn-text"
                      style={{ fontSize: '0.7rem', color: '#b91c1c' }}
                    >
                      تغيير التلميذ
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.66rem', color: '#475569' }}>المستحق:</div>
                      <strong style={{ fontSize: '0.8rem' }}>
                        {(paySelectedStudent.student.fee || 2500).toLocaleString()} دج
                      </strong>
                    </div>
                    <div style={{ backgroundColor: '#ecfdf5', padding: '4px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.66rem', color: '#047857' }}>المسدد:</div>
                      <strong style={{ fontSize: '0.8rem', color: '#15803d' }}>
                        {(paySelectedStudent.student.totalReceived || 0).toLocaleString()} دج
                      </strong>
                    </div>
                    <div style={{ backgroundColor: '#fee2e2', padding: '4px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.66rem', color: '#b91c1c' }}>المتبقي (الدين):</div>
                      <strong style={{ fontSize: '0.82rem', color: '#b91c1c' }}>
                        {(paySelectedStudent.student.debt || 0).toLocaleString()} دج
                      </strong>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '2px' }}>
                      المبلغ المراد تسديده الآن (دج):
                    </label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={payCustomAmount}
                        onChange={(e) => setPayCustomAmount(e.target.value)}
                        className="m3-input"
                        style={{ flex: 1, height: '34px', fontSize: '0.9rem', fontWeight: 900, color: '#15803d' }}
                      />
                      {paySelectedStudent.student.debt > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayCustomAmount(String(paySelectedStudent.student.debt))}
                          className="m3-btn m3-btn-outlined m3-btn-sm"
                          style={{ fontSize: '0.7rem', height: '34px', whiteSpace: 'nowrap' }}
                        >
                          كامل الدين ({paySelectedStudent.student.debt})
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handlePayStudentSubmit(true)}
                      className="m3-btn m3-btn-primary"
                      style={{
                        height: '36px',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Printer size={14} />
                      <span>تسديد وطباعة الوصل 🖨️</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePayStudentSubmit(false)}
                      className="m3-btn"
                      style={{
                        height: '36px',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        backgroundColor: '#0284c7',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <ListOrdered size={14} />
                      <span>تأجيل للطابور 📋</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MANUAL CHANGE STUDENT GROUP                                        */}
          {/* ========================================================================= */}
          {leftTab === 'change' && (
            <div>
              {changeSuccessMsg && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: 'var(--md-shape-md)',
                    padding: '8px 12px',
                    color: '#065f46',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    marginBottom: '10px'
                  }}
                >
                  {changeSuccessMsg}
                </div>
              )}

              <div style={{ marginBottom: '10px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                  ابحث عن التلميذ المراد نقله:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="change-search-input"
                    value={changeSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/(STU-[A-Za-z0-9]+|STU[A-Za-z0-9]+|\b\d{8}\b)/i);
                      if (match) {
                        const code = match[0];
                        const cleaned = val.replace(code, '').trim();
                        setChangeSearchQuery(cleaned);
                        handleBarcodeSubmit(undefined, code);
                        return;
                      }
                      setChangeSearchQuery(val);
                      if (changeSelectedStudent) setChangeSelectedStudent(null);
                    }}
                    placeholder="اكتب اسم التلميذ أو هاتفه..."
                    className="m3-input"
                    style={{ width: '100%', height: '34px', paddingRight: '28px', fontSize: '0.82rem' }}
                  />
                  <Search
                    size={14}
                    style={{ position: 'absolute', right: '8px', top: '10px', color: 'var(--md-sys-color-outline)' }}
                  />
                </div>

                {changeSearchQuery.trim().length >= 2 && !changeSelectedStudent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 50,
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}
                  >
                    {changeSearchResults.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '0.74rem', color: 'var(--md-sys-color-outline)', textAlign: 'center' }}>
                        لا يوجد تلميذ مطابق
                      </div>
                    ) : (
                      changeSearchResults.map(({ student, groupId }) => (
                        <div
                          key={`${groupId}-${student.rowId}`}
                          onClick={() => {
                            setChangeSelectedStudent({ student, fromGroupId: groupId });
                            const otherGroup = data.groups.find((g) => g.id !== groupId)?.id || '';
                            setChangeTargetGroupId(otherGroup);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                        >
                          <div>
                            <strong>{student.name}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginRight: '6px' }}>
                              فوج حالي: {groupId}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                            تحديد للنقل ←
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {changeSelectedStudent && (
                <div
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--md-sys-color-on-surface)' }}>
                        {changeSelectedStudent.student.name}
                      </strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        الباركود: {changeSelectedStudent.student.barcode || '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChangeSelectedStudent(null)}
                      className="m3-btn-text"
                      style={{ fontSize: '0.7rem', color: '#b91c1c' }}
                    >
                      إلغاء التحديد
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
                        الفوج الحالي (الأصلي):
                      </label>
                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fca5a5',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          color: '#b91c1c'
                        }}
                      >
                        فوج {changeSelectedStudent.fromGroupId}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#166534', marginBottom: '2px' }}>
                        الفوج الجديد (الوجهة):
                      </label>
                      <select
                        value={changeTargetGroupId}
                        onChange={(e) => setChangeTargetGroupId(e.target.value)}
                        className="m3-input"
                        style={{ width: '100%', height: '34px', fontSize: '0.78rem', fontWeight: 800, borderColor: '#86efac' }}
                      >
                        {data.groups
                          .filter((g) => g.id !== changeSelectedStudent.fromGroupId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              فوج {g.id} ({g.subject})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTransferStudentSubmit}
                    className="m3-btn m3-btn-primary"
                    style={{
                      height: '38px',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px'
                    }}
                  >
                    <ArrowLeftRight size={16} />
                    <span>تأكيد نقل التلميذ إلى الفوج الجديد الآن 🔄</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: MANUAL COVERING REGISTRATION                                       */}
          {/* ========================================================================= */}
          {leftTab === 'cover' && (
            <div>
              {coverSuccessMsg && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: 'var(--md-shape-md)',
                    padding: '8px 12px',
                    color: '#065f46',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    marginBottom: '10px'
                  }}
                >
                  {coverSuccessMsg}
                </div>
              )}

              <div style={{ marginBottom: '10px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                  البحث عن التلميذ لتسجيل حصة تعويض:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="cover-search-input"
                    value={coverSearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/(STU-[A-Za-z0-9]+|STU[A-Za-z0-9]+|\b\d{8}\b)/i);
                      if (match) {
                        const code = match[0];
                        const cleaned = val.replace(code, '').trim();
                        setCoverSearchQuery(cleaned);
                        handleBarcodeSubmit(undefined, code);
                        return;
                      }
                      setCoverSearchQuery(val);
                      if (coverSelectedStudent) setCoverSelectedStudent(null);
                    }}
                    placeholder="ابحث بالاسم أو الهاتف..."
                    className="m3-input"
                    style={{ width: '100%', height: '34px', paddingRight: '28px', fontSize: '0.82rem' }}
                  />
                  <Search
                    size={14}
                    style={{ position: 'absolute', right: '8px', top: '10px', color: 'var(--md-sys-color-outline)' }}
                  />
                </div>

                {coverSearchQuery.trim().length >= 2 && !coverSelectedStudent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 50,
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}
                  >
                    {coverSearchResults.length === 0 ? (
                      <div style={{ padding: '8px', fontSize: '0.74rem', color: 'var(--md-sys-color-outline)', textAlign: 'center' }}>
                        لا يوجد تلميذ مطابق
                      </div>
                    ) : (
                      coverSearchResults.map(({ student, groupId }) => (
                        <div
                          key={`${groupId}-${student.rowId}`}
                          onClick={() => {
                            setCoverSelectedStudent({ student, originalGroupId: groupId });
                            setCoverTargetGid(activeGroupId || data.groups[0]?.id || '');
                            setCoverSessionIdx(activeSessionIdx || 0);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.78rem'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                        >
                          <div>
                            <strong>{student.name}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginRight: '6px' }}>
                              الفوج الأصلي: {groupId}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>
                            تسجيل تعويض ←
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {coverSelectedStudent && (
                <div
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--md-sys-color-on-surface)' }}>
                        {coverSelectedStudent.student.name}
                      </strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        الفوج الأصلي: <strong>{coverSelectedStudent.originalGroupId}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoverSelectedStudent(null)}
                      className="m3-btn-text"
                      style={{ fontSize: '0.7rem', color: '#b91c1c' }}
                    >
                      إلغاء التحديد
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '2px' }}>
                        الفوج المراد حضوره للتعويض:
                      </label>
                      <select
                        value={coverTargetGid}
                        onChange={(e) => setCoverTargetGid(e.target.value)}
                        className="m3-input"
                        style={{ width: '100%', height: '32px', fontSize: '0.78rem', fontWeight: 800 }}
                      >
                        {data.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            فوج {g.id} ({g.subject})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '2px' }}>
                        الحصة:
                      </label>
                      <select
                        value={coverSessionIdx}
                        onChange={(e) => setCoverSessionIdx(Number(e.target.value))}
                        className="m3-input"
                        style={{ width: '100%', height: '32px', fontSize: '0.78rem', fontWeight: 800 }}
                      >
                        {Array.from({ length: 4 }).map((_, i) => (
                          <option key={i} value={i}>
                            الحصة {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, marginBottom: '2px' }}>
                      مبلغ مستلم لحصة التعويض (اختياري - دج):
                    </label>
                    <input
                      type="number"
                      value={coverAmountInput}
                      onChange={(e) => setCoverAmountInput(e.target.value)}
                      placeholder="0 دج"
                      className="m3-input"
                      style={{ width: '100%', height: '32px', fontSize: '0.8rem' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCoverStudentSubmit}
                    className="m3-btn m3-btn-primary"
                    style={{
                      height: '38px',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      backgroundColor: '#d97706',
                      borderColor: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px'
                    }}
                  >
                    <CalendarCheck size={16} />
                    <span>تسجيل حضور التعويض (C في الأصلي و M في الحالي) ⚡</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // MAIN MODAL / SCREEN CONTAINER CONTENT
  // ==========================================
  const modalContent = (
    <div
      className={isScreen ? 'scanner-screen-card' : 'm3-dialog'}
      onClick={isScreen ? undefined : (e) => e.stopPropagation()}
      style={
        isScreen
          ? {
              width: '100%',
              maxWidth: '1480px',
              margin: '0 auto',
              padding: '18px 22px',
              backgroundColor: 'var(--md-sys-color-surface)',
              borderRadius: 'var(--md-shape-xl)',
              boxShadow: 'var(--md-elevation-1)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              boxSizing: 'border-box'
            }
          : {
              maxWidth: '800px',
              maxHeight: '90vh',
              width: '95%',
              padding: '12px 16px',
              backgroundColor: 'var(--md-sys-color-surface)',
              borderRadius: 'var(--md-shape-lg)',
              boxShadow: 'var(--md-elevation-4)',
              position: 'relative',
              overflowY: 'auto'
            }
      }
    >
      {/* Page Header */}
      {isScreen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--md-shape-md)',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Scan size={22} />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                محطة مسح الباركود وإدارة العمليات المباشرة
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0'
                  }}
                >
                  ● المسح مستمر دون توقف في الخلفية ⚡
                </span>
              </h1>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '0.82rem',
                  color: 'var(--md-sys-color-on-surface-variant)'
                }}
              >
                اليمين: مسح بطاقات التلاميذ بدون توقف • اليسار: استقبال إشعارات التعويض وقائمة غير المسددين
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <span>← العودة للوحة التحكم</span>
          </Link>
        </div>
      )}

      {/* SPLIT SCREEN LAYOUT: Right is Codebar Section, Left is Operations Panel */}
      {isScreen ? (
        <div className="scanner-split-grid">
          {/* RIGHT COLUMN (Child 1 in RTL = Right side): Codebar Section */}
          <div className="codebar-column">{renderCodebarSection()}</div>

          {/* LEFT COLUMN (Child 2 in RTL = Left side): Operations Panel */}
          <div className="operations-column">{renderOperationsPanel()}</div>
        </div>
      ) : (
        <div>{renderCodebarSection()}</div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD COVERING GROUP FOR TODAY MODAL                                */}
      {/* ========================================================================= */}
      {showAddCoverGroupModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 180
          }}
          onClick={() => setShowAddCoverGroupModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '22px',
              borderRadius: 'var(--md-shape-xl)',
              maxWidth: '460px',
              width: '92%',
              boxShadow: 'var(--md-elevation-4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', marginBottom: '10px' }}>
              <Sparkles size={22} color="#f59e0b" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0 }}>
                إضافة فوج تعويض لهذا اليوم 🔄
              </h3>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, marginBottom: '14px' }}>
              اختر الفوج الذي يقدم حصة تعويض اليوم. سيظهر الفوج فوراً بوسم مميز في محطة المسح لتسجيل حضور التلاميذ مباشرة.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '3px' }}>
                  الفوج:
                </label>
                <select
                  value={newCoverGroupId}
                  onChange={(e) => setNewCoverGroupId(e.target.value)}
                  className="m3-input"
                  style={{ width: '100%', height: '36px', fontSize: '0.84rem', fontWeight: 800 }}
                >
                  {data.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      فوج {g.id} ({g.subject} - الأستاذ: {g.teacherName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '3px' }}>
                  الحصة المعوضة:
                </label>
                <select
                  value={newCoverGroupSessionIdx}
                  onChange={(e) => setNewCoverGroupSessionIdx(Number(e.target.value))}
                  className="m3-input"
                  style={{ width: '100%', height: '36px', fontSize: '0.84rem', fontWeight: 800 }}
                >
                  {Array.from({ length: data.groupData[newCoverGroupId]?.sessionCount || 4 }).map((_, i) => (
                    <option key={i} value={i}>
                      الحصة {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAddCoverGroupModal(false)}
                className="m3-btn m3-btn-text"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmAddCoverGroup}
                className="m3-btn m3-btn-primary"
                style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', fontWeight: 800 }}
              >
                تفعيل كفوج تعويض اليوم ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM COVER OR MOVE FOR SCANNER REQUEST                          */}
      {/* ========================================================================= */}
      {confirmActionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 250
          }}
          onClick={() => setConfirmActionModal(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: 'var(--md-shape-xl)',
              maxWidth: '480px',
              width: '92%',
              boxShadow: 'var(--md-elevation-5)',
              direction: 'rtl',
              border: confirmActionModal.type === 'cover' ? '2px solid #f59e0b' : '2px solid #6366f1'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {confirmActionModal.type === 'cover' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', marginBottom: '12px' }}>
                  <Sparkles size={22} color="#f59e0b" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0 }}>
                    تأكيد تسجيل حصة تعويض 🔄
                  </h3>
                </div>

                <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
                  هل تريد تسجيل حصة تعويض للتلميذ <strong style={{ color: '#b45309' }}>{confirmActionModal.req.student.name}</strong>؟
                  <div style={{ marginTop: '10px', backgroundColor: '#fffbeb', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.82rem', color: '#78350f' }}>
                    <div>• <strong>الفوج الأصلي:</strong> فوج {confirmActionModal.req.homeGroupId} (تُحتسب الحصة كتعويض <strong>C</strong> للأستاذ والمؤسسة)</div>
                    <div style={{ marginTop: '4px' }}>• <strong>فوج التعويض اليوم:</strong> فوج {confirmActionModal.req.targetActiveGroupId} (يُسجل كحاضر بالتعويض <strong>M</strong>)</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmActionModal(null)}
                    className="m3-btn m3-btn-text"
                    style={{ fontSize: '0.84rem' }}
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAcceptTemporaryCover(confirmActionModal.req);
                      setConfirmActionModal(null);
                    }}
                    className="m3-btn m3-btn-primary"
                    style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', fontWeight: 800, fontSize: '0.84rem' }}
                  >
                    تأكيد التعويض ✓
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4338ca', marginBottom: '12px' }}>
                  <ArrowLeftRight size={22} color="#4f46e5" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0 }}>
                    تأكيد النقل النهائي للتلميذ 🔀
                  </h3>
                </div>

                <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: '16px' }}>
                  هل تريد تحويل التلميذ <strong style={{ color: '#4338ca' }}>{confirmActionModal.req.student.name}</strong> بشكل نهائي؟
                  <div style={{ marginTop: '10px', backgroundColor: '#eef2ff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #c7d2fe', fontSize: '0.82rem', color: '#3730a3' }}>
                    <div>• سيتم نقله دائماً من <strong>فوج {confirmActionModal.req.homeGroupId}</strong> إلى <strong>فوج {confirmActionModal.req.targetActiveGroupId}</strong>.</div>
                    <div style={{ marginTop: '4px' }}>• يُسجل كحاضر رسمي (<strong>P</strong>) في حصة اليوم.</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmActionModal(null)}
                    className="m3-btn m3-btn-text"
                    style={{ fontSize: '0.84rem' }}
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAcceptPermanentTransfer(confirmActionModal.req);
                      setConfirmActionModal(null);
                    }}
                    className="m3-btn m3-btn-primary"
                    style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5', fontWeight: 800, fontSize: '0.84rem' }}
                  >
                    تأكيد النقل النهائي ✓
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: END SESSION CONFIRMATION MODAL                                    */}
      {/* ========================================================================= */}
      {showEndSessionConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 190
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                تأكيد إنهاء الحصة وتسجيل الغياب التلقائي
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.6, marginBottom: '16px' }}>
              {endSessionTarget === 'ALL' ? (
                <>
                  أنت على وشك إنهاء الحصص لجميع الأفواج النشطة حالياً:{' '}
                  <strong>({activeGroups.map((g) => g.groupId).join(' ، ')})</strong>.
                  <br />
                  سيقوم النظام بتسجيل جميع التلاميذ الذين لم يحضروا كـ{' '}
                  <strong style={{ color: '#b91c1c' }}>غائب (A)</strong> تلقائياً.
                </>
              ) : (
                <>
                  أنت على وشك إنهاء <strong>الحصة {(endSessionTarget?.sessionIndex ?? activeSessionIdx) + 1}</strong> لفوج{' '}
                  <strong>{endSessionTarget?.groupId || activeGroupId}</strong>.
                  <br />
                  سيقوم النظام بالبحث عن التلاميذ الذين لم يمسحوا بطاقاتهم، وتسجيلهم كـ{' '}
                  <strong style={{ color: '#b91c1c' }}>غائب (A)</strong> تلقائياً.
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

      {/* ========================================================================= */}
      {/* MODAL 3: END SESSION STATS SUMMARY TOAST                                  */}
      {/* ========================================================================= */}
      {endSessionStats && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '2px solid #a7f3d0',
            borderRadius: 'var(--md-shape-lg)',
            padding: '14px',
            textAlign: 'center',
            marginTop: '12px'
          }}
        >
          <CheckCircle2 size={28} color="#059669" style={{ margin: '0 auto 4px' }} />
          <h4 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#065f46', margin: '0 0 4px' }}>
            تم إنهاء {endSessionStats.groupLabel ? `حصة ${endSessionStats.groupLabel}` : 'الحصة'} بنجاح وحساب الغياب التلقائي!
          </h4>
          <div style={{ fontSize: '0.84rem', color: '#047857' }}>
            تم تسجيل: <strong>{endSessionStats.presentCount} حاضر</strong> •{' '}
            <strong>{endSessionStats.makeupCount} تعويض</strong> •{' '}
            <strong style={{ color: '#b91c1c' }}>{endSessionStats.absentCount} غائب</strong>
          </div>
          <button
            onClick={() => setEndSessionStats(null)}
            className="m3-btn m3-btn-sm m3-btn-outlined"
            style={{ marginTop: '8px', fontSize: '0.74rem' }}
          >
            إغلاق
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MULTI ACTIVE CANDIDATE RESOLUTION                                */}
      {/* ========================================================================= */}
      {multiActiveCandidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 195
          }}
          onClick={() => setMultiActiveCandidate(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: 'var(--md-shape-xl)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: 'var(--md-elevation-4)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px'
              }}
            >
              <Layers size={24} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '6px', color: 'var(--md-sys-color-on-surface)' }}>
              تحديد الفوج المطلوب للتلميذ
            </h3>

            <p style={{ fontSize: '0.86rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '14px' }}>
              التلميذ <strong style={{ color: 'var(--md-sys-color-primary)' }}>{multiActiveCandidate.student.name}</strong> مسجل في أكثر من فوج نشط في نفس الوقت.
              <br />
              اختر الفوج الذي يحضره الآن:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {multiActiveCandidate.matchingActiveGroups.map((ag) => {
                const gSheet = data.groupData[ag.groupId];
                return (
                  <button
                    key={ag.groupId}
                    type="button"
                    onClick={() => {
                      const targetStudent =
                        gSheet?.students?.find(
                          (s) =>
                            !isSummaryRow(s, ag.groupId) &&
                            ((multiActiveCandidate.result.student.barcode &&
                              s.barcode &&
                              s.barcode.toUpperCase() === multiActiveCandidate.result.student.barcode.toUpperCase()) ||
                              normalizeArabicName(s.name) === normalizeArabicName(multiActiveCandidate.result.student.name))
                        ) || multiActiveCandidate.result.student;

                      setMultiActiveCandidate(null);
                      proceedToPaymentCheck(targetStudent, ag.groupId, ag.sessionIndex, false);
                    }}
                    className="m3-btn"
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      color: 'var(--md-sys-color-on-surface)',
                      border: '2px solid var(--md-sys-color-primary)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--md-sys-color-primary)', fontWeight: 900 }}>
                        فوج {ag.groupId} ({gSheet?.subject || ''})
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
                        الأستاذ: {gSheet?.teacherName || '—'} • الحصة {ag.sessionIndex + 1}
                      </div>
                    </div>
                    <span
                      style={{
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem'
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

      {/* ========================================================================= */}
      {/* MODAL 5: PRINT QUEUE MODAL                                                */}
      {/* ========================================================================= */}
      {showQueueModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 195
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
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
                طابور الطباعة فارغ حالياً.
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
                    <span>طباعة جميع الوصلات المؤجلة ({printQueue.length})</span>
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
  );

  if (isScreen) {
    return (
      <div className="scanner-screen-page" style={{ width: '100%', paddingBottom: '32px' }}>
        {modalContent}
      </div>
    );
  }

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 110 }}>
      {modalContent}
    </div>
  );
}
