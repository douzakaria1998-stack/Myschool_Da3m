/**
 * Print Title & Filename Utilities
 * Ensures dynamic, clean, unique filenames when users save prints as PDF in Chrome/Edge/Firefox.
 */

const ARABIC_MONTHS = [
  'جانفي',
  'فيفري',
  'مارس',
  'أفريل',
  'ماي',
  'جوان',
  'جويلية',
  'أوت',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر'
];

/**
 * Remove illegal characters in Windows/macOS/Linux filenames (/ \ : * ? " < > |)
 * and normalize whitespace.
 */
export function sanitizePrintTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '')
    .trim();
}

/**
 * Extract Arabic month and year from a date string (e.g., '17/09/2026' or '2026-09-17') or Date object.
 * Returns e.g. 'سبتمبر 2026'.
 */
export function getArabicMonthYear(dateVal?: string | Date): string {
  try {
    let d = new Date();
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'string' && dateVal.trim()) {
      const parts = dateVal.trim().split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          // DD/MM/YYYY
          d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      } else {
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) {
          d = parsed;
        }
      }
    }

    const monthIndex = d.getMonth();
    const monthName = ARABIC_MONTHS[monthIndex] || '';
    const year = d.getFullYear();
    return `${monthName} ${year}`.trim();
  } catch {
    return new Date().toISOString().slice(0, 7);
  }
}

/**
 * Temporarily updates the top-level document.title so that the browser's "Save as PDF"
 * dialog defaults to the requested unique filename, then safely restores the previous title.
 */
export function triggerPrintWithDocumentTitle(title: string, printAction: () => void) {
  if (typeof window === 'undefined') return;

  const cleanTitle = sanitizePrintTitle(title);
  const originalTitle = document.title;

  if (cleanTitle) {
    document.title = cleanTitle;
  }

  let restored = false;
  const restore = () => {
    if (!restored) {
      restored = true;
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
    }
  };

  window.addEventListener('afterprint', restore);

  try {
    printAction();
  } finally {
    // Fallback in case afterprint event does not fire (e.g. print dialog cancelled or closed quickly)
    setTimeout(restore, 4000);
  }
}
