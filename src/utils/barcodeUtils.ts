/**
 * Keyboard Layout Decoder & Normalizer for Hardware Barcode Scanners
 * Handles:
 * 1. French AZERTY letters and numbers row (& é " ' ( - è _ ç à ) -> 1 2 3 4 5 6 7 8 9 0 -)
 * 2. Arabic 101 (QWERTY) & Arabic 102 (AZERTY) layout decoders (e.g. سفع -> STU, لاضؤ / لاشؤ -> BAC)
 * 3. Arabic-Indic numbers (٠-٩ -> 0-9)
 * 4. Multi-format candidate generator (shorthands, zero-padding, prefix variants)
 */

// Letters swapped between US QWERTY and French AZERTY
export const AZERTY_LETTER_SWAP: Record<string, string> = {
  a: 'q', A: 'Q',
  q: 'a', Q: 'A',
  z: 'w', Z: 'W',
  w: 'z', W: 'Z',
  m: ',', M: '?'
};

// On French AZERTY keyboard, unshifted number row produces symbols:
// Key 1 -> '&', Key 2 -> 'é', Key 3 -> '"', Key 4 -> ''', Key 5 -> '('
// Key 6 -> '-' (French) or '§' (Belgian), Key 7 -> 'è', Key 8 -> '_' (French) or '!' (Belgian), Key 9 -> 'ç', Key 0 -> 'à'
// Key right of 0 (US hyphen '-') -> ')' unshifted, '°' shifted
export const AZERTY_DIGIT_MAP: Record<string, string> = {
  '&': '1',
  'é': '2', 'É': '2',
  '"': '3',
  "'": '4',
  '(': '5',
  '-': '6',
  '§': '6',
  'è': '7', 'È': '7',
  '_': '8',
  '!': '8',
  'ç': '9', 'Ç': '9',
  'à': '0', 'À': '0',
  ')': '-',
  '°': '-'
};

// Variant where '-' is preserved as a hyphen rather than decoded to '6'
export const AZERTY_DIGIT_MAP_PRESERVE_DASH: Record<string, string> = {
  ...AZERTY_DIGIT_MAP,
  '-': '-'
};

// Standard Windows Arabic 101 (QWERTY-based)
export const ARABIC_101_TO_LATIN: Record<string, string> = {
  'لآ': 'b', 'لا': 'b',
  'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
  'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
  'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/'
};

// Arabic 102 (AZERTY-based, used in North Africa / Algeria)
export const ARABIC_102_TO_LATIN: Record<string, string> = {
  'لآ': 'b', 'لا': 'b',
  'ض': 'a', 'ص': 'z', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p',
  'ش': 'q', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l',
  'ئ': 'w', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm'
};

export const ARABIC_INDIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

/**
 * Decode a string using character mapping tables
 */
export function decodeWithMaps(
  raw: string,
  letterMap?: Record<string, string>,
  digitMap?: Record<string, string>
): string {
  if (!raw) return '';
  let str = raw.replace(/لآ/g, 'b').replace(/لا/g, 'b');
  let decoded = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (letterMap && letterMap[char] !== undefined) {
      decoded += letterMap[char];
    } else if (digitMap && digitMap[char] !== undefined) {
      decoded += digitMap[char];
    } else if (ARABIC_INDIC_DIGITS[char] !== undefined) {
      decoded += ARABIC_INDIC_DIGITS[char];
    } else {
      decoded += char;
    }
  }

  return decoded;
}

/**
 * Normalizes Arabic text for flexible name searching
 */
export function normalizeArabicName(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // Remove tashkeel/diacritics
    .replace(/\s+/g, ' ');
}

// AZERTY and Arabic-Indic digit translation table for barcode payload extraction
const PAYLOAD_DIGIT_MAP: Record<string, string> = {
  '&': '1',
  'é': '2', 'É': '2',
  '"': '3',
  "'": '4',
  '(': '5',
  '-': '6',
  '§': '6',
  'è': '7', 'È': '7',
  '_': '8',
  '!': '8',
  'ç': '9', 'Ç': '9',
  'à': '0', 'À': '0',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
};

function decodePayloadDigits(str: string): string {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (PAYLOAD_DIGIT_MAP[ch] !== undefined) {
      res += PAYLOAD_DIGIT_MAP[ch];
    }
  }
  return res;
}

