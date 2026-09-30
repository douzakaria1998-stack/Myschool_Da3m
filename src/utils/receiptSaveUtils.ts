/**
 * Utility functions for saving printed receipts as PDF files directly on the PC
 */

export interface ReceiptSavePayload {
  html: string;
  filename: string;
  folderDate?: string;
}

export interface ReceiptSaveEventDetail {
  count: number;
  filename?: string;
  folder?: string;
  success: boolean;
}

/**
 * Sends a single receipt HTML to the server to be converted and saved as a PDF
 */
export async function saveReceiptPdfToServer(payload: ReceiptSavePayload): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const res = await fetch('/api/receipts/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      window.dispatchEvent(
        new CustomEvent<ReceiptSaveEventDetail>('da3m-receipt-saved', {
          detail: {
            count: 1,
            filename: payload.filename,
            folder: data.baseFolder,
            success: true,
          },
        })
      );
      return true;
    }
  } catch (err) {
    console.warn('Could not auto-save receipt PDF to PC:', err);
  }
  return false;
}

/**
 * Sends multiple receipts to the server to be saved as individual PDFs
 */
export async function saveBatchReceiptsPdfToServer(receipts: ReceiptSavePayload[]): Promise<boolean> {
  if (typeof window === 'undefined' || receipts.length === 0) return false;

  try {
    const res = await fetch('/api/receipts/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ receipts }),
    });

    const data = await res.json();
    if (data.success) {
      window.dispatchEvent(
        new CustomEvent<ReceiptSaveEventDetail>('da3m-receipt-saved', {
          detail: {
            count: data.count || receipts.length,
            folder: data.baseFolder,
            success: true,
          },
        })
      );
      return true;
    }
  } catch (err) {
    console.warn('Could not auto-save batch receipts to PC:', err);
  }
  return false;
}

/**
 * Requests the server to open the PC's receipts folder in Windows Explorer
 */
export async function openReceiptsFolder(): Promise<boolean> {
  try {
    const res = await fetch('/api/receipts/open-folder', { method: 'POST' });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.warn('Could not open receipts folder:', err);
    return false;
  }
}
