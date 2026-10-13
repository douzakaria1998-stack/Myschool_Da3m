import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsername, createSession } from '@/lib/userStore';
import { verifyPassword } from '@/lib/authCrypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم المستخدم وكلمة المرور' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    let userRecord = await getUserByUsername(cleanUsername);

    // Fallback/Bridge for quick PIN login:
    // If username is "777" or password is "777", map to superadmin
    if (!userRecord && (cleanUsername === '777' || password === '777')) {
      userRecord = await getUserByUsername('superadmin');
    } else if (!userRecord && (cleanUsername === '123' || password === '123')) {
      userRecord = await getUserByUsername('admin1');
    }

    if (!userRecord) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Verify password hash
    const isValid = verifyPassword(password, userRecord.passwordHash, userRecord.salt);
    // Also allow direct PIN bypass for legacy emergency recovery
    const isLegacyPin =
      (userRecord.role === 'super_admin' && password === '777') ||
      (userRecord.role === 'admin' && password === '123');

    if (!isValid && !isLegacyPin) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Create session
    const { token, signedToken, expiresAt, user } = await createSession(userRecord.id);

    const response = NextResponse.json({
      success: true,
      user,
      token,
      expiresAt
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: 'da3m_session',
      value: signedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days in seconds
    });

    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    );
  }
}
