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
  PricingTier
} from '../types';
import {
  isSummaryRow,
  formatToYYYYMMDD,
  generateSessionDates,
  isVipGroupId,
  isValidGroupId,
  getNextGroupId,
  getStudentSessionInfo
} from '../utils/sessionUtils';

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
  // Student Actions
  updateAttendance: (groupId: string, rowId: number, sessionIndex: number, status: AttendanceStatus) => void;
  markAllPresent: (groupId: string, sessionIndex: number, studentRowIds?: number[]) => void;
  updatePayment: (groupId: string, rowId: number, paymentIndex: number, amount: number | string) => void;
  updateStudentFullFinances: (groupId: string, rowId: number, payments: (number | string)[], discount?: DiscountType) => void;
  batchUpdateSessionPayments: (groupId: string, sessionIndex: number, studentPayments: { rowId: number; amount: number | string }[]) => void;
  updateDiscount: (groupId: string, rowId: number, discount: DiscountType) => void;
  addStudent: (groupId: string, student: { name: string; phone: string; discount?: DiscountType }) => void;
  enrollStudentMultiGroups: (
    studentInfo: { name: string; phone: string; discount?: DiscountType },
    enrollments: { groupId: string; paymentAmount: number | string }[]
  ) => { groupId: string; rowId: number; fee: number; paid: number; debt: number }[];
  deleteStudent: (groupId: string, rowId: number) => void;
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
  getCenterStats: () => {
    totalStudents: number;
    totalGroups: number;
    totalTeachers: number;
    totalExpected: number;
    totalReceived: number;
    totalTeacherPay: number;
    totalSchoolEarn: number;
    totalDebt: number;
  };
}

const STORAGE_KEY = 'da3m_center_management_data_v1';
const THEME_KEY = 'da3m_theme';
const LANG_KEY = 'da3m_lang';

const AppContext = createContext<AppContextType | undefined>(undefined);

