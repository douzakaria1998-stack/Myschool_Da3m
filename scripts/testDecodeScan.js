const fs = require('fs');

const AZERTY_TO_DIGIT = {
  '&': '1',
  'é': '2',
  'É': '2',
  '"': '3',
  "'": '4',
  '(': '5',
  '-': '6',
  'è': '7',
  'È': '7',
  'ç': '9',
  'Ç': '9',
  'à': '0',
  'À': '0',
  '§': '6',
  '^': '9'
};

const ARABIC_INDIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

/**
 * Robust Barcode Scanner Normalizer
 * Converts any hardware barcode scan into standardized English (e.g. STU-27000295 or BAC01-1)
 * regardless of active Windows keyboard layout (Arabic 101, Arabic 102, French AZERTY, English QWERTY).
 *
 * If the user is just typing a normal Arabic name (e.g. "محمد", "فاطمة"), it leaves it 100% untouched!
 */
function normalizeScannedBarcode(raw) {
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

  // Detect if this is a barcode scan or scanner artifact:
  // 1. Contains French AZERTY digit symbols (é, è, à, ç, etc.)
  // 2. Contains Arabic transcription of STU / BAC / scanner keys (سفع, لإ, لأ, ستو, لاشؤ, لاضؤ)
  // 3. Contains Arabic-Indic digits (٠-٩)
  // 4. Starts with STU, BAC, or is a serial number of 6+ digits
  const hasAzertyDigits = /[éèàç&"'()§]/.test(trimmed);
  const hasArabicScannerKey = /(?:سفع|لإ|لأ|ستو|لاشؤ|لاضؤ)/.test(trimmed);
  const hasArabicIndic = /[٠-٩]/.test(trimmed);
  const hasStuOrBac = /(?:STU|BAC|BACV)/i.test(trimmed);
  const hasRawSerial = /^\d{6,}$/.test(trimmed);

  // If none of the scanner signatures exist, this is regular user typing (e.g. Arabic name or phone), leave untouched!
  if (!hasAzertyDigits && !hasArabicScannerKey && !hasArabicIndic && !hasStuOrBac && !hasRawSerial) {
    return raw;
  }

  // Extract all digit characters by translating AZERTY symbols, Arabic-indic digits, or standard digits
  let extractedDigits = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (AZERTY_TO_DIGIT[ch] !== undefined) {
      extractedDigits += AZERTY_TO_DIGIT[ch];
    } else if (ARABIC_INDIC_DIGITS[ch] !== undefined) {
      extractedDigits += ARABIC_INDIC_DIGITS[ch];
    } else if (/\d/.test(ch)) {
      extractedDigits += ch;
    }
  }

  // If we extracted a valid student serial number (e.g. 2700XXXX or 2600XXXX, 6 to 10 digits)
  if (extractedDigits.length >= 6) {
    // Look for 27... or 26... inside extractedDigits
    const m27 = extractedDigits.match(/(27\d{4,8}|26\d{4,8})/);
    if (m27) {
      return `STU-${m27[1]}`;
    }
    // If it has STU or Arabic STU prefix, wrap it
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

  // Also replace any AZERTY digits in the string
  let converted = '';
  for (let i = 0; i < textDecoded.length; i++) {
    const ch = textDecoded[i];
    if (AZERTY_TO_DIGIT[ch] !== undefined) {
      converted += AZERTY_TO_DIGIT[ch];
    } else if (ARABIC_INDIC_DIGITS[ch] !== undefined) {
      converted += ARABIC_INDIC_DIGITS[ch];
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

// Tests
console.log("Screenshot string:", normalizeScannedBarcode("_éèàààèéç('لإ"));
console.log("Screenshot variant 2:", normalizeScannedBarcode("لإ_éèàààèéç('"));
console.log("AZERTY pure:", normalizeScannedBarcode("STU)éèààà&à&"));
console.log("AZERTY without STU:", normalizeScannedBarcode("éèààà&à&"));
console.log("Arabic 101 STU:", normalizeScannedBarcode("سفع-27000101"));
console.log("Arabic 102 STU AZERTY:", normalizeScannedBarcode("سفع_éèààà&à&"));
console.log("Arabic-Indic digits:", normalizeScannedBarcode("STU-٢٧٠٠٠١٠١"));
console.log("Normal Arabic name:", normalizeScannedBarcode("محمد بن علي"));
console.log("Normal Arabic name 2:", normalizeScannedBarcode("ضحى نغموش"));
console.log("Normal Arabic with phone:", normalizeScannedBarcode("عمر 0661234567"));
