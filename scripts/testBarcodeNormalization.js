// Test suite for barcode decoding and normalization

const payloadDigitMap = {
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

function decodeDigits(str) {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (payloadDigitMap[ch] !== undefined) {
      res += payloadDigitMap[ch];
    }
  }
  return res;
}

function normalizeScannedBarcode(raw) {
  if (!raw) return '';
  let trimmed = raw.trim();

  // Incomplete user typing like "STU" or "STU-", preserve as is without inventing digits
  if (/^STU[-_]?$/i.test(trimmed) || /^BACV?[-_]?$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // 1. Check for student barcode patterns: STU (or Arabic سفع, ستو, لإ, لأ)
  // Matches: STU-..., STU)..., STU_..., سفع)..., ستو-..., etc.
  // Note: '-' is safely placed first in [-&é...] so it is never treated as a character range!
  const stuMatches = Array.from(
    trimmed.matchAll(/(?:STU|سفع|ستو|لإ|لأ)[-_)°\s]*([-&éÉ"'(èÈ_!çÇàÀ0-9٠-٩]+)/gi)
  );
  if (stuMatches.length > 0) {
    // If multiple STU scans exist, ALWAYS take the newest (last) one!
    const lastMatch = stuMatches[stuMatches.length - 1];
    let digits = decodeDigits(lastMatch[1]);

    // Strip accidental leading '6' artifact if 9 digits starting with 627 or 626:
    if (/^6(2[67]\d{6})$/.test(digits)) {
      digits = digits.slice(1);
    }

    if (digits.length >= 6) {
      const serialMatch = Array.from(digits.matchAll(/(27\d{6}|26\d{6}|27\d{4,6}|26\d{4,6})/g));
      if (serialMatch.length > 0) {
        return `STU-${serialMatch[serialMatch.length - 1][1]}`;
      }
      return `STU-${digits.slice(-8)}`;
    }
    if (digits.length > 0) {
      return `STU-${digits}`;
    }
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
    const groupNum = decodeDigits(lastBac[2]);
    const studentNum = decodeDigits(lastBac[3]);

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
    const groupNum = decodeDigits(lastBac[2]);
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
    let allDigits = decodeDigits(trimmed);
    if (/^6(2[67]\d{6})$/.test(allDigits)) {
      allDigits = allDigits.slice(1);
    }
    if (allDigits.length >= 6) {
      const serialMatch = Array.from(allDigits.matchAll(/(27\d{6}|26\d{6}|27\d{4,6}|26\d{4,6})/g));
      if (serialMatch.length > 0) {
        return `STU-${serialMatch[serialMatch.length - 1][1]}`;
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

// Tests
const testCases = [
  // 1. Barcodes with 6
  { input: 'STU-27000106', expected: 'STU-27000106', desc: 'English STU with 6' },
  { input: 'STU)éèààà&à-', expected: 'STU-27000106', desc: 'AZERTY STU with ) and - for 6' },
  { input: 'STU-éèààà&à-', expected: 'STU-27000106', desc: 'AZERTY STU with - delimiter and - for 6' },
  { input: 'STU_éèààà&à-', expected: 'STU-27000106', desc: 'AZERTY STU with _ delimiter and - for 6' },
  { input: 'stu)éèààà&à-', expected: 'STU-27000106', desc: 'Lowercase AZERTY STU with 6' },
  { input: 'STUéèààà&à-', expected: 'STU-27000106', desc: 'AZERTY STU no delimiter with 6' },

  // 2. Barcodes with 8
  { input: 'STU-27000108', expected: 'STU-27000108', desc: 'English STU with 8' },
  { input: 'STU)éèààà&à_', expected: 'STU-27000108', desc: 'AZERTY STU with ) and _ for 8' },
  { input: 'STU-éèààà&à_', expected: 'STU-27000108', desc: 'AZERTY STU with - delimiter and _ for 8' },
  { input: 'STU_éèààà&à_', expected: 'STU-27000108', desc: 'AZERTY STU with _ delimiter and _ for 8' },
  { input: 'stu)éèààà&à_', expected: 'STU-27000108', desc: 'Lowercase AZERTY STU with 8' },
  { input: 'STUéèààà&à_', expected: 'STU-27000108', desc: 'AZERTY STU no delimiter with 8' },

  // 3. Barcodes with both 6 and 8
  { input: 'STU-26866810', expected: 'STU-26866810', desc: 'English STU-26866810' },
  { input: 'STU)é-_--_&à', expected: 'STU-26866810', desc: 'AZERTY STU)é-_--_&à' },
  { input: 'STU-é-_--_&à', expected: 'STU-26866810', desc: 'AZERTY STU-é-_--_&à' },
  { input: 'STU-27000168', expected: 'STU-27000168', desc: 'English STU-27000168' },
  { input: 'STU)éèààà&-_\'', expected: 'STU-27000168', desc: 'AZERTY STU)éèààà&-_' },

  // 4. Group barcodes with 6 and 8
  { input: 'BAC01-6', expected: 'BAC01-6', desc: 'English BAC01-6' },
  { input: 'BAC01-8', expected: 'BAC01-8', desc: 'English BAC01-8' },
  { input: 'BAC01)-', expected: 'BAC01-6', desc: 'AZERTY BAC01)-' },
  { input: 'BAC01)_', expected: 'BAC01-8', desc: 'AZERTY BAC01)_' },
  { input: 'BAC01--', expected: 'BAC01-6', desc: 'AZERTY BAC01--' },
  { input: 'BAC01-_', expected: 'BAC01-8', desc: 'AZERTY BAC01-_' },
  { input: 'BACà&)-', expected: 'BAC01-6', desc: 'AZERTY BACà&)-' },
  { input: 'BACà&)_', expected: 'BAC01-8', desc: 'AZERTY BACà&)_' },
  { input: 'BACà&--', expected: 'BAC01-6', desc: 'AZERTY BACà&--' },
  { input: 'BACà&-_', expected: 'BAC01-8', desc: 'AZERTY BACà&-_' },
  { input: 'BAC03)-', expected: 'BAC03-6', desc: 'AZERTY BAC03)-' },
  { input: 'BAC03)_', expected: 'BAC03-8', desc: 'AZERTY BAC03)_' },
  { input: 'BACV01)-', expected: 'BACV01-6', desc: 'AZERTY BACV01)-' },
  { input: 'BACV01)_', expected: 'BACV01-8', desc: 'AZERTY BACV01)_' },

  // 5. Arabic keyboard layout
  { input: 'سفع)éèààà&à-', expected: 'STU-27000106', desc: 'Arabic 101 with 6' },
  { input: 'سفع)éèààà&à_', expected: 'STU-27000108', desc: 'Arabic 101 with 8' },
  { input: 'ستو-éèààà&à-', expected: 'STU-27000106', desc: 'Arabic 102 with 6' },
  { input: 'ستو-éèààà&à_', expected: 'STU-27000108', desc: 'Arabic 102 with 8' },
  { input: 'لإ)éèààà&à-', expected: 'STU-27000106', desc: 'Arabic ligature with 6' },
  { input: 'لأ)éèààà&à_', expected: 'STU-27000108', desc: 'Arabic ligature with 8' },
  { input: 'سفع-٢٧٠٠٠١٠٦', expected: 'STU-27000106', desc: 'Arabic-Indic digits with 6' },
  { input: 'سفع-٢٧٠٠٠١٠٨', expected: 'STU-27000108', desc: 'Arabic-Indic digits with 8' },
  { input: 'لاشؤ01)-', expected: 'BAC01-6', desc: 'Arabic BAC with 6' },
  { input: 'لاشؤ01)_', expected: 'BAC01-8', desc: 'Arabic BAC with 8' },

  // 6. Repeated scans & preceding text
  { input: 'STU-27000101STU-27000106', expected: 'STU-27000106', desc: 'Repeated English scan with 6' },
  { input: 'STU)éèààà&à&STU)éèààà&à-', expected: 'STU-27000106', desc: 'Repeated AZERTY scan with 6' },
  { input: 'STU)éèààà&à&STU)éèààà&à_', expected: 'STU-27000108', desc: 'Repeated AZERTY scan with 8' },
  { input: 'محمدSTU-27000106', expected: 'STU-27000106', desc: 'Arabic text before scan with 6' },
  { input: 'محمدSTU)éèààà&à_', expected: 'STU-27000108', desc: 'Arabic text before AZERTY scan with 8' },

  // 7. Accidental 6 artifact before 27/26
  { input: 'STU-627000273', expected: 'STU-27000273', desc: 'Strip accidental 6 artifact STU-627...' },
  { input: '627000273', expected: 'STU-27000273', desc: 'Strip accidental 6 artifact 627...' },

  // 8. Raw scans without prefix
  { input: 'éèààà&à-', expected: 'STU-27000106', desc: 'Raw AZERTY digits for 27000106' },
  { input: 'éèààà&à_', expected: 'STU-27000108', desc: 'Raw AZERTY digits for 27000108' },
  { input: 'é-_--_&à', expected: 'STU-26866810', desc: 'Raw AZERTY digits for 26866810' },
  { input: '27000106', expected: 'STU-27000106', desc: 'Raw English serial 27000106' },
  { input: '27000108', expected: 'STU-27000108', desc: 'Raw English serial 27000108' },

  // 9. Regular user typing (MUST NOT CHANGE)
  { input: 'محمد الأمين', expected: 'محمد الأمين', desc: 'Arabic name untouched' },
  { input: 'فاطمة الزهراء', expected: 'فاطمة الزهراء', desc: 'Arabic name untouched' },
  { input: '0661122334', expected: '0661122334', desc: 'Phone number starting with 06 untouched' },
  { input: '0555123456', expected: '0555123456', desc: 'Phone number starting with 05 untouched' },
  { input: '0770987654', expected: '0770987654', desc: 'Phone number starting with 07 untouched' },
  { input: 'STU', expected: 'STU', desc: 'Partial prefix STU preserved' },
  { input: 'STU-', expected: 'STU-', desc: 'Partial prefix STU- preserved' },
  { input: 'BAC', expected: 'BAC', desc: 'Partial prefix BAC preserved' }
];

let failed = 0;
console.log(`Running ${testCases.length} barcode normalization test cases...\n`);

for (const tc of testCases) {
  const result = normalizeScannedBarcode(tc.input);
  if (result === tc.expected) {
    console.log(`PASS: ${tc.desc} -> ${result}`);
  } else {
    console.error(`FAIL: ${tc.desc}`);
    console.error(`   Input:    '${tc.input}'`);
    console.error(`   Expected: '${tc.expected}'`);
    console.error(`   Got:      '${result}'`);
    failed++;
  }
}

if (failed === 0) {
  console.log(`\nALL ${testCases.length} TESTS PASSED PERFECTLY!`);
} else {
  console.error(`\n${failed} TESTS FAILED!`);
  process.exit(1);
}