const sanitizeData = (centerData: CenterData): { cleaned: CenterData; changed: boolean } => {
  let changed = false;
  const newGroupData: Record<string, GroupSheet> = {};
  const idMap: Record<string, string> = {};

  for (const [gid, gSheet] of Object.entries(centerData.groupData || {})) {
    const originalStudents = gSheet.students || [];
    const cleanStudents = originalStudents.filter((s) => !isSummaryRow(s, gid));
    if (cleanStudents.length !== originalStudents.length) {
      changed = true;
    }

    // Ensure group ID follows strict BAC{XX} / BACV{XX} format without hyphens or suffixes like BAC01-2
    let finalGid = gid.trim().toUpperCase();
    if (finalGid === 'BACV06' || gid.trim().toUpperCase() === 'BACV06') {
      finalGid = 'BACV10';
      idMap[gid] = 'BACV10';
      idMap['BACV06'] = 'BACV10';
      changed = true;
    } else if (finalGid.includes('-') || finalGid.includes('_') || !isValidGroupId(finalGid).isValid) {
      const isVip = gSheet.isVip || /^BACV/i.test(finalGid);
      const existingIds = [...Object.keys(newGroupData), ...(centerData.groups || []).map((g) => g.id)];
      finalGid = getNextGroupId(isVip, existingIds);
      idMap[gid] = finalGid;
      changed = true;
    }

    // Normalize sessionDates to YYYY/MM/DD
    const currentDates = gSheet.sessionDates || [];
    const sessionCount = currentDates.length > 0 ? currentDates.length : (gSheet.sessionCount || 4);
    const hasPlaceholders =
      currentDates.length === 0 ||
      currentDates.some((d) => !d || /^\d{1,2}$/.test(d.trim()) || d.includes('حصة') || !d.trim());

    let normalizedDates: string[];
    if (hasPlaceholders) {
      const allPlaceholders =
        currentDates.length === 0 ||
        currentDates.every((d) => !d || /^\d{1,2}$/.test(d.trim()) || d.includes('حصة') || !d.trim());

      if (allPlaceholders) {
        normalizedDates = generateSessionDates(gSheet.day1 || 'السبت', sessionCount);
      } else {
        const firstValid = currentDates.find(
          (d) => /^\d{4}[./\-]\d{1,2}[./\-]\d{1,2}/.test(d) || /^\d{1,2}[./\-]\d{1,2}[./\-]\d{4}/.test(d)
        );
        normalizedDates = generateSessionDates(
          gSheet.day1 || 'السبت',
          sessionCount,
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

    let finalStudents = cleanStudents;
    const seedGroup = (initialSeedData.groupData as Record<string, GroupSheet>)?.[finalGid];
    if (cleanStudents.length === 0 && seedGroup && seedGroup.students && seedGroup.students.length > 0) {
      finalStudents = seedGroup.students;
      if (seedGroup.sessionDates && seedGroup.sessionDates.length > 0) {
        normalizedDates = seedGroup.sessionDates;
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
      sessionDates: normalizedDates,
      status: finalStatus,
      students: finalStudents
    };
  }

  for (const [seedGid, seedSheet] of Object.entries((initialSeedData.groupData as Record<string, GroupSheet>) || {})) {
    if (!newGroupData[seedGid] && seedSheet.students && seedSheet.students.length > 0) {
      newGroupData[seedGid] = seedSheet;
      changed = true;
    }
  }

  // Deduplicate and sanitize groups array
  // Rule: It's normal to have BAC01 and BACV01, but never two BAC01 or two BACV01!
  const seenIds = new Set<string>();
  const cleanGroups: GroupMeta[] = [];
  for (const g of centerData.groups || []) {
    let cleanId = (idMap[g.id] || g.id).trim().toUpperCase();
    if (cleanId === 'BACV06') {
      cleanId = 'BACV10';
      changed = true;
    }
    if (cleanId.includes('-') || cleanId.includes('_') || !isValidGroupId(cleanId).isValid) {
      cleanId = getNextGroupId(g.isVip || cleanId.startsWith('BACV'), cleanGroups);
      changed = true;
    }
    let cleanStatus = g.status;
    if (cleanStatus === 'active') {
      cleanStatus = undefined;
      changed = true;
    }

    if (!seenIds.has(cleanId)) {
      seenIds.add(cleanId);
      cleanGroups.push({ ...g, id: cleanId, status: cleanStatus });
    } else {
      // Duplicate ID detected (e.g. duplicate BAC01) - assign next ascending ID!
      const uniqueId = getNextGroupId(g.isVip || cleanId.startsWith('BACV'), cleanGroups);
      seenIds.add(uniqueId);
      cleanGroups.push({ ...g, id: uniqueId, status: cleanStatus });
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

  return {
    cleaned: {
      ...centerData,
      groups: cleanGroups,
      groupData: newGroupData
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
  const [selectedGroup, setSelectedGroup] = useState<string>('BAC01');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const cloudSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);

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

  // Cloud save to Supabase
  const saveToCloud = useCallback(async (newData: CenterData) => {
    try {
      setCloudSyncStatus('syncing');
      isSavingRef.current = true;
      const { error } = await supabase
        .from('center_data')
        .upsert({
          id: 'main',
          data: newData,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase cloud sync error:', error);
        setCloudSyncStatus('error');
      } else {
        setCloudSyncStatus('synced');
        setLastSyncedAt(new Date());
        // Sync relational tables in background so Table Editor always shows live rows
        syncRelationalTables(newData).catch((e) => console.warn(e));
      }
    } catch (err) {
      console.error('Failed to sync to Supabase:', err);
      setCloudSyncStatus('offline');
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
      }, 500);
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
          setData(cleaned);
          if (changed) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
        }
      } else {
        const { cleaned } = sanitizeData(initialSeedData as unknown as CenterData);
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
          const { cleaned } = sanitizeData(remoteRow.data as CenterData);
          setData(cleaned);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
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
          if (isSavingRef.current) return; // Don't overwrite local changes with our own echo
          if (payload.new && (payload.new as any).data) {
            const incoming = (payload.new as any).data as CenterData;
            const { cleaned } = sanitizeData(incoming);
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

    return () => {
      isMounted = false;
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [saveToCloud]);

  // Save changes locally and debounce sync to Supabase
  const persistData = (newData: CenterData) => {
    setData(newData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error('Failed to persist data:', e);
    }

    // Debounced cloud sync (500ms)
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }
    setCloudSyncStatus('syncing');
    cloudSyncTimerRef.current = setTimeout(() => {
      saveToCloud(newData);
    }, 500);
  };

  // Manual one-click sync
  const syncNow = async () => {
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }
    await saveToCloud(data);
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
    groupFinances?: { studentFee?: number; teacherPayPerStudent?: number; schoolSharePerStudent?: number; sessionCount?: number }
  ): StudentRecord => {
    const tier = pricingTiers.find((t) => t.id === groupType) || {
      price: groupType.includes('10000') ? 10000 : 2500,
      teacherRate: groupType.includes('10000') ? 7500 : 1500,
      schoolRate: groupType.includes('10000') ? 2500 : 1000,
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

    // Calculate session info: empty before first attendance = red (not counted), empty after = yellow (counted)
    const sessionInfo = getStudentSessionInfo(student.attendance, cycleSessions);
    const countedSessions = sessionInfo.countedSessions;

    // Attendance counts
    const cycleAttendance = (student.attendance || []).slice(0, cycleSessions);
    const attendedCount = cycleAttendance.filter((a) => a === 'P').length;
    const makeupCount = cycleAttendance.filter((a) => a === 'M').length;
    const totalAttendance = attendedCount + makeupCount;

    // Fee calculation based on discount and counted sessions
    let fee = 0;
    let teacherPay = 0;
    let schoolEarn = 0;

    if (student.discount === '0') {
      fee = 0;
      teacherPay = 0;
      schoolEarn = 0;
    } else if (student.discount === '0.8') {
      fee = Math.round(countedSessions * perSessionPrice * 0.8);
      teacherPay = attendedCount * perSessionTeacherRate;
      schoolEarn = Math.max(0, fee - teacherPay);
    } else if (student.discount === 'تعويض') {
      const count = makeupCount > 0 ? makeupCount : (attendedCount > 0 ? attendedCount : 1);
      fee = count * perSessionPrice;
      teacherPay = count * perSessionTeacherRate;
      schoolEarn = Math.max(0, fee - teacherPay);
    } else {
      fee = countedSessions * perSessionPrice;
      teacherPay = attendedCount * perSessionTeacherRate;
      schoolEarn = Math.max(0, fee - teacherPay);
    }

    // Sum up payments
    const totalReceived = (student.payments || []).reduce<number>((sum, p) => {
      const val = typeof p === 'number' ? p : parseFloat(String(p));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const debt = fee - totalReceived;

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

  // Update attendance
  const updateAttendance = (groupId: string, rowId: number, sessionIndex: number, status: AttendanceStatus) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      const newAttendance = [...student.attendance];
      newAttendance[sessionIndex] = status;
      return calculateStudentFinances(
        { ...student, attendance: newAttendance },
        group.type,
        data.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Mark all students present for a session in a single batch operation
  const markAllPresent = (groupId: string, sessionIndex: number, studentRowIds?: number[]) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const rowIdSet = studentRowIds && studentRowIds.length > 0 ? new Set(studentRowIds) : null;
    const targetStudents = group.students.filter(
      (s) => !isSummaryRow(s, groupId) && (!rowIdSet || rowIdSet.has(s.rowId))
    );

    // Check if all target students are already 'P'. If so, toggle to clear ('')
    const allAlreadyPresent =
      targetStudents.length > 0 && targetStudents.every((s) => s.attendance[sessionIndex] === 'P');
    const targetStatus: AttendanceStatus = allAlreadyPresent ? '' : 'P';

    const updatedStudents = group.students.map((student) => {
      if (isSummaryRow(student, groupId)) return student;
      if (rowIdSet && !rowIdSet.has(student.rowId)) return student;

      const newAttendance = [...student.attendance];
      const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
      while (newAttendance.length < sessionCount) newAttendance.push('');
      newAttendance[sessionIndex] = targetStatus;

      return calculateStudentFinances(
        { ...student, attendance: newAttendance },
        group.type,
        data.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Update payment installment
  const updatePayment = (groupId: string, rowId: number, paymentIndex: number, amount: number | string) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
      const newPayments = [...(student.payments || [])];
      while (newPayments.length < sessionCount) newPayments.push('');
      newPayments[paymentIndex] = amount === '' ? '' : Number(amount) || 0;
      return calculateStudentFinances(
        { ...student, payments: newPayments },
        group.type,
        data.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Atomically update student payments and discount
  const updateStudentFullFinances = (
    groupId: string,
    rowId: number,
    payments: (number | string)[],
    discount?: DiscountType
  ) => {
    setData((prevData) => {
      const group = prevData.groupData[groupId];
      if (!group) return prevData;

      const updatedStudents = group.students.map((student) => {
        if (student.rowId !== rowId) return student;
        const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
        const newPayments = payments.map((p) => (p === '' ? '' : Number(p) || 0));
        while (newPayments.length < sessionCount) newPayments.push('');
        const updated = {
          ...student,
          payments: newPayments,
          ...(discount !== undefined ? { discount } : {})
        };
        return calculateStudentFinances(updated, group.type, prevData.pricingTiers, group);
      });

      const updatedData: CenterData = {
        ...prevData,
        groupData: {
          ...prevData.groupData,
          [groupId]: { ...group, students: updatedStudents }
        }
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
      } catch (e) {
        console.error('Failed to persist student finances:', e);
      }
      return updatedData;
    });
  };

  // Batch update payments for multiple students for a specific session/day
  const batchUpdateSessionPayments = (
    groupId: string,
    sessionIndex: number,
    studentPayments: { rowId: number; amount: number | string }[]
  ) => {
    setData((prevData) => {
      const group = prevData.groupData[groupId];
      if (!group) return prevData;

      const paymentMap = new Map<number, number | string>();
      studentPayments.forEach((sp) => paymentMap.set(sp.rowId, sp.amount));

      const updatedStudents = group.students.map((student) => {
        if (!paymentMap.has(student.rowId)) return student;
        const val = paymentMap.get(student.rowId);
        const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
        const newPayments = [...(student.payments || [])];
        while (newPayments.length < sessionCount) newPayments.push('');
        newPayments[sessionIndex] = val === '' ? '' : Number(val) || 0;
        return calculateStudentFinances(
          { ...student, payments: newPayments },
          group.type,
          prevData.pricingTiers,
          group
        );
      });

      const updatedData: CenterData = {
        ...prevData,
        groupData: {
          ...prevData.groupData,
          [groupId]: { ...group, students: updatedStudents }
        }
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
      } catch (e) {
        console.error('Failed to persist batch payments:', e);
      }
      return updatedData;
    });
  };

  // Update discount
  const updateDiscount = (groupId: string, rowId: number, discount: DiscountType) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      return calculateStudentFinances(
        { ...student, discount },
        group.type,
        data.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Add new student
  const addStudent = (groupId: string, studentInfo: { name: string; phone: string; discount?: DiscountType }) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
    const maxRowId = group.students.reduce((max, s) => Math.max(max, s.rowId || 0), 0);
    const newStudentRaw: StudentRecord = {
      rowId: maxRowId + 1,
      name: studentInfo.name,
      phone: studentInfo.phone || '',
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

    const calculatedStudent = calculateStudentFinances(newStudentRaw, group.type, data.pricingTiers, group);

    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
        [groupId]: {
          ...group,
          students: [...group.students, calculatedStudent]
        }
      }
    };
    persistData(updatedData);
  };

  // Enroll student in multiple groups with immediate payments
  const enrollStudentMultiGroups = (
    studentInfo: { name: string; phone: string; discount?: DiscountType },
    enrollments: { groupId: string; paymentAmount: number | string }[]
  ): { groupId: string; rowId: number; fee: number; paid: number; debt: number }[] => {
    const updatedGroupData = { ...data.groupData };
    const results: { groupId: string; rowId: number; fee: number; paid: number; debt: number }[] = [];

    enrollments.forEach(({ groupId, paymentAmount }) => {
      const group = updatedGroupData[groupId];
      if (!group) return;

      const sessionCount = group.sessionDates?.length || group.sessionCount || 8;
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

      const calculatedStudent = calculateStudentFinances(newStudentRaw, group.type, data.pricingTiers, group);

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
    });

    persistData({
      ...data,
      groupData: updatedGroupData
    });

    return results;
  };

  // Delete student
  const deleteStudent = (groupId: string, rowId: number) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.filter((s) => s.rowId !== rowId);
    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
        [groupId]: { ...group, students: updatedStudents }
      }
    };
    persistData(updatedData);
  };

  // Update student arbitrary fields
  const updateStudent = (groupId: string, rowId: number, fields: Partial<StudentRecord>) => {
    const group = data.groupData[groupId];
    if (!group) return;

    const updatedStudents = group.students.map((student) => {
      if (student.rowId !== rowId) return student;
      return calculateStudentFinances(
        { ...student, ...fields },
        group.type,
        data.pricingTiers,
        group
      );
    });

    const updatedData: CenterData = {
      ...data,
      groupData: {
        ...data.groupData,
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
    const sessionDates = generateSessionDates(groupMeta.day1 || 'السبت', sessionCount);

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
      groups: [...data.groups, { ...groupMeta, id: cleanId, sessionCount }],
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
    const todayStr = formatToYYYYMMDD(new Date());
    const sessionDates = generateSessionDates(
      customGroupFields?.day1 || sourceGroup.day1 || 'السبت',
      sessionCount,
      todayStr
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

    realStudents.forEach((s) => {
      totalExpected += s.fee || 0;
      totalReceived += s.totalReceived || 0;
      totalTeacherPay += s.teacherPay || 0;
      totalSchoolEarn += s.schoolEarn || 0;
      totalDebt += s.debt && s.debt > 0 ? s.debt : 0;
      totalPresentSlots += (s.attendance || []).filter((a) => a === 'P' || a === 'M').length;

      const info = getStudentSessionInfo(s.attendance, cycleSessions);
      totalPossibleSlots += info.countedSessions > 0 ? info.countedSessions : cycleSessions;
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

  // Center Stats
  const getCenterStats = () => {
    let totalStudents = 0;
    let totalExpected = 0;
    let totalReceived = 0;
    let totalTeacherPay = 0;
    let totalSchoolEarn = 0;
    let totalDebt = 0;

    Object.entries(data.groupData).forEach(([gid, g]) => {
      const realStudents = (g.students || []).filter((s) => !isSummaryRow(s, gid));
      totalStudents += realStudents.length;
      realStudents.forEach((s) => {
        totalExpected += s.fee || 0;
        totalReceived += s.totalReceived || 0;
        totalTeacherPay += s.teacherPay || 0;
        totalSchoolEarn += s.schoolEarn || 0;
        totalDebt += s.debt || 0;
      });
    });

    return {
      totalStudents,
      totalGroups: data.groups.length,
      totalTeachers: data.teachers.length,
      totalExpected,
      totalReceived,
      totalTeacherPay,
      totalSchoolEarn,
      totalDebt
    };
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
        updateAttendance,
        markAllPresent,
        updatePayment,
        updateStudentFullFinances,
        batchUpdateSessionPayments,
        updateDiscount,
        addStudent,
        enrollStudentMultiGroups,
        deleteStudent,
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
        getCenterStats
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
