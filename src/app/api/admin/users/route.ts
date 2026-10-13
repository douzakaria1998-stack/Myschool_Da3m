import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, createUser, validateSession } from '@/lib/userStore';

export const dynamic = 'force-dynamic';

async function verifySuperAdmin(req: NextRequest) {
  const sessionCookie = req.cookies.get('da3m_session')?.value;
  const authHeader = req.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = sessionCookie || headerToken;

  if (!token) return null;
  const session = await validateSession(token);
  if (!session || session.user.role !== 'super_admin') return null;
  return session.user;
}

// GET /api/admin/users - List all users (Super Admin only)
export async function GET(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) {
    return NextResponse.json(
      { error: 'غير مصرح: هذه العملية مخصصة للمسؤول الرئيسي فقط (Super Admin)' },
      { status: 403 }
    );
  }

  const users = await getAllUsers();
  return NextResponse.json({ users });
}

// POST /api/admin/users - Create new admin account (Super Admin only)
export async function POST(req: NextRequest) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) {
    return NextResponse.json(
      { error: 'غير مصرح: إنشاء حسابات المسؤولين مخصص للمسؤول الرئيسي فقط (Super Admin)' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { username, password, role, name, permissions } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 }
      );
    }

    if (password.length < 3) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تتكون من 3 أحرف على الأقل' },
        { status: 400 }
      );
    }

    const assignedRole = role === 'super_admin' ? 'super_admin' : 'admin';
    const newUser = await createUser({
      username,
      password,
      role: assignedRole,
      name: name || username,
      permissions: Array.isArray(permissions) ? permissions : []
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'فشل في إنشاء الحساب' },
      { status: 400 }
    );
  }
}
