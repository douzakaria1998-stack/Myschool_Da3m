'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, UserRole, UserPermission } from '@/types/auth';
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Edit2,
  Trash2,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  KeyRound,
  Check,
  X
} from 'lucide-react';

const AVAILABLE_PERMISSIONS: { id: UserPermission; label: string; desc: string }[] = [
  { id: 'manage_groups', label: 'إدارة الأفواج', desc: 'إضافة وتعديل وحذف الأفواج' },
  { id: 'manage_students', label: 'إدارة التلاميذ', desc: 'تسجيل وتحويل وحذف التلاميذ' },
  { id: 'manage_attendance', label: 'تسجيل الحضور', desc: 'تسجيل حضور وغياب وتعويض الحصص' },
  { id: 'manage_teachers', label: 'إدارة الأساتذة', desc: 'تسديد مستحقات الأساتذة وتعديل بياناتهم' },
  { id: 'manage_finances', label: 'المالية والأسعار', desc: 'تعديل تسعيرة الحصص ونسب التقاسم' },
  { id: 'view_reports', label: 'عرض التقارير', desc: 'الاطلاع على الإحصائيات الشاملة' },
  { id: 'delete_records', label: 'صلاحيات الحذف', desc: 'حذف السجلات والبيانات الحساسة' }
];

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, isSuperAdmin, isLoading: authLoading } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Create Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [newPermissions, setNewPermissions] = useState<UserPermission[]>([
    'manage_groups',
    'manage_students',
    'manage_attendance'
  ]);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('admin');
  const [editPermissions, setEditPermissions] = useState<UserPermission[]>([]);
  const [editPassword, setEditPassword] = useState('');

  // Fetch users from API (Strict Super Admin protected)
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        if (res.status === 403) {
          setErrorMsg('غير مصرح لك بالوصول: هذه الصفحة مخصصة فقط للمسؤول الرئيسي (Super Admin).');
        } else {
          setErrorMsg('فشل في جلب قائمة الحسابات');
        }
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      fetchUsers();
    }
  }, [authLoading, isSuperAdmin, fetchUsers]);

  // Create new admin account
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          name: newName.trim() || newUsername.trim(),
          role: newRole,
          permissions: newRole === 'super_admin' ? ['all'] : newPermissions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'فشل في إنشاء الحساب');
        return;
      }

      setSuccessMsg(`تم إنشاء حساب ${data.user.name || data.user.username} بنجاح!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsCreateOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewRole('admin');
      fetchUsers();
    } catch (err: any) {
      alert(err?.message || 'خطأ في الشبكة');
    }
  };

  // Open Edit Modal
  const openEditModal = (target: User) => {
    setSelectedUser(target);
    setEditName(target.name || '');
    setEditRole(target.role);
    setEditPermissions(target.permissions || []);
    setEditPassword('');
    setIsEditOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const body: any = {
        name: editName.trim(),
        role: editRole,
        permissions: editRole === 'super_admin' ? ['all'] : editPermissions
      };
      if (editPassword.trim()) {
        body.password = editPassword.trim();
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'فشل في تحديث الحساب');
        return;
      }

      setSuccessMsg(`تم تحديث بيانات ${selectedUser.username} بنجاح!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsEditOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err?.message || 'خطأ في الشبكة');
    }
  };

  // Delete user
  const handleDelete = async (target: User) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المسؤول "${target.name || target.username}" نهائياً؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'فشل في حذف الحساب');
        return;
      }

      setSuccessMsg('تم حذف الحساب بنجاح');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchUsers();
    } catch (err: any) {
      alert(err?.message || 'خطأ في الشبكة');
    }
  };

  // Toggle permission helper
  const togglePermission = (permId: UserPermission, current: UserPermission[], setter: (v: UserPermission[]) => void) => {
    if (current.includes(permId)) {
      setter(current.filter((p) => p !== permId));
    } else {
      setter([...current, permId]);
    }
  };

  // Guard: If not super admin, render Access Denied
  if (!authLoading && !isSuperAdmin) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div
          className="m3-card"
          style={{
            padding: '40px 24px',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            borderRadius: '24px',
            border: '1px solid #ef4444'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c', marginBottom: '8px' }}>
            وصول محظور (Access Denied)
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '24px' }}>
            لوحة إدارة المسؤولين مخصصة حصرياً لرتبة المسؤول الرئيسي (Super Admin).
            حسابك الحالي لا يمتلك الصلاحيات الكافية لعرض أو تعديل هذه الصفحة.
          </p>
          <Link
            href="/admin"
            className="m3-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              textDecoration: 'none',
              fontWeight: 700
            }}
          >
            <span>العودة للإعدادات العامة</span>
            <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div
        className="m3-card"
        style={{
          padding: '24px 28px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderRadius: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                padding: '3px 10px',
                borderRadius: 'var(--md-shape-full)'
              }}
            >
              Super Admin Control
            </span>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)', margin: 0 }}>
              إدارة المسؤولين والأذونات (RBAC)
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
            إنشاء حسابات المسؤولين، تعيين الصلاحيات الدقيقة، وحماية النظام من التعديلات غير المصرح بها
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="m3-btn"
            style={{
              height: '42px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 18px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <UserPlus size={18} />
            <span>إضافة مسؤول جديد</span>
          </button>

          <Link
            href="/admin"
            className="m3-btn"
            style={{
              height: '42px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <span>العودة للإعدادات</span>
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '14px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid #22c55e',
            color: '#15803d',
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '14px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#b91c1c',
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Users Table Card */}
      <div
        className="m3-card"
        style={{
          padding: '24px',
          backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
          borderRadius: '20px',
          border: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            قائمة حسابات المسؤولين ({users.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            كل جهاز/حاسوب يحافظ على جلسته الخاصة بشكل آمن
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--md-sys-color-outline)' }}>
            جاري تحميل الحسابات...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--md-sys-color-outline)' }}>
            لا توجد حسابات مسؤوليـن
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 14px' }}>المستخدم</th>
                  <th style={{ padding: '12px 14px' }}>الاسم الكامل</th>
                  <th style={{ padding: '12px 14px' }}>الرتبة (Role)</th>
                  <th style={{ padding: '12px 14px' }}>الصلاحيات المفعلة</th>
                  <th style={{ padding: '12px 14px' }}>تاريخ الإنشاء</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrent = user?.id === u.id;
                  const isSuper = u.role === 'super_admin';

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '14px', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isSuper
                                ? 'var(--md-sys-color-primary-container)'
                                : 'var(--md-sys-color-surface-container-high)',
                              color: isSuper
                                ? 'var(--md-sys-color-primary)'
                                : 'var(--md-sys-color-on-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Shield size={16} />
                          </div>
                          <span>{u.username}</span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--status-present-container)',
                                color: 'var(--status-present)',
                                fontWeight: 800
                              }}
                            >
                              حسابك الحالي
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px', fontSize: '0.9rem' }}>
                        {u.name || u.username}
                      </td>

                      <td style={{ padding: '14px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 'var(--md-shape-full)',
                            backgroundColor: isSuper
                              ? 'rgba(147, 51, 234, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                            color: isSuper ? '#9333ea' : '#2563eb'
                          }}
                        >
                          {isSuper ? 'مسؤول رئيسي (super_admin)' : 'مسؤول (admin)'}
                        </span>
                      </td>

                      <td style={{ padding: '14px' }}>
                        {isSuper || (u.permissions && u.permissions.includes('all')) ? (
                          <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>
                            كافة الصلاحيات (Full Access)
                          </span>
                        ) : u.permissions && u.permissions.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '320px' }}>
                            {u.permissions.map((p) => {
                              const found = AVAILABLE_PERMISSIONS.find((item) => item.id === p);
                              return (
                                <span
                                  key={p}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--md-sys-color-surface-container)',
                                    color: 'var(--md-sys-color-on-surface-variant)'
                                  }}
                                >
                                  {found?.label || p}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                            لا توجد صلاحيات محددة
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px', fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-DZ') : '-'}
                      </td>

                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => openEditModal(u)}
                            className="m3-btn"
                            title="تعديل الصلاحيات وكلمة المرور"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--md-sys-color-surface-container-high)',
                              border: '1px solid var(--md-sys-color-outline-variant)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem'
                            }}
                          >
                            <Edit2 size={14} />
                            <span>تعديل</span>
                          </button>

                          <button
                            onClick={() => handleDelete(u)}
                            disabled={isCurrent}
                            className="m3-btn"
                            title={isCurrent ? 'لا يمكنك حذف حسابك الحالي' : 'حذف هذا المسؤول'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              backgroundColor: isCurrent ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                              color: isCurrent ? 'var(--md-sys-color-outline)' : '#ef4444',
                              border: isCurrent ? 'none' : '1px solid rgba(239, 68, 68, 0.3)',
                              cursor: isCurrent ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create New Admin Account */}
      {isCreateOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div
            className="m3-card"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
              borderRadius: '24px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>إنشاء حساب مسؤول جديد</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                    تحديد اسم المستخدم، كلمة المرور والصلاحيات
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--md-sys-color-outline)'
                }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="مثال: admin_bac"
                  required
                  className="m3-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  الاسم الكامل / المعرف الظاهر
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: مسؤول الاستقبال"
                  className="m3-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  كلمة المرور *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة مرور قوية (3 أحرف على الأقل)"
                  required
                  className="m3-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  الرتبة (Role) *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: newRole === 'admin' ? '2px solid #2563eb' : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: newRole === 'admin' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: 700
                    }}
                  >
                    <div style={{ color: '#2563eb', fontSize: '0.95rem' }}>مسؤول (Admin)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
                      صلاحيات تشغيلية محددة
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('super_admin')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: newRole === 'super_admin' ? '2px solid #9333ea' : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: newRole === 'super_admin' ? 'rgba(147, 51, 234, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: 700
                    }}
                  >
                    <div style={{ color: '#9333ea', fontSize: '0.95rem' }}>مسؤول رئيسي (Super Admin)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
                      تحكم كامل وإدارة المسؤولين
                    </div>
                  </button>
                </div>
              </div>

              {/* Granular Permissions (only if role is standard admin) */}
              {newRole === 'admin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                    الصلاحيات الممنوحة:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {AVAILABLE_PERMISSIONS.map((p) => {
                      const isChecked = newPermissions.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: isChecked ? 'var(--md-sys-color-surface-container)' : 'transparent',
                            border: '1px solid var(--md-sys-color-outline-variant)',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(p.id, newPermissions, setNewPermissions)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                              {p.desc}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="m3-btn"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="m3-btn"
                  style={{
                    padding: '10px 24px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  حفظ وإنشاء الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Admin */}
      {isEditOpen && selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div
            className="m3-card"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
              borderRadius: '24px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    تعديل حساب: {selectedUser.username}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                    تعديل الرتبة، الصلاحيات، أو تعيين كلمة مرور جديدة
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--md-sys-color-outline)'
                }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  الاسم الكامل / المعرف الظاهر
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="m3-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  تعيين كلمة مرور جديدة (اتركه فارغاً لعدم التغيير)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="كلمة مرور جديدة (اختياري)"
                  className="m3-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  الرتبة (Role)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditRole('admin')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: editRole === 'admin' ? '2px solid #2563eb' : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: editRole === 'admin' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: 700
                    }}
                  >
                    <div style={{ color: '#2563eb', fontSize: '0.95rem' }}>مسؤول (Admin)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditRole('super_admin')}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: editRole === 'super_admin' ? '2px solid #9333ea' : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: editRole === 'super_admin' ? 'rgba(147, 51, 234, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: 700
                    }}
                  >
                    <div style={{ color: '#9333ea', fontSize: '0.95rem' }}>مسؤول رئيسي (Super Admin)</div>
                  </button>
                </div>
              </div>

              {editRole === 'admin' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                    الصلاحيات:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {AVAILABLE_PERMISSIONS.map((p) => {
                      const isChecked = editPermissions.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: isChecked ? 'var(--md-sys-color-surface-container)' : 'transparent',
                            border: '1px solid var(--md-sys-color-outline-variant)',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(p.id, editPermissions, setEditPermissions)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                              {p.desc}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="m3-btn"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="m3-btn"
                  style={{
                    padding: '10px 24px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
