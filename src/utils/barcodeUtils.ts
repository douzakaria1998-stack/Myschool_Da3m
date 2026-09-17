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
// Key 6 -> '-', Key 7 -> 'è', Key 8 -> '_', Key 9 -> 'ç', Key 0 -> 'à'
// Key right of 0 (US hyphen '-') -> ')' unshifted, '°' shifted
export const AZERTY_DIGIT_MAP: Record<string, string> = {
  '&': '1',
  'é': '2', 'É': '2',
  '"': '3',
  "'": '4',
  '(': '5',
  '-': '6',
  'è': '7', 'È': '7',
  '_': '8',
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

    // Pattern: STU prefix with serial (e.g. STU-27000008, STU-26000008, STU27000008)
    const mStu = upper.match(/^STU[-_]?(\d+)$/);
    if (mStu) {
      candidates.add(`STU-${mStu[1]}`);
      candidates.add(`STU${mStu[1]}`);
      if (mStu[1].startsWith('27')) {
        candidates.add(`STU-26${mStu[1].slice(2)}`);
        candidates.add(`STU26${mStu[1].slice(2)}`);
      } else if (mStu[1].startsWith('26')) {
        candidates.add(`STU-27${mStu[1].slice(2)}`);
        candidates.add(`STU27${mStu[1].slice(2)}`);
      }
    }

    // Pattern: Plain digit serial (e.g. 27000008 or 26000008)
    const mDigitsOnly = upper.match(/^(\d{7,10})$/);
    if (mDigitsOnly) {
      candidates.add(`STU-${mDigitsOnly[1]}`);
      candidates.add(`STU${mDigitsOnly[1]}`);
      if (mDigitsOnly[1].startsWith('27')) {
        candidates.add(`STU-26${mDigitsOnly[1].slice(2)}`);
        candidates.add(`STU26${mDigitsOnly[1].slice(2)}`);
      } else if (mDigitsOnly[1].startsWith('26')) {
        candidates.add(`STU-27${mDigitsOnly[1].slice(2)}`);
        candidates.add(`STU27${mDigitsOnly[1].slice(2)}`);
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
 * If the input is normal user typing (e.g. Arabic name or phone number), it leaves it completely untouched!
 */
export function normalizeScannedBarcode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // If already clean English barcode format, standardize casing
  if (/^STU[-_]?\d+$/i.test(trimmed)) {
    const m = trimmed.toUpperCase().match(/^STU[-_]?(\d+)$/);
    return m ? `STU-${m[1]}` : trimmed.toUpperCase();
  }
  if (/^(?:BAC|BACV)[-_]?\d+[-_]?\d*$/i.test(trimmed)) {
    return trimmed.toUpperCase().replace(/_/g, '-');
  }

  // Detect if this string contains scanner artifacts:
  // 1. French AZERTY digit row symbols: é, è, à, ç, &, ", ', (, §, etc.
  // 2. Arabic keyboard transcription of scanner letters: سفع, لإ, لأ, ستو, لاشؤ, لاضؤ
  // 3. Arabic-Indic digits: ٠-٩
  // 4. Raw digits sequence of 6+ digits
  const hasAzertyDigits = /[éèàç&"'()§]/.test(trimmed);
  const hasArabicScannerKey = /(?:سفع|لإ|لأ|ستو|لاشؤ|لاضؤ)/.test(trimmed);
  const hasArabicIndic = /[٠-٩]/.test(trimmed);
  const hasStuOrBac = /(?:STU|BAC|BACV)/i.test(trimmed);
  const hasRawSerial = /^\d{6,}$/.test(trimmed);

  // If none of the scanner signatures exist, this is regular user typing (e.g. Arabic name or short query), leave untouched!
  if (!hasAzertyDigits && !hasArabicScannerKey && !hasArabicIndic && !hasStuOrBac && !hasRawSerial) {
    return raw;
  }

  // Map of AZERTY number row characters to digits
  const azertyMap: Record<string, string> = {
    '&': '1',
    'é': '2', 'É': '2',
    '"': '3',
    "'": '4',
    '(': '5',
    '-': '6',
    'è': '7', 'È': '7',
    'ç': '9', 'Ç': '9',
    'à': '0', 'À': '0',
    '§': '6'
  };

  const arabicIndicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };

  // Extract digits by translating AZERTY symbols, Arabic-indic digits, or standard digits
  let extractedDigits = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (azertyMap[ch] !== undefined) {
      extractedDigits += azertyMap[ch];
    } else if (arabicIndicMap[ch] !== undefined) {
      extractedDigits += arabicIndicMap[ch];
    } else if (/\d/.test(ch)) {
      extractedDigits += ch;
    }
  }

  // If we extracted a valid student serial number (e.g. 2700XXXX or 2600XXXX, 6 to 10 digits)
  if (extractedDigits.length >= 6) {
    const m27 = extractedDigits.match(/(27\d{4,8}|26\d{4,8})/);
    if (m27) {
      return `STU-${m27[1]}`;
    }
    if (hasStuOrBac || hasArabicScannerKey || hasAzertyDigits) {
      return `STU-${extractedDigits}`;
    }
  }

  // Check group barcodes like BAC01-1 or BACV01-1
  let textDecoded = trimmed
    .replace(/لاشؤ[-_]?/g, 'BAC-')
    .replace(/لاضؤ[-_]?/g, 'BAC-')
    .replace(/سفع[-_]?/g, 'STU-')
    .replace(/ستو[-_]?/g, 'STU-')
    .replace(/لإ[-_]?/g, 'STU-')
    .replace(/لأ[-_]?/g, 'STU-');

  let converted = '';
  for (let i = 0; i < textDecoded.length; i++) {
    const ch = textDecoded[i];
    if (azertyMap[ch] !== undefined) {
      converted += azertyMap[ch];
    } else if (arabicIndicMap[ch] !== undefined) {
      converted += arabicIndicMap[ch];
    } else if (ch === ')') {
      converted += '-';
    } else {
      converted += ch;
    }
  }

  const mBac = converted.toUpperCase().match(/^(?:BAC|BACV)[-_]?\d+[-_]?\d*$/);
  if (mBac) {
    return converted.toUpperCase().replace(/_/g, '-');
  }

  const mFinalStu = converted.toUpperCase().match(/^STU[-_]?(\d+)$/);
  if (mFinalStu) {
    return `STU-${mFinalStu[1]}`;
  }

  if (extractedDigits.length >= 4 && (hasAzertyDigits || hasArabicScannerKey)) {
    if (extractedDigits.startsWith('27') || extractedDigits.startsWith('26')) {
      return `STU-${extractedDigits}`;
    }
  }

  return raw;
}
