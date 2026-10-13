import { NextRequest, NextResponse } from 'next/server';
import { updateUser, deleteUser, validateSession } from '@/lib/userStore';

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

// PATCH /api/admin/users/[id] - Update user role, permissions, or password (Super Admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) {
    return NextResponse.json(
      { error: 'غير مصرح: تعديل بيانات المسؤولين مخصص للمسؤول الرئيسي فقط (Super Admin)' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { role, permissions, name, password } = body;

    const updated = await updateUser(id, {
      role,
      permissions,
      name,
      password
    });

    if (!updated) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'فشل في تحديث الحساب' },
      { status: 400 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete an admin user (Super Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await verifySuperAdmin(req);
  if (!superAdmin) {
    return NextResponse.json(
      { error: 'غير مصرح: حذف المسؤولين مخصص للمسؤول الرئيسي فقط (Super Admin)' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Prevent self-deletion
    if (superAdmin.id === id) {
      return NextResponse.json(
        { error: 'لا يمكن للمسؤول الرئيسي حذف حسابه الخاص' },
        { status: 400 }
      );
    }

    const success = await deleteUser(id);
    if (!success) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف الحساب بنجاح' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'فشل في حذف الحساب' },
      { status: 400 }
    );
  }
}
