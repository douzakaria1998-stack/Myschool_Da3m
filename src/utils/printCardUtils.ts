/**
 * Isolated Iframe Card Printing Utility
 * Ensures:
 * 1. ZERO blank pages from the background app document (prevents "22 pages" issue)
 * 2. Complete visibility of all card graphics, gradients, barcodes, and fonts
 * 3. Exact page sizing (CR80 PVC: 85.6mm x 54mm, A4: 8 cards per page)
 */

export function printCardHtml(
  cardHtmlList: string[],
  layout: 'cr80' | 'a4_sheet' = 'cr80',
  title: string = 'طباعة بطاقة التلميذ'
) {
  if (!cardHtmlList || cardHtmlList.length === 0) return;

  // Build isolated HTML document
  let bodyContent = '';

  if (layout === 'cr80') {
    // Single card or continuous individual CR80 cards
    bodyContent = cardHtmlList
      .map(
        (html) => `
        <div class="cr80-print-wrapper">
          ${html}
        </div>
      `
      )
      .join('\n');
  } else {
    // A4 Sheet: 10 cards per page (2 columns x 5 rows) with cutting guides
    const pages: string[][] = [];
    for (let i = 0; i < cardHtmlList.length; i += 10) {
      pages.push(cardHtmlList.slice(i, i + 10));
    }

    bodyContent = pages
      .map(
        (pageCards) => `
        <div class="a4-page">
          <div class="a4-grid">
            ${pageCards
              .map(
                (cardHtml) => `
              <div class="a4-cell">
                <div class="a4-guide"></div>
                <div class="a4-card-scaler">
                  ${cardHtml}
                </div>
              </div>
            `
              )
              .join('\n')}
          </div>
        </div>
      `
      )
      .join('\n');
  }

  const printDocument = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: ${layout === 'cr80' ? '85.6mm 54mm' : 'A4 portrait'};
      margin: ${layout === 'cr80' ? '0mm' : '4mm 0mm'} !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    }

    ${
      layout === 'cr80'
        ? `
      body {
        width: 85.6mm;
        height: 54mm;
        overflow: hidden;
      }
      .cr80-print-wrapper {
        width: 85.6mm;
        height: 54mm;
        page-break-after: always;
        page-break-inside: avoid;
        break-inside: avoid;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cr80-print-wrapper:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .cr80-print-wrapper .pvc-card {
        box-shadow: none !important;
        border: 1px solid #fed7aa !important;
      }
    `
        : `
      .a4-page {
        width: 100%;
        max-width: 210mm;
        height: 280mm;
        max-height: 280mm;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: always;
        page-break-inside: avoid;
        break-inside: avoid;
        break-after: page;
        margin: 0 auto;
        overflow: hidden;
      }
      .a4-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .a4-grid {
        display: grid;
        grid-template-columns: repeat(2, 83mm);
        grid-template-rows: repeat(5, 52mm);
        grid-gap: 1.5mm 8mm;
        justify-content: center;
        align-content: center;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .a4-cell {
        position: relative;
        width: 83mm;
        height: 52mm;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .a4-card-scaler {
        width: 85.6mm;
        height: 54mm;
        transform: scale(0.96);
        transform-origin: center center;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .a4-card-scaler .pvc-card {
        box-shadow: none !important;
      }
      .a4-guide {
        position: absolute;
        inset: 0;
        border: 0.5px dashed #cbd5e1;
        border-radius: 3.18mm;
        pointer-events: none;
      }
    `
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  // Create clean isolated iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(printDocument);
  doc.close();

  // Trigger print after resources and fonts settle
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print trigger error:', e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  }, 250);
}