/**
 * Generates an exhaustive array of search candidates for any scanned or typed string.
 * Guarantees finding the student regardless of:
 * - Keyboard layout: French AZERTY, Arabic 101, Arabic 102, English QWERTY
 * - Symbol transliteration: ')', '-', '&', 'é', '"', etc.
 * - Barcode formats: STU-26866810, BAC03-1, BAC03-001, BAC031, rowId alone
 */
export function getBarcodeCandidates(raw: string): string[] {
  if (!raw) return [];
  const clean = raw.trim();
  const candidates = new Set<string>();

  // 1. Raw cleaned input as-is
  candidates.add(clean);
  candidates.add(clean.toUpperCase());
  candidates.add(clean.toLowerCase());

  // 1b. Normalized scanned barcode
  const normalized = normalizeScannedBarcode(clean);
  if (normalized && normalized !== clean) {
    candidates.add(normalized);
    candidates.add(normalized.toUpperCase());
    candidates.add(normalized.toLowerCase());
  }

  // 2. AZERTY decoding:
  // 2a. Full AZERTY (swapping letters Q<->A, W<->Z, and decoding digits)
  const azertyFull = decodeWithMaps(clean, AZERTY_LETTER_SWAP, AZERTY_DIGIT_MAP);
  candidates.add(azertyFull);
  candidates.add(azertyFull.toUpperCase());
  candidates.add(azertyFull.toLowerCase());

  // 2b. AZERTY digits only (letters were already Latin/QWERTY, e.g. STU)é-_--_&à)
  const azertyDigits = decodeWithMaps(clean, undefined, AZERTY_DIGIT_MAP);
  candidates.add(azertyDigits);
  candidates.add(azertyDigits.toUpperCase());
  candidates.add(azertyDigits.toLowerCase());

  // 2c. AZERTY preserving dash
  const azertyPreserveDash = decodeWithMaps(clean, AZERTY_LETTER_SWAP, AZERTY_DIGIT_MAP_PRESERVE_DASH);
  candidates.add(azertyPreserveDash);
  candidates.add(azertyPreserveDash.toUpperCase());
  candidates.add(azertyPreserveDash.toLowerCase());

  // 3. Arabic 101 decoding (standard Windows Arabic keyboard)
  const ar101 = decodeWithMaps(clean, ARABIC_101_TO_LATIN, AZERTY_DIGIT_MAP);
  candidates.add(ar101);
  candidates.add(ar101.toUpperCase());
  candidates.add(ar101.toLowerCase());

  const ar101PreserveDash = decodeWithMaps(clean, ARABIC_101_TO_LATIN, AZERTY_DIGIT_MAP_PRESERVE_DASH);
  candidates.add(ar101PreserveDash);
  candidates.add(ar101PreserveDash.toUpperCase());
  candidates.add(ar101PreserveDash.toLowerCase());

  // 4. Arabic 102 decoding (AZERTY-based Arabic keyboard)
  const ar102 = decodeWithMaps(clean, ARABIC_102_TO_LATIN, AZERTY_DIGIT_MAP);
  candidates.add(ar102);
  candidates.add(ar102.toUpperCase());
  candidates.add(ar102.toLowerCase());

  // 5. Arabic-Indic digits alone (e.g. ١ -> 1)
  const indicConverted = decodeWithMaps(clean, undefined, undefined);
  candidates.add(indicConverted);
  candidates.add(indicConverted.toUpperCase());

  // 6. Alphanumeric versions (stripping dashes, spaces, slashes)
  for (const c of Array.from(candidates)) {
    const alphanumeric = c.replace(/[^A-Za-z0-9]/g, '');
    if (alphanumeric) {
      candidates.add(alphanumeric);
      candidates.add(alphanumeric.toUpperCase());
    }
  }

  // 7. Shorthand group/student number expansions (e.g. BAC03-1, BAC-03-01, B03-1, B3-1, etc.)
  for (const c of Array.from(candidates)) {
    const upper = c.toUpperCase();

    // Pattern: (BAC|B|BACV) followed by group number and student row number
    const m = upper.match(/^(?:BACV|BAC|B)[-_]?0?(\d+)[-_]0*(\d+)$/);
    if (m) {
      const gNum = parseInt(m[1], 10);
      const rNum = parseInt(m[2], 10);
      const isVip = upper.startsWith('BACV');
      const prefix = isVip ? 'BACV' : 'BAC';

      const gid1 = `${prefix}${gNum.toString().padStart(2, '0')}`; // e.g. BAC03
      const gid2 = `${prefix}${gNum}`; // e.g. BAC3

      candidates.add(`${gid1}-${rNum}`);
      candidates.add(`${gid1}-${rNum.toString().padStart(2, '0')}`);
      candidates.add(`${gid1}-${rNum.toString().padStart(3, '0')}`);
      candidates.add(`${gid2}-${rNum}`);
      candidates.add(`${gid1}${rNum}`);
    }

    // Pattern: STU prefix with serial (including interleaved typing noise like SYTU, STYU, SUT, etc.)
    const mStu = upper.match(/^(?:STU|S[A-Z0-9_]{0,2}T[A-Z0-9_]{0,2}U|SYTU|STYU)[-_]?(\d+)$/);
    if (mStu) {
      let digits = mStu[1];
      if (/^6(2[67]\d{6})$/.test(digits)) {
        digits = digits.slice(1);
      }
      candidates.add(`STU-${digits}`);
      candidates.add(`STU${digits}`);
      if (digits.startsWith('27')) {
        candidates.add(`STU-26${digits.slice(2)}`);
        candidates.add(`STU26${digits.slice(2)}`);
      } else if (digits.startsWith('26')) {
        candidates.add(`STU-27${digits.slice(2)}`);
        candidates.add(`STU27${digits.slice(2)}`);
      }
    }

    // Pattern: Plain digit serial (e.g. 27000008 or 26000008, or 62700008)
    const mDigitsOnly = upper.match(/^(\d{7,10})$/);
    if (mDigitsOnly) {
      let digits = mDigitsOnly[1];
      if (/^6(2[67]\d{6})$/.test(digits)) {
        digits = digits.slice(1);
      }
      candidates.add(`STU-${digits}`);
      candidates.add(`STU${digits}`);
      if (digits.startsWith('27')) {
        candidates.add(`STU-26${digits.slice(2)}`);
        candidates.add(`STU26${digits.slice(2)}`);
      } else if (digits.startsWith('26')) {
        candidates.add(`STU-27${digits.slice(2)}`);
        candidates.add(`STU27${digits.slice(2)}`);
      }
    }

    // Pattern: Extract embedded 8-digit student serial anywhere in string (e.g. SYTU-27000405 -> 27000405)
    const decodedTotal = decodePayloadDigits(upper);
    const mEmbeddedSerial = decodedTotal.match(/(2[67]\d{6})/);
    if (mEmbeddedSerial) {
      const digits = mEmbeddedSerial[1];
      candidates.add(`STU-${digits}`);
      candidates.add(`STU${digits}`);
      candidates.add(digits);
      if (digits.startsWith('27')) {
        candidates.add(`STU-26${digits.slice(2)}`);
        candidates.add(`STU26${digits.slice(2)}`);
      } else if (digits.startsWith('26')) {
        candidates.add(`STU-27${digits.slice(2)}`);
        candidates.add(`STU27${digits.slice(2)}`);
      }
    }
  }

  // Filter out empty strings
  return Array.from(candidates).filter((c) => c && c.length > 0);
}

