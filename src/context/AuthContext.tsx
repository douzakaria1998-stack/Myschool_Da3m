'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, UserPermission } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  hasPermission: (permission: UserPermission) => boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current session from server on mount
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          localStorage.setItem('da3m_cached_user_role', data.user.role);
          return;
        }
      }
      setUser(null);
      localStorage.removeItem('da3m_cached_user_role');
    } catch (e) {
      console.warn('Failed to verify session on startup:', e);
      // Fallback to local role cache if offline
      const cachedRole = localStorage.getItem('da3m_cached_user_role') as UserRole;
      if (cachedRole) {
        setUser({
          id: 'offline_user',
          username: cachedRole === 'super_admin' ? 'superadmin' : 'admin',
          role: cachedRole,
          name: cachedRole === 'super_admin' ? 'المسؤول الرئيسي' : 'مسؤول النظام',
          permissions: ['all'],
          createdAt: new Date().toISOString()
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'فشل تسجيل الدخول' };
      }

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('da3m_cached_user_role', data.user.role);
        return { success: true };
      }

      return { success: false, error: 'استجابة غير صالحة من الخادم' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    localStorage.removeItem('da3m_cached_user_role');
  };

  const hasPermission = (permission: UserPermission): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.permissions.includes('all')) return true;
    return user.permissions.includes(permission);
  };

  const role = user?.role || null;
  const isAuthenticated = Boolean(user);
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        isSuperAdmin,
        isAdmin,
        hasPermission,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
