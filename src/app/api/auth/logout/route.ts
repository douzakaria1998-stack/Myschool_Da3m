import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '@/lib/userStore';

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('da3m_session')?.value;
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const tokenToDestroy = sessionCookie || headerToken;
    if (tokenToDestroy) {
      await destroySession(tokenToDestroy);
    }

    const response = NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    response.cookies.delete('da3m_session');
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error logging out' }, { status: 500 });
  }
}
