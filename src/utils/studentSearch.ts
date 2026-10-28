import { normalizeScannedBarcode } from './barcodeUtils';

/**
 * Shared relevance-based student search.
 *
 * Returns a score for each student (0 = no match) so lists can be filtered AND
 * sorted, putting exact / best matches at the top instead of leaving the
 * searched student buried at the bottom of the results.
 */

export interface StudentSearchQuery {
  raw: string;
  lower: string;
  normName: string;
  tokens: string[];
  normalizedScan: string;
  cleanDigits: string;
  isDigitQuery: boolean;
}

export interface StudentSearchFields {
  name: string;
  phone?: string;
  barcodes?: (string | undefined | null)[];
  rowIds?: (number | string | undefined | null)[];
  /** Secondary fields (group id, subject, teacher...) — lowest priority */
  extra?: (string | undefined | null)[];
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => ARABIC_INDIC.indexOf(d).toString());
}

/** Search-only Arabic normalization (more aggressive than the key normalizer) */
export function normalizeSearchText(text: string | undefined | null): string {
  if (!text) return '';
  return toLatinDigits(text)
    .toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '') // invisible / bidi chars
    .replace(/\u0640/g, '') // tatweel
    .replace(/[\u064B-\u065F\u0670]/g, '') // tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildStudentSearchQuery(raw: string): StudentSearchQuery | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const lower = toLatinDigits(trimmed.toLowerCase());
  const normName = normalizeSearchText(trimmed);
  const cleanDigits = lower.replace(/\D/g, '');
  return {
    raw: trimmed,
    lower,
    normName,
    tokens: normName.split(' ').filter(Boolean),
    normalizedScan: normalizeScannedBarcode(trimmed).trim().toLowerCase(),
    cleanDigits,
    isDigitQuery: cleanDigits.length > 0 && /^[\d\s+\-()]+$/.test(lower)
  };
}

function scoreName(q: StudentSearchQuery, name: string): number {
  const n = normalizeSearchText(name);
  if (!n || !q.normName) return 0;
  if (n === q.normName) return 900;
  if (n.startsWith(q.normName)) return 800;

  const words = n.split(' ');
  if (q.tokens.length > 1) {
    // Every typed word is the start of some word in the name (any order)
    if (q.tokens.every((t) => words.some((w) => w.startsWith(t)))) return 700;
  } else if (words.some((w) => w.startsWith(q.normName))) {
    return 720;
  }

  if (n.includes(q.normName)) return 600;
  // Same name typed without spaces (e.g. "عبدالله" vs "عبد الله")
  const compactQ = q.normName.replace(/ /g, '');
  if (compactQ.length >= 3 && n.replace(/ /g, '').includes(compactQ)) return 560;
  if (q.tokens.length > 1 && q.tokens.every((t) => n.includes(t))) return 500;
  return 0;
}

function scorePhone(q: StudentSearchQuery, phone?: string): number {
  if (!phone || !q.cleanDigits) return 0;
  const p = toLatinDigits(phone).replace(/\D/g, '');
  if (!p) return 0;
  const d = q.cleanDigits;
  const stripLeading = (s: string) => s.replace(/^(?:00213|213|0)/, '');
  if (p === d || stripLeading(p) === stripLeading(d)) return 950;
  if (d.length >= 3 && (p.startsWith(d) || stripLeading(p).startsWith(stripLeading(d)))) return 450;
  if (d.length >= 4 && p.includes(d)) return 400;
  return 0;
}

function scoreBarcode(q: StudentSearchQuery, barcode: string): number {
  const b = barcode.trim().toLowerCase();
  if (!b) return 0;
  if (b === q.lower || (q.normalizedScan && b === q.normalizedScan)) return 1000;
  const bDigits = b.replace(/\D/g, '');
  if (q.isDigitQuery && q.cleanDigits.length >= 6 && bDigits === q.cleanDigits) return 980;
  if (q.lower.length >= 2 && b.includes(q.lower)) return 420;
  if (q.normalizedScan.length >= 2 && b.includes(q.normalizedScan)) return 420;
  if (q.isDigitQuery && q.cleanDigits.length >= 2 && bDigits.includes(q.cleanDigits)) return 350;
  return 0;
}

/**
 * Returns a relevance score for a student against the query (0 = not a match).
 */
export function scoreStudentMatch(q: StudentSearchQuery, fields: StudentSearchFields): number {
  let best = scoreName(q, fields.name);

  best = Math.max(best, scorePhone(q, fields.phone));

  for (const b of fields.barcodes || []) {
    if (b) best = Math.max(best, scoreBarcode(q, b));
  }

  if (q.isDigitQuery && q.cleanDigits) {
    for (const id of fields.rowIds || []) {
      if (id !== undefined && id !== null && String(id) === q.cleanDigits) {
        best = Math.max(best, 300);
      }
    }
  }

  if (best === 0 && q.normName.length >= 2) {
    for (const e of fields.extra || []) {
      const ne = normalizeSearchText(e);
      if (!ne) continue;
      if (ne === q.normName) {
        best = Math.max(best, 200);
      } else if (ne.includes(q.normName)) {
        best = Math.max(best, 100);
      }
    }
  }

  return best;
}

/**
 * Filters and sorts a list by relevance. Ties keep their original order.
 */
export function rankStudents<T>(
  items: T[],
  rawQuery: string,
  getFields: (item: T) => StudentSearchFields
): T[] {
  const q = buildStudentSearchQuery(rawQuery);
  if (!q) return items;
  const scored: { item: T; score: number; idx: number }[] = [];
  items.forEach((item, idx) => {
    const score = scoreStudentMatch(q, getFields(item));
    if (score > 0) scored.push({ item, score, idx });
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.item);
}
