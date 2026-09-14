export type AttendanceStatus = 'P' | 'A' | 'M' | 'S' | '';

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
  totalAttendance: number; // Count of attended sessions
}

export interface GroupSheet {
  groupId: string;
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
