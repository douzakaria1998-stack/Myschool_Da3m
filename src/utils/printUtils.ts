// Thermal 80mm Receipt Printing Utilities for Da3m Center

export interface ThermalReceiptData {
  receiptNo: string;
  centerName: string;
  cycle: string;
  academicYear: string;
  date: string;
  time: string;
  studentName: string;
  studentPhone?: string;
  groupId: string;
  subject: string;
  teacherName: string;
  amount: number;
  totalFee: number;
  totalPaid: number;
  balance: number;
  isCover?: boolean;
  originalGroup?: string;
}

function generateReceiptHtml(receipt: ThermalReceiptData): string {
  return `
    <div class="receipt-container">
      <div class="center" style="margin-bottom: 6px;">
        <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/logo.svg" alt="شعار المؤسسة" style="height: 36px; max-width: 65mm; object-fit: contain; display: block; margin: 0 auto; filter: grayscale(100%);" />
      </div>
      <div class="center bold" style="font-size: 13px;">${receipt.centerName || 'مؤسسة دعم'}</div>
      <div class="center" style="font-size: 9px;">${receipt.cycle || 'الدورة الحالية'} | ${receipt.academicYear || ''}</div>
      <div class="divider"></div>
      <div class="center bold" style="font-size: 12px;">وصل تسديد المستحقات</div>
      <div class="flex-row" style="font-size: 10px;">
        <span>رقم: #${receipt.receiptNo}</span>
        <span>${receipt.date} ${receipt.time}</span>
      </div>
      <div class="divider"></div>
      <div class="flex-row">
        <span>الفوج: <strong>${receipt.groupId}</strong></span>
        <span>المادة: <strong>${receipt.subject}</strong></span>
      </div>
      <div>الأستاذ: <strong>${receipt.teacherName || '—'}</strong></div>
      ${receipt.isCover ? `<div style="color: #b45309; font-weight: bold; font-size: 11px; margin-top: 2px;">★ حصة تعويض (الفوج الأصلي: ${receipt.originalGroup || '—'})</div>` : ''}
      <div class="divider"></div>
      <div class="flex-row">
        <span>التلميذ:</span>
        <span class="bold" style="font-size: 12px;">${receipt.studentName}</span>
      </div>
      ${receipt.studentPhone ? `<div class="flex-row" style="font-size: 10px;"><span>الهاتف:</span><span>${receipt.studentPhone}</span></div>` : ''}
      <div class="divider"></div>
      <div class="flex-row">
        <span>المبلغ المطلوب (الدورة):</span>
        <span>${receipt.totalFee.toLocaleString()} دج</span>
      </div>
      <div class="flex-row bold" style="font-size: 12px; color: #000;">
        <span>المبلغ المسدد الآن:</span>
        <span style="font-size: 13px;">${receipt.amount.toLocaleString()} دج</span>
      </div>
      <div class="flex-row" style="font-size: 11px;">
        <span>إجمالي المسدد:</span>
        <span>${receipt.totalPaid.toLocaleString()} دج</span>
      </div>
      <div class="divider"></div>
      <div class="flex-row bold" style="font-size: 12px;">
        <span>الوضعية:</span>
        <span>${receipt.balance < 0 ? `متبقي (دين): ${Math.abs(receipt.balance).toLocaleString()} دج` : 'مسدد بالكامل ✓'}</span>
      </div>
      <div class="barcode">*${receipt.receiptNo}*</div>
      <div class="center" style="font-size: 9px; line-height: 1.3;">
        شكراً لثقتكم بمؤسستنا - مع تمنياتنا بالتفوق والنجاح<br />
        يرجى الاحتفاظ بهذا الوصل
      </div>
      <div class="cut-line">✄ - - - - - - - - - - - - - - - - - - -</div>
    </div>
  `;
}

/**
 * Print a single 80mm thermal receipt immediately
 */
export function printSingleThermalReceipt(receipt: ThermalReceiptData) {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank', 'width=400,height=550');
  if (!printWindow) return;

  const receiptHtml = generateReceiptHtml(receipt);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>وصل حراري - ${receipt.studentName}</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            font-family: 'Courier New', 'Cairo', Tahoma, Arial, sans-serif;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 8px 4px 16px 4px !important;
            font-size: 12px;
            line-height: 1.4;
            text-align: right;
            direction: rtl;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-container { width: 100%; }
          .center { text-align: center; }
          .bold { font-weight: 900; }
          .divider { width: 100%; border-top: 1.5px dashed #000; margin: 5px 0; }
          .flex-row { width: 100%; display: flex; justify-content: space-between; align-items: center; margin: 2px 0; font-size: 12px; }
          .barcode { font-family: monospace; letter-spacing: 2px; text-align: center; margin: 6px 0 2px; font-weight: bold; font-size: 12px; }
          .cut-line { text-align: center; font-size: 10px; font-weight: bold; color: #222; margin-top: 10px; }
        </style>
      </head>
      <body>
        ${receiptHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Print batch of thermal receipts sequentially with page-breaks
 */
export function printBatchThermalReceipts(receipts: ThermalReceiptData[]) {
  if (typeof window === 'undefined' || receipts.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) return;

  const bodyHtml = receipts
    .map((r, idx) => `
      <div style="${idx > 0 ? 'page-break-before: always; break-before: page; margin-top: 20px;' : ''}">
        ${generateReceiptHtml(r)}
      </div>
    `)
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>طباعة قائمة الوصلات المؤجلة (${receipts.length})</title>
        <style>
          @page { size: 80mm auto; margin: 0mm !important; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            font-family: 'Courier New', 'Cairo', Tahoma, Arial, sans-serif;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 8px 4px 16px 4px !important;
            font-size: 12px;
            line-height: 1.4;
            text-align: right;
            direction: rtl;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: 900; }
          .divider { width: 100%; border-top: 1.5px dashed #000; margin: 5px 0; }
          .flex-row { width: 100%; display: flex; justify-content: space-between; align-items: center; margin: 2px 0; font-size: 12px; }
          .barcode { font-family: monospace; letter-spacing: 2px; text-align: center; margin: 6px 0 2px; font-weight: bold; font-size: 12px; }
          .cut-line { text-align: center; font-size: 10px; font-weight: bold; color: #222; margin-top: 10px; }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
