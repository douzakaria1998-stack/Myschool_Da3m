export type UserRole = 'super_admin' | 'admin' | 'user';

export type UserPermission =
  | 'manage_groups'
  | 'manage_students'
  | 'manage_attendance'
  | 'manage_teachers'
  | 'manage_finances'
  | 'view_reports'
  | 'delete_records'
  | 'system_settings'
  | 'all';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name?: string;
  permissions: UserPermission[];
  createdAt: string;
  updatedAt?: string;
}

export interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  username: string;
  role: UserRole;
  name?: string;
  permissions: UserPermission[];
  createdAt: number;
  expiresAt: number;
}
