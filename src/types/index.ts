export type AttendanceStatus = 'P' | 'A' | 'M' | 'S' | 'C' | 'CH' | 'N' | 'ح' | 'غ' | 'م' | '';

export interface CoveringMatchResult {
  canCover: boolean;
  reason?: 'ALREADY_ATTENDED' | 'ALREADY_COVERED' | 'SESSION_NOT_FOUND' | 'NO_MATCHING_MISSED_SESSION';
  type?: 'ACTIVE_GROUP_MATCH' | 'LAST_GROUP_MATCH' | 'NEW_STUDENT';
  matchedGroup?: GroupSheet;
  matchedStudent?: StudentRecord;
  matchedSessionIdx?: number;
  message: string;
  isNewStudent?: boolean;
}

export type DiscountType = '1' | '0.8' | '0' | 'تعويض' | string;

export interface StudentRecord {
  rowId: number;
  name: string;
  phone: string;
  barcode?: string; // Barcode or card serial number
  attendance: AttendanceStatus[]; // dynamic N sessions
  discount: DiscountType; // '1' (100%), '0.8' (80%), '0' (0%), or 'تعويض'
  fee: number; // Total fee required (المجموع)
  payments: (number | string)[]; // dynamic N payment entries (المستلم 1..N)
  totalReceived: number; // Total collected (مجموع المستلم)
  teacherPay: number; // Teacher payout share (مجموع الأستاذ)
  schoolEarn: number; // Center share (المدرسة)
  debt: number; // Outstanding balance (الدين)
  credit?: number; // Available surplus credit/balance for student (رصيد فائض متبقي للتلميذ)
  totalAttendance: number; // Count of attended sessions
}

export type PaymentTransactionType =
  | 'PAYMENT'
  | 'SESSION_ALLOCATION'
  | 'CREDIT'
  | 'RECOVERY'
  | 'TRANSFER'
  | 'REFUND'
  | 'ADJUSTMENT';

export interface StudentRecoverySession {
  groupId: string;
  sessionIndex: number;
  subject: string;
  teacherName?: string;
  dateStr?: string;
  sessionNumber: number;
  status: 'A' | 'غ';
  isRecovered?: boolean;
  recoveredInGroupId?: string;
  recoveredInSessionIdx?: number;
}

export interface StudentAccountTransaction {
  id: string;
  timestamp: number;
  dateStr: string;
  timeStr: string;
  type: PaymentTransactionType;
  amount: number;
  description: string;
  groupId?: string;
  sessionIndex?: number;
  balanceAfter: number;
}

export interface StudentPaymentAccount {
  studentKey: string; // Barcode or normalized Arabic name
  studentName: string;
  phone?: string;
  barcode?: string;
  totalPaid: number;
  amountUsed: number;
  availableBalance: number; // Remaining credit
  countablePSessions: number;
  nonCountableSessions: number;
  recoverySessions: number;
  recoveryDetails: StudentRecoverySession[];
  currentGroups: string[];
  previousGroups: string[];
  transactions: StudentAccountTransaction[];
}

export type EducationalLevel = 'BAC' | 'SEC' | 'BEM';

export interface GroupSheet {
  groupId: string;
  level?: EducationalLevel; // 'BAC' (بكالوريا) | 'SEC' (ثانوي) | 'BEM' (الرابعة متوسط)
  teacherName: string;
  subject: string;
  day1: string;
  time1: string;
  day2?: string;
  time2?: string;
  sessionDates: string[]; // N session dates
  sessionCount?: number; // Total sessions in cycle
  status?: 'active' | 'inactive'; // Group status: 'active' or 'inactive' (reached last session)
  isVip: boolean;
  type: string; // '4-2500', '4-10000', etc.
  studentFee?: number; // Payment amount for each student (المبلغ المطلوب من كل تلميذ)
  teacherPayPerStudent?: number; // Teacher payout per student (حصة الأستاذ من كل تلميذ)
  schoolSharePerStudent?: number; // Rest of amount for the school (الباقي للمدرسة)
  students: StudentRecord[];
}

export interface TeacherPaymentRecord {
  id: string;
  date: string;
  time?: string;
  amount: number;
  paymentMethod: string; // 'نقداً' | 'صك بريدي' | 'تحويل بنكي' | 'أخرى'
  receiptNo: string;
  notes?: string;
  groupId?: string; // Optional: linked to a specific group
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  defaultGroupType?: string;
  phone?: string;
  paidAmount?: number; // Total amount paid to teacher (المبلغ المسدد للأستاذ)
  paymentHistory?: TeacherPaymentRecord[]; // Record of teacher payment vouchers
}

export interface GroupMeta {
  id: string;
  level?: EducationalLevel; // 'BAC' (بكالوريا) | 'SEC' (ثانوي) | 'BEM' (الرابعة متوسط)
  teacherId: string;
  teacherName: string;
  subject: string;
  day1: string;
  time1: string;
  day2?: string;
  time2?: string;
  type: string;
  isVip: boolean;
  status?: 'active' | 'inactive'; // Group status: 'active' or 'inactive' (reached last session)
  sessionCount?: number; // Total sessions in cycle (e.g. 4, 8, 10, 12)
  customStart?: string; // Starting session date (YYYY/MM/DD)
  sessionDates?: string[]; // Optional explicit session dates
  studentFee?: number; // Payment amount for each student (المبلغ المطلوب من كل تلميذ)
  teacherPayPerStudent?: number; // Teacher payout per student (حصة الأستاذ من كل تلميذ)
  schoolSharePerStudent?: number; // Rest of amount for the school (الباقي للمدرسة)
}

export interface PricingTier {
  id: string;
  name: string;
  sessions: number;
  price: number;
  teacherRate: number;
  schoolRate: number;
}

export interface CenterCredentials {
  userPass: string;
  adminPass: string;
}

export interface CenterData {
  centerName: string;
  academicYear: string;
  cycle: string;
  teachers: Teacher[];
  groups: GroupMeta[];
  groupData: Record<string, GroupSheet>;
  pricingTiers: PricingTier[];
  credentials: CenterCredentials;
  paymentTransactions?: any[];
  deletedStudents?: DeletedStudentArchiveItem[];
}

export interface DeletedStudentArchiveItem {
  id: string;
  deletedAt: number;
  deletedAtStr: string;
  groupId: string;
  groupSubject?: string;
  teacherName?: string;
  student: StudentRecord;
  reason?: string;
}

export interface QueuedReceipt {
  id: string;
  receiptNo: string;
  groupId: string;
  subject: string;
  teacherName: string;
  studentRowId: number;
  studentName: string;
  studentPhone?: string;
  amount: number;
  totalFee: number;
  totalPaid: number;
  balance: number;
  date: string;
  time: string;
  sessionIndex: number;
  isCover?: boolean;
  originalGroup?: string;
}

export interface CenterStatsFilter {
  periodType?: 'all' | 'today' | 'this_week' | 'this_month' | 'prev_month' | 'custom';
  startDate?: string;
  endDate?: string;
  groupType?: 'all' | 'regular' | 'vip';
  groupId?: string;
}

export interface CenterStatsResult {
  totalStudents: number;
  activeStudents?: number;
  activeGroups?: number;
  totalCenterStudents?: number;
  totalCenterGroups?: number;
  totalCenterActiveStudents?: number;
  totalCenterActiveGroups?: number;
  totalGroups: number;
  totalTeachers: number;
  totalExpected: number;
  totalReceived: number;
  totalTeacherPay: number;
  totalSchoolEarn: number;
  totalDebt: number;
  matchingSessionsCount?: number;
  periodLabel?: string;
}

