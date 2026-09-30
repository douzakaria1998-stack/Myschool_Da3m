import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Look for installed browser executables for headless printing
function getBrowserExecutablePath(): string | null {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Sanitize filename for Windows filesystem
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

// Convert local logo.svg to Base64 Data URI so headless browser renders it seamlessly
let cachedLogoDataUri: string | null = null;
function getLogoDataUri(): string {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.svg');
    if (fs.existsSync(logoPath)) {
      const svg = fs.readFileSync(logoPath, 'utf-8');
      cachedLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      return cachedLogoDataUri;
    }
  } catch (err) {
    console.warn('Could not read logo.svg for embedding:', err);
  }
  return '';
}

function prepareHtmlForPdf(rawHtml: string): string {
  let processed = rawHtml;
  const logoUri = getLogoDataUri();
  if (logoUri) {
    // Replace any /logo.svg or http://.../logo.svg src with embedded data URI
    processed = processed.replace(/src=["'][^"']*logo\.svg["']/g, `src="${logoUri}"`);
  }
  return processed;
}

interface ReceiptItem {
  html: string;
  filename: string;
  folderDate?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Support both single receipt item or an array of items in body.receipts
    const items: ReceiptItem[] = Array.isArray(body.receipts)
      ? body.receipts
      : body.html && body.filename
      ? [{ html: body.html, filename: body.filename, folderDate: body.folderDate }]
      : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'No receipt data provided' }, { status: 400 });
    }

    const browserExe = getBrowserExecutablePath();
    if (!browserExe) {
      return NextResponse.json(
        { success: false, error: 'Neither Google Chrome nor Microsoft Edge was found on this system.' },
        { status: 500 }
      );
    }

    // Determine target Desktop folder: Desktop/الوصولات/<folderDate>
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\dell';
    const desktopPath = path.join(userProfile, 'Desktop');
    const baseDir = fs.existsSync(desktopPath)
      ? path.join(desktopPath, 'الوصولات')
      : path.join(process.cwd(), 'saved_receipts');

    const tempDir = path.join(os.tmpdir(), 'da3m_receipts_temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const savedFiles: string[] = [];

    // Process items in parallel with a controlled concurrency limit of 3
    const concurrency = 3;
    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (item) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const dateFolder = sanitizeFilename(item.folderDate || todayStr);
          const targetDir = path.join(baseDir, dateFolder);

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          let safeName = sanitizeFilename(item.filename);
          if (!safeName.toLowerCase().endsWith('.pdf')) {
            safeName += '.pdf';
          }

          // If file with same name exists, append timestamp to prevent overwriting
          let finalPdfPath = path.join(targetDir, safeName);
          if (fs.existsSync(finalPdfPath)) {
            const timeTag = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
            const baseName = safeName.replace(/\.pdf$/i, '');
            finalPdfPath = path.join(targetDir, `${baseName}_${timeTag}.pdf`);
          }

          const tempHtmlPath = path.join(tempDir, `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.html`);
          const fullHtml = prepareHtmlForPdf(item.html);
          fs.writeFileSync(tempHtmlPath, fullHtml, 'utf-8');

          try {
            await execFileAsync(browserExe, [
              '--headless=new',
              '--disable-gpu',
              '--no-pdf-header-footer',
              `--print-to-pdf=${finalPdfPath}`,
              tempHtmlPath,
            ]);

            if (fs.existsSync(finalPdfPath)) {
              savedFiles.push(finalPdfPath);
            }
          } catch (execErr) {
            console.error(`Error generating PDF for ${safeName}:`, execErr);
          } finally {
            try {
              if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
              }
            } catch {
              // ignore temp cleanup error
            }
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      count: savedFiles.length,
      savedFiles,
      baseFolder: baseDir,
    });
  } catch (error: any) {
    console.error('Failed to save receipt PDF:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
