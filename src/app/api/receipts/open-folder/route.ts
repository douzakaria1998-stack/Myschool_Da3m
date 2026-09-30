import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export async function POST() {
  try {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\dell';
    const desktopPath = path.join(userProfile, 'Desktop');
    const baseDir = fs.existsSync(desktopPath)
      ? path.join(desktopPath, 'الوصولات')
      : path.join(process.cwd(), 'saved_receipts');

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Launch explorer to open the folder on Windows
    exec(`explorer.exe "${baseDir}"`);

    return NextResponse.json({ success: true, folder: baseDir });
  } catch (error: any) {
    console.error('Error opening receipts folder:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