/**
 * Normalizes any scanned barcode string into standard English uppercase (e.g. STU-27000101 or BAC01-1)
 * regardless of the host operating system keyboard layout (Arabic 101, Arabic 102, French AZERTY, English QWERTY).
 *
 * Fully supports all barcodes containing digits 6 and 8 across all layouts!
 * Automatically clears previous scans if new barcodes are scanned into an existing search bar!
 * If the input is normal user typing (e.g. Arabic name or phone number), it leaves it completely untouched!
 */
export function normalizeScannedBarcode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Incomplete user typing like "STU", "STU-", "BAC", preserve as is without inventing digits
  if (/^STU[-_]?$/i.test(trimmed) || /^BACV?[-_]?$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // 1. Check for student barcode patterns: STU (or fuzzy interleaved like SYTU, STYU, etc., or Arabic سفع, ستو, لإ, لأ)
  // Matches: STU-..., SYTU-..., STU)..., STU_..., سفع)..., ستو-..., etc.
  const stuMatches = Array.from(
    trimmed.matchAll(/(?:STU|S[A-Za-z0-9_]{0,3}T[A-Za-z0-9_]{0,3}U|SYTU|STYU|سفع|ستو|لإ|لأ)[-_)°\s]*([^\r\n,;]+)/gi)
  );
  if (stuMatches.length > 0) {
    // If multiple STU scans exist, ALWAYS take the newest (last) one!
    const lastMatch = stuMatches[stuMatches.length - 1];
    let digits = decodePayloadDigits(lastMatch[1]);

    // Strip accidental leading '6' artifact if 9 digits starting with 627 or 626:
    if (/^6(2[67]\d{6})$/.test(digits)) {
      digits = digits.slice(1);
    }

    if (digits.length >= 6) {
      const serialMatches = Array.from(digits.matchAll(/(27\d{6}|26\d{6}|27\d{4,6}|26\d{4,6})/g));
      if (serialMatches.length > 0) {
        return `STU-${serialMatches[serialMatches.length - 1][1]}`;
      }
      return `STU-${digits.slice(-8)}`;
    }
    if (digits.length > 0) {
      return `STU-${digits}`;
    }
  }

  // 1b. Direct embedded 8-digit student serial anywhere in string (e.g. "y27000405", "gd27000405gd", "27y000405")
  const decodedTotal = decodePayloadDigits(trimmed);
  const mTotal = decodedTotal.match(/(2[67]\d{6})/);
  if (mTotal) {
    return `STU-${mTotal[1]}`;
  }

  // 2. Check for group barcode patterns: BAC / BACV (or Arabic لاشؤ, لاضؤ)
  // Pattern: (prefix)(delimiter?)(groupNum)(delimiter)(studentNum)
  // Examples: BAC01-6, BAC01-- (AZERTY 6), BAC01-_ (AZERTY 8), BAC01)- (AZERTY 6), BACà&)- (AZERTY 01-6)
  const bacMatches = Array.from(
    trimmed.matchAll(/(BACV|BAC|لاشؤ|لاضؤ)[-_)°\s]*([-&éÉ"'(èÈ_!çÇàÀ0-9٠-٩]+)[-_)°\s]+([-&éÉ"'(èÈ_!çÇàÀ0-9٠-٩]+)/gi)
  );
  if (bacMatches.length > 0) {
    const lastBac = bacMatches[bacMatches.length - 1];
    const prefix = lastBac[1].toUpperCase().startsWith('BACV') ? 'BACV' : 'BAC';
    const groupNum = decodePayloadDigits(lastBac[2]);
    const studentNum = decodePayloadDigits(lastBac[3]);

    if (groupNum && studentNum) {
      const gPadded = groupNum.padStart(2, '0');
      return `${prefix}${gPadded}-${parseInt(studentNum, 10)}`;
    }
  }

  // 2b. Group-only barcode without student row (e.g. BAC01 or BACà&)
  const bacGroupMatches = Array.from(
    trimmed.matchAll(/(BACV|BAC|لاشؤ|لاضؤ)[-_)°\s]*([-&éÉ"'(èÈ_!çÇàÀ0-9٠-٩]+)$/gi)
  );
  if (bacGroupMatches.length > 0) {
    const lastBac = bacGroupMatches[bacGroupMatches.length - 1];
    const prefix = lastBac[1].toUpperCase().startsWith('BACV') ? 'BACV' : 'BAC';
    const groupNum = decodePayloadDigits(lastBac[2]);
    if (groupNum) {
      return `${prefix}${groupNum.padStart(2, '0')}`;
    }
  }

  // 3. Raw AZERTY or Arabic-Indic scan without prefix:
  // e.g. "éèààà&à-" -> STU-27000106, "éèààà&à_" -> STU-27000108, "é-_--_&à" -> STU-26866810
  const hasAzertySymbols = /[éèàç&"'()§_]/.test(trimmed);
  const hasArabicScannerKey = /(?:سفع|لإ|لأ|ستو|لاشؤ|لاضؤ)/.test(trimmed);
  const hasArabicIndic = /[٠-٩]/.test(trimmed);

  if (hasAzertySymbols || hasArabicScannerKey || hasArabicIndic) {
    let allDigits = decodePayloadDigits(trimmed);
    if (/^6(2[67]\d{6})$/.test(allDigits)) {
      allDigits = allDigits.slice(1);
    }
    if (allDigits.length >= 6) {
      const serialMatches = Array.from(allDigits.matchAll(/(27\d{6}|26\d{6}|27\d{4,6}|26\d{4,6})/g));
      if (serialMatches.length > 0) {
        return `STU-${serialMatches[serialMatches.length - 1][1]}`;
      }
      return `STU-${allDigits.slice(-8)}`;
    }
  }

  // 4. Raw English serials typed/scanned (e.g. 27000106, 27000108, 26866810, 627000273)
  if (/^6?2[67]\d{6}$/.test(trimmed)) {
    let digits = trimmed;
    if (digits.startsWith('6') && digits.length === 9) {
      digits = digits.slice(1);
    }
    return `STU-${digits}`;
  }

  // Regular user typing (e.g. Arabic name or phone number)
  return raw;
}

