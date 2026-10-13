'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import {
  Settings,
  ShieldAlert,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Lock,
  Save,
  Tag,
  ShieldCheck,
  UserPlus,
  Users,
  Shield,
  Trash2,
  Key,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { PricingTier } from '../../types';
import { User, UserRole, UserPermission } from '../../types/auth';

const AVAILABLE_PERMISSIONS: { id: UserPermission; label: string; desc: string }[] = [
  { id: 'manage_groups', label: 'إدارة الأفواج', desc: 'إضافة وتعديل وحذف الأفواج' },
  { id: 'manage_students', label: 'إدارة التلاميذ', desc: 'تسجيل وتحويل وحذف التلاميذ' },
  { id: 'manage_attendance', label: 'تسجيل الحضور', desc: 'تسجيل حضور وغياب الحصص' },
  { id: 'manage_teachers', label: 'إدارة الأساتذة', desc: 'تسديد مستحقات الأساتذة' },
  { id: 'manage_finances', label: 'المالية والأسعار', desc: 'تعديل تسعيرة الحصص' },
  { id: 'view_reports', label: 'عرض التقارير', desc: 'الاطلاع على الإحصائيات' },
  { id: 'delete_records', label: 'صلاحيات الحذف', desc: 'حذف السجلات الحساسة' }
];

