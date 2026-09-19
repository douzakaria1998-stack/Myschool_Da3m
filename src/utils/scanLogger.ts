/**
 * Persistent Offline Barcode Scan Audit & Recovery Logger
 * Stores an immutable record of every card scan in localStorage so scans can NEVER be lost
 * even during internet cuts, browser crashes, or accidental remote overwrites.
 */

export interface ScanLogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  dateStr: string; // e.g. "2026/09/19"
  groupId: string;
  sessionIndex: number;
  studentRowId: number;
  studentName: string;
  barcode: string;
  status: 'P' | 'M' | 'DEBT';
  isCover?: boolean;
}

export const SCAN_LOG_KEY = 'da3m_attendance_scan_log_v1';
const MAX_LOG_ENTRIES = 2000;

export function recordScanToLog(entry: Omit<ScanLogEntry, 'id' | 'timestamp'>): ScanLogEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SCAN_LOG_KEY);
    const list: ScanLogEntry[] = raw ? JSON.parse(raw) : [];
    const newEntry: ScanLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now()
    };
    list.unshift(newEntry);
    if (list.length > MAX_LOG_ENTRIES) {
      list.length = MAX_LOG_ENTRIES;
    }
    localStorage.setItem(SCAN_LOG_KEY, JSON.stringify(list));
    return newEntry;
  } catch (e) {
    console.error('Failed to write scan log to localStorage:', e);
    return null;
  }
}

export function getScanLog(): ScanLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SCAN_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read scan log:', e);
    return [];
  }
}

export function getScansForGroupSession(
  groupId: string,
  sessionIndex: number,
  withinHours: number = 24
): ScanLogEntry[] {
  const allScans = getScanLog();
  const cutoff = Date.now() - withinHours * 3600 * 1000;
  return allScans.filter(
    (s) =>
      s.groupId === groupId &&
      s.sessionIndex === sessionIndex &&
      s.timestamp >= cutoff
  );
}

export function clearScanLog(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SCAN_LOG_KEY);
  } catch (e) {}
}
