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
  '§': '6'
};

const ARABIC_INDIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

function normalizeScannedBarcode(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();

  // 1. If input contains multiple barcodes or old text followed by a new barcode:
  // e.g. "STU-27000220STU-27000220", "STU-27000101STU-27000220", "محمدSTU-27000220", "0661234567STU-27000220"
  // Keep ONLY the latest (last) barcode!
  const barcodeRegex = /(?:STU[-_]?\d{4,10}|(?:BAC|BACV)[-_]?\d+[-_]?\d*)/gi;
  const allBarcodes = trimmed.match(barcodeRegex);
  if (allBarcodes && allBarcodes.length > 1) {
    const lastBarcode = allBarcodes[allBarcodes.length - 1].toUpperCase();
    const m = lastBarcode.match(/^STU[-_]?(\d+)$/);
    return m ? `STU-${m[1]}` : lastBarcode.replace(/_/g, '-');
  }

  // If there's 1 barcode and it's appended after other text (e.g. "محمدSTU-27000220" or "0661122334STU-27000220")
  if (allBarcodes && allBarcodes.length === 1 && !trimmed.toUpperCase().startsWith(allBarcodes[0].toUpperCase())) {
    const single = allBarcodes[0].toUpperCase();
    const m = single.match(/^STU[-_]?(\d+)$/);
    return m ? `STU-${m[1]}` : single.replace(/_/g, '-');
  }

  // 2. If input already is a single clean English barcode format, standardize casing & format
  if (/^STU[-_]?\d+$/i.test(trimmed)) {
    const m = trimmed.toUpperCase().match(/^STU[-_]?(\d+)$/);
    return m ? `STU-${m[1]}` : trimmed.toUpperCase();
  }
  if (/^(?:BAC|BACV)[-_]?\d+[-_]?\d*$/i.test(trimmed)) {
    return trimmed.toUpperCase().replace(/_/g, '-');
  }

  // 3. If input has an old barcode and a new scan in French AZERTY or Arabic was appended:
  // e.g. "STU-27000101_éèàààèéç('لإ"
  if (allBarcodes && allBarcodes.length === 1 && (/[éèàç&"'()§]/.test(trimmed) || /(?:سفع|لإ|لأ|ستو|لاشؤ|لاضؤ)/.test(trimmed))) {
    const remaining = trimmed.replace(allBarcodes[0], '').trim();
    if (remaining.length >= 4) {
      const decodedNew = normalizeScannedBarcode(remaining);
      if (decodedNew && decodedNew !== remaining) {
        return decodedNew;
      }
    }
  }

  // 4. Detect scanner artifacts:
  const hasAzertyDigits = /[éèàç&"'()§]/.test(trimmed);
  const hasArabicScannerKey = /(?:سفع|لإ|لأ|ستو|لاشؤ|لاضؤ)/.test(trimmed);
  const hasArabicIndic = /[٠-٩]/.test(trimmed);
  const hasStuOrBac = /(?:STU|BAC|BACV)/i.test(trimmed);
  // Plain serial with 12+ digits means multiple serials concatenated (e.g. 2700010127000220)
  const hasConcatSerials = /^\d{12,}$/.test(trimmed);

  // If none of the scanner signatures exist, this is regular user typing (e.g. Arabic name or phone number), leave untouched!
  if (!hasAzertyDigits && !hasArabicScannerKey && !hasArabicIndic && !hasStuOrBac && !hasConcatSerials) {
    return raw;
  }

  // Extract digits by translating AZERTY symbols, Arabic-indic digits, or standard digits
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

  // If we extracted student serials (e.g. 2700XXXX or 2600XXXX, standard 8 digits)
  if (extractedDigits.length >= 6) {
    const matches27 = Array.from(extractedDigits.matchAll(/(27\d{6}|26\d{6}|27\d{4,6}|26\d{4,6})/g));
    if (matches27.length > 0) {
      // Take the LAST serial if multiple scans occurred!
      const lastMatch = matches27[matches27.length - 1][0];
      return `STU-${lastMatch}`;
    }
    if (hasStuOrBac || hasArabicScannerKey || hasAzertyDigits) {
      return `STU-${extractedDigits.slice(-8)}`;
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

  return raw;
}

const testCases = [
  { in: 'STU-27000220STU-27000220STU-27000220', expected: 'STU-27000220' },
  { in: 'STU-27000101STU-27000220', expected: 'STU-27000220' },
  { in: 'BAC01-1BAC02-3', expected: 'BAC02-3' },
  { in: 'STU-27000101BAC01-5', expected: 'BAC01-5' },
  { in: 'BAC01-5STU-27000220', expected: 'STU-27000220' },
  { in: 'محمد بن عليSTU-27000220', expected: 'STU-27000220' },
  { in: '0661122334STU-27000220', expected: 'STU-27000220' },
  { in: 'STU-27000101STU)éèàààééà', expected: 'STU-27000220' },
  { in: 'سفع)éèàààééàسفع)éèàààééà', expected: 'STU-27000220' },
  { in: '2700010127000220', expected: 'STU-27000220' },
  { in: 'محمد بن علي', expected: 'محمد بن علي' },
  { in: '0661122334', expected: '0661122334' },
  { in: 'BAC01', expected: 'BAC01' }
];

let allPassed = true;
testCases.forEach((t, idx) => {
  const res = normalizeScannedBarcode(t.in);
  const ok = res === t.expected;
  if (!ok) allPassed = false;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] Test ${idx + 1}: input="${t.in}" -> got="${res}" expected="${t.expected}"`);
});

if (allPassed) {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('SOME TESTS FAILED!');
  process.exit(1);
}