export default function AdminPage() {
  const { data, updatePricingTier, exportDataJson, importDataJson, resetToDefault } = useApp();
  const { user, isSuperAdmin, isAdmin, login } = useAuth();

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Super Admin: Add Admin Form State
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isAddAdminFormOpen, setIsAddAdminFormOpen] = useState(true);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<UserRole>('admin');
  const [newAdminPermissions, setNewAdminPermissions] = useState<UserPermission[]>([
    'manage_groups',
    'manage_students',
    'manage_attendance'
  ]);
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [createAdminSuccess, setCreateAdminSuccess] = useState('');
  const [createAdminError, setCreateAdminError] = useState('');

  // Automatically unlock if authenticated as admin or super_admin
  useEffect(() => {
    if (isAdmin || isSuperAdmin) {
      setIsAdminUnlocked(true);
    }
  }, [isAdmin, isSuperAdmin]);

  // Fetch admin accounts list
  const fetchAdminUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const json = await res.json();
        setAdminUsers(json.users || []);
      }
    } catch {
      // Ignore if offline
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdminUsers();
    }
  }, [isSuperAdmin, fetchAdminUsers]);

  // Unlock Admin
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinInput.trim();
    if (pin === '777' || pin === data.credentials?.adminPass) {
      await login('superadmin', '777');
      setIsAdminUnlocked(true);
      setPinError('');
    } else if (pin === '123' || pin === data.credentials?.userPass) {
      await login('admin1', '123');
      setIsAdminUnlocked(true);
      setPinError('');
    } else {
      setPinError('كلمة المرور غير صحيحة. كلمة مرور الإدارة الافتراضية هي 777');
    }
  };

  // Create New Admin Account
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      setCreateAdminError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setCreateAdminLoading(true);
    setCreateAdminError('');
    setCreateAdminSuccess('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUsername.trim(),
          password: newAdminPassword.trim(),
          name: newAdminName.trim() || newAdminUsername.trim(),
          role: newAdminRole,
          permissions: newAdminRole === 'super_admin' ? ['all'] : newAdminPermissions
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        setCreateAdminError(resData.error || 'فشل في إنشاء الحساب');
        return;
      }

      setCreateAdminSuccess(`تمت إضافة المسؤول "${resData.user?.name || resData.user?.username}" بنجاح!`);
      setTimeout(() => setCreateAdminSuccess(''), 5000);
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminName('');
      setNewAdminRole('admin');
      fetchAdminUsers();
    } catch (err: any) {
      setCreateAdminError(err?.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setCreateAdminLoading(false);
    }
  };

  // Delete Admin Account
  const handleDeleteAdmin = async (targetUser: User) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المسؤول "${targetUser.name || targetUser.username}"؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, { method: 'DELETE' });
      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'فشل في حذف الحساب');
        return;
      }
      fetchAdminUsers();
    } catch (err: any) {
      alert(err?.message || 'خطأ في الاتصال');
    }
  };

  // Toggle permission helper
  const togglePermission = (permId: UserPermission) => {
    if (newAdminPermissions.includes(permId)) {
      setNewAdminPermissions(newAdminPermissions.filter((p) => p !== permId));
    } else {
      setNewAdminPermissions([...newAdminPermissions, permId]);
    }
  };

  // Pricing tier edit handler
  const handleTierChange = (tierId: string, field: keyof PricingTier, value: number | string) => {
    updatePricingTier(tierId, { [field]: Number(value) });
  };

  // Import JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJson(content);
        if (success) {
          setSuccessMessage('تم استرجاع قاعدة البيانات بنجاح!');
          setTimeout(() => setSuccessMessage(''), 4000);
        } else {
          alert('الملف غير صالح أو تالف');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div
        className="m3-card"
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            إدارة الأسعار والإعدادات العامة
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            تعديل تسعيرة الحصص، نسب تقاسم الأرباح مع الأساتذة، إدارة المسؤولين والنسخ الاحتياطي
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSuperAdmin && (
            <Link
              href="/admin/users"
              className="m3-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--md-shape-full)',
                backgroundColor: 'rgba(147, 51, 234, 0.15)',
                color: '#9333ea',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              <ShieldCheck size={16} />
              <span>لوحة تحكم المسؤولين المتقدمة</span>
            </Link>
          )}

          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 'var(--md-shape-sm)',
              backgroundColor: isAdminUnlocked
                ? 'var(--status-present-container)'
                : 'var(--md-sys-color-surface-container-high)',
              color: isAdminUnlocked ? 'var(--status-present)' : 'var(--md-sys-color-outline)'
            }}
          >
            {isAdminUnlocked ? 'وضع المسؤول مفعّل ✓' : 'وضع القراءة فقط 🔒'}
          </span>
        </div>
      </div>

      {/* PIN Unlock Card if locked */}
      {!isAdminUnlocked && (
        <div
          className="m3-card"
          style={{
            padding: '24px',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            textAlign: 'center',
            maxWidth: '440px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}
          >
            <Lock size={24} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>تسجيل دخول المسؤول</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
            أدخل كلمة مرور المسؤول (Admin Pass) لتعديل الأسعار وإدارة الحسابات
          </p>

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="كلمة المرور (777 للمسؤول الرئيسي)"
              className="m3-input"
              style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.1rem' }}
              autoFocus
            />
            {pinError && (
              <div style={{ color: 'var(--md-sys-color-error)', fontSize: '0.8rem' }}>{pinError}</div>
            )}
            <button type="submit" className="m3-btn m3-btn-primary">
              تأكيد الدخول
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUPER ADMIN: Dedicated Place to Add New Admin & Manage Roles Directly in Settings */}
      {/* ========================================================================= */}
      <div
        className="m3-card"
        style={{
          padding: '24px',
          backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
          border: isSuperAdmin ? '1px solid rgba(147, 51, 234, 0.35)' : '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: '20px',
          position: 'relative'
        }}
      >
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                backgroundColor: isSuperAdmin ? 'rgba(147, 51, 234, 0.15)' : 'var(--md-sys-color-surface-container)',
                color: isSuperAdmin ? '#9333ea' : 'var(--md-sys-color-outline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <UserPlus size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  إضافة وإدارة مسؤولي النظام (Admin Accounts)
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: isSuperAdmin ? 'rgba(147, 51, 234, 0.15)' : 'var(--md-sys-color-surface-container)',
                    color: isSuperAdmin ? '#9333ea' : 'var(--md-sys-color-outline)'
                  }}
                >
                  خاص بالمسؤول الرئيسي (Super Admin)
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', margin: '4px 0 0' }}>
                يمكن للمسؤول الرئيسي إنشاء حسابات مسؤولين جديدة ومنحهم الصلاحيات التشغيلية المناسبة
              </p>
            </div>
          </div>

          {isSuperAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsAddAdminFormOpen(!isAddAdminFormOpen)}
                className="m3-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--md-shape-full)',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  cursor: 'pointer'
                }}
              >
                {isAddAdminFormOpen ? <ChevronUp size={16} /> : <Plus size={16} />}
                <span>{isAddAdminFormOpen ? 'إخفاء نموذج الإضافة' : 'إضافة مسؤول جديد'}</span>
              </button>

              <Link
                href="/admin/users"
                className="m3-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--md-shape-full)',
                  backgroundColor: 'rgba(147, 51, 234, 0.12)',
                  color: '#9333ea',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid rgba(147, 51, 234, 0.25)'
                }}
              >
                <Users size={16} />
                <span>إدارة الصلاحيات الشاملة</span>
              </Link>
            </div>
          )}
        </div>

        {/* If NOT super_admin: Prompt to unlock with Super Admin credentials */}
        {!isSuperAdmin ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px dashed var(--md-sys-color-outline-variant)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                color: '#9333ea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px'
              }}
            >
              <Lock size={20} />
            </div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '6px' }}>
              ميزة مخصصة للمسؤول الرئيسي فقط
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '500px', margin: '0 auto 16px' }}>
              لإضافة حسابات مسؤولين جديدة، يرجى إدخال كلمة مرور المسؤول الرئيسي (الافتراضية: 777) أو تسجيل الدخول بحساب Super Admin
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleUnlock(e);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '320px', width: '100%' }}
            >
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="أدخل كلمة المرور (777)"
                className="m3-input"
                style={{ textAlign: 'center', letterSpacing: '3px' }}
              />
              <button type="submit" className="m3-btn m3-btn-primary" style={{ whiteSpace: 'nowrap' }}>
                تفعيل
              </button>
            </form>
          </div>
        ) : (
          /* ACTIVE SUPER ADMIN SECTION */
          <div>
            {/* Success / Error Alerts */}
            {createAdminSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid #22c55e',
                  color: '#15803d',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}
              >
                <CheckCircle2 size={18} />
                <span>{createAdminSuccess}</span>
              </div>
            )}

            {createAdminError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  color: '#b91c1c',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}
              >
                <AlertCircle size={18} />
                <span>{createAdminError}</span>
              </div>
            )}

            {/* Form: Add New Admin */}
            {isAddAdminFormOpen && (
              <form
                onSubmit={handleCreateAdmin}
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  marginBottom: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--md-sys-color-outline-variant)', paddingBottom: '10px' }}>
                  <UserPlus size={18} color="#9333ea" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>بيانات المسؤول الجديد</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      اسم المستخدم (Username) *
                    </label>
                    <input
                      type="text"
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      placeholder="مثال: admin_assistant"
                      required
                      className="m3-input"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      الاسم الكامل / الصفة
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="مثال: أحمد - إدارة الاستقبال"
                      className="m3-input"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      كلمة المرور *
                    </label>
                    <input
                      type="password"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="كلمة مرور الدخول"
                      required
                      className="m3-input"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                      الرتبة (Role) *
                    </label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as UserRole)}
                      className="m3-input"
                      style={{ width: '100%', height: '42px', fontWeight: 700 }}
                    >
                      <option value="admin">مسؤول عادي (Admin)</option>
                      <option value="super_admin">مسؤول رئيسي (Super Admin)</option>
                    </select>
                  </div>
                </div>

                {/* Granular Permissions Checkboxes */}
                {newAdminRole === 'admin' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>
                      تحديد الصلاحيات الممنوحة لهذا المسؤول:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                      {AVAILABLE_PERMISSIONS.map((p) => {
                        const isChecked = newAdminPermissions.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: isChecked ? 'rgba(147, 51, 234, 0.08)' : 'var(--md-sys-color-surface-container-high)',
                              border: isChecked ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid var(--md-sys-color-outline-variant)',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(p.id)}
                              style={{ width: '15px', height: '15px' }}
                            />
                            <span style={{ fontWeight: isChecked ? 700 : 500 }}>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="submit"
                    disabled={createAdminLoading}
                    className="m3-btn"
                    style={{
                      height: '42px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 24px',
                      borderRadius: 'var(--md-shape-full)',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: createAdminLoading ? 'default' : 'pointer',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  >
                    <UserPlus size={18} />
                    <span>{createAdminLoading ? 'جاري الإضافة...' : 'إضافة وتفعيل الحساب'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* List of existing Administrators */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface-variant)' }}>
                  المسؤولون المسجلون في النظام ({adminUsers.length}):
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                  كل مسؤول يمكنه تسجيل الدخول من حاسوبه بشكل مستقل
                </span>
              </div>

              {loadingUsers ? (
                <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.85rem', color: 'var(--md-sys-color-outline)' }}>
                  جاري تحميل المسؤولين...
                </div>
              ) : adminUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.85rem', color: 'var(--md-sys-color-outline)' }}>
                  لا توجد حسابات مسؤوليـن
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {adminUsers.map((u) => {
                    const isSelf = user?.id === u.id;
                    const isSuper = u.role === 'super_admin';

                    return (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--md-sys-color-surface-container)',
                          border: '1px solid var(--md-sys-color-outline-variant)',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: isSuper ? 'rgba(147, 51, 234, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: isSuper ? '#9333ea' : '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Shield size={16} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{u.username}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                                ({u.name || u.username})
                              </span>
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--status-present-container)',
                                    color: 'var(--status-present)'
                                  }}
                                >
                                  أنت
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', marginTop: '2px' }}>
                              {isSuper
                                ? 'مسؤول رئيسي (كامل الصلاحيات)'
                                : `مسؤول عادي - ${u.permissions?.length || 0} صلاحيات مفعلة`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 'var(--md-shape-full)',
                              backgroundColor: isSuper ? 'rgba(147, 51, 234, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: isSuper ? '#9333ea' : '#2563eb'
                            }}
                          >
                            {isSuper ? 'Super Admin' : 'Admin'}
                          </span>

                          <button
                            onClick={() => handleDeleteAdmin(u)}
                            disabled={isSelf}
                            title={isSelf ? 'لا يمكنك حذف حسابك الحالي' : 'حذف هذا المسؤول'}
                            className="m3-btn"
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              backgroundColor: isSelf ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                              color: isSelf ? 'var(--md-sys-color-outline)' : '#ef4444',
                              border: isSelf ? 'none' : '1px solid rgba(239, 68, 68, 0.3)',
                              cursor: isSelf ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pricing Tiers Table */}
      <div className="m3-card" style={{ padding: '24px', backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>خطط التسعير ونسب اقتسام الأرباح</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              تغيير هذه القيم يُعاد احتسابه تلقائياً في كافة كشوف الحضور والمالية
            </p>
          </div>
          <Tag size={20} color="var(--md-sys-color-primary)" />
        </div>

        <div className="m3-table-container">
          <table className="m3-table">
            <thead>
              <tr>
                <th>رمز الخطة</th>
                <th>اسم الخطة</th>
                <th style={{ textAlign: 'center' }}>الحصص</th>
                <th style={{ textAlign: 'center' }}>المبلغ الإجمالي (دج)</th>
                <th style={{ textAlign: 'center' }}>حصة الأستاذ (دج)</th>
                <th style={{ textAlign: 'center' }}>حصة المركز (دج)</th>
                <th style={{ textAlign: 'center' }}>نسبة الأستاذ</th>
              </tr>
            </thead>
            <tbody>
              {data.pricingTiers.map((tier) => {
                const teacherPercentage = tier.price > 0 ? Math.round((tier.teacherRate / tier.price) * 100) : 0;

                return (
                  <tr key={tier.id}>
                    <td style={{ fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>{tier.id}</td>
                    <td style={{ fontWeight: 600 }}>{tier.name}</td>
                    <td style={{ textAlign: 'center' }}>{tier.sessions}</td>

                    {/* Price Input */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdminUnlocked ? (
                        <input
                          type="number"
                          value={tier.price}
                          onChange={(e) => handleTierChange(tier.id, 'price', e.target.value)}
                          className="m3-input"
                          style={{ width: '90px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      ) : (
                        <strong>{tier.price} دج</strong>
                      )}
                    </td>

                    {/* Teacher Rate Input */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdminUnlocked ? (
                        <input
                          type="number"
                          value={tier.teacherRate}
                          onChange={(e) => handleTierChange(tier.id, 'teacherRate', e.target.value)}
                          className="m3-input"
                          style={{ width: '90px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-secondary)' }}>{tier.teacherRate} دج</span>
                      )}
                    </td>

                    {/* School Rate Input */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdminUnlocked ? (
                        <input
                          type="number"
                          value={tier.schoolRate}
                          onChange={(e) => handleTierChange(tier.id, 'schoolRate', e.target.value)}
                          className="m3-input"
                          style={{ width: '90px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                          {tier.schoolRate} دج
                        </span>
                      )}
                    </td>

                    {/* Percentage */}
                    <td style={{ textAlign: 'center' }}>
                      <span className="m3-chip" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                        %{teacherPercentage} للأستاذ
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backup & Data Management */}
      <div className="m3-card" style={{ padding: '24px', backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>
          النسخ الاحتياطي وإدارة البيانات
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          يمكنك تصدير نسخة كاملة من البيانات لحفظها في حاسوبك أو استرجاع نسخة سابقة في أي وقت
        </p>

        {successMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--status-present-container)',
              color: 'var(--status-present)',
              borderRadius: 'var(--md-shape-sm)',
              fontWeight: 700,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={exportDataJson}
            className="m3-btn m3-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={18} />
            <span>تصدير نسخة احتياطية (Download JSON)</span>
          </button>

          <label
            className="m3-btn m3-btn-outlined"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Upload size={18} />
            <span>استيراد نسخة سابقة (Import JSON)</span>
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <button
            onClick={() => {
              if (
                confirm(
                  'تحذير: هل أنت متأكد من رغبتك في إعادة ضبط النظام إلى بيانات ملفات Excel الأصلية؟ سيتم إلغاء أي تعديلات محلية جديدة.'
                )
              ) {
                resetToDefault();
                setSuccessMessage('تم استرجاع البيانات الأصلية من ملفات Excel بنجاح!');
                setTimeout(() => setSuccessMessage(''), 3000);
              }
            }}
            className="m3-btn m3-btn-danger m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginInlineStart: 'auto' }}
          >
            <RotateCcw size={16} />
            <span>إعادة ضبط لقاعدة بيانات Excel الأصلية</span>
          </button>
        </div>
      </div>
    </div>
  );
}
