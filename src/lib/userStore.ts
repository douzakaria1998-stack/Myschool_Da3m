import fs from 'fs';
import path from 'path';
import { User, UserRecord, SessionData, UserRole, UserPermission } from '@/types/auth';
import { hashPassword, verifyPassword, generateSessionToken, signSessionToken, verifySignedSessionToken } from './authCrypto';
import { supabase } from './supabaseClient';

const USERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'usersStore.json');
const SESSIONS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'sessionsStore.json');

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

interface UsersDataFile {
  users: UserRecord[];
  migratedAt: string;
}

interface SessionsDataFile {
  sessions: Record<string, SessionData>;
}

// In-memory cache for fast lookups
let inMemoryUsers: UserRecord[] | null = null;
let inMemorySessions: Record<string, SessionData> | null = null;

function ensureDataDir() {
  const dir = path.dirname(USERS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Non-destructive initialization:
 * Ensures the users store exists and safely applies role migrations.
 * Never drops any existing user or table.
 */
function loadUsers(): UserRecord[] {
  if (inMemoryUsers) return inMemoryUsers;

  ensureDataDir();

  let users: UserRecord[] = [];

  if (fs.existsSync(USERS_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const parsed: UsersDataFile = JSON.parse(raw);
      users = parsed.users || [];

      // Non-destructive column verification:
      // If any user record lacks role or permissions, safely append defaults!
      let changed = false;
      users = users.map((u) => {
        let updated = false;
        const record = { ...u };
        if (!record.role) {
          record.role = 'user';
          updated = true;
        }
        if (!Array.isArray(record.permissions)) {
          record.permissions = [];
          updated = true;
        }
        if (updated) changed = true;
        return record;
      });

      if (changed) {
        saveUsersToFile(users);
      }
    } catch (e) {
      console.error('Failed to parse users store file:', e);
      users = [];
    }
  }

  // If empty, seed initial super_admin and admin accounts safely
  if (users.length === 0) {
    const superAdminCrypto = hashPassword('777');
    const adminCrypto = hashPassword('123');

    const superAdmin: UserRecord = {
      id: 'usr_superadmin_' + Date.now(),
      username: 'superadmin',
      passwordHash: superAdminCrypto.hash,
      salt: superAdminCrypto.salt,
      name: 'المسؤول الرئيسي (Super Admin)',
      role: 'super_admin',
      permissions: ['all'],
      createdAt: new Date().toISOString()
    };

    const standardAdmin: UserRecord = {
      id: 'usr_admin_' + Date.now(),
      username: 'admin1',
      passwordHash: adminCrypto.hash,
      salt: adminCrypto.salt,
      name: 'مسؤول النظام (Admin)',
      role: 'admin',
      permissions: [
        'manage_groups',
        'manage_students',
        'manage_attendance',
        'manage_teachers',
        'manage_finances'
      ],
      createdAt: new Date().toISOString()
    };

    users = [superAdmin, standardAdmin];
    saveUsersToFile(users);

    // Sync to Supabase users table non-destructively if accessible
    (async () => {
      try {
        await supabase.from('users').upsert([
          {
            id: superAdmin.id,
            username: superAdmin.username,
            password_hash: superAdmin.passwordHash,
            salt: superAdmin.salt,
            name: superAdmin.name,
            role: superAdmin.role,
            permissions: superAdmin.permissions
          },
          {
            id: standardAdmin.id,
            username: standardAdmin.username,
            password_hash: standardAdmin.passwordHash,
            salt: standardAdmin.salt,
            name: standardAdmin.name,
            role: standardAdmin.role,
            permissions: standardAdmin.permissions
          }
        ]);
      } catch (err) {
        // Non-blocking if Supabase is offline
      }
    })();
  }

  inMemoryUsers = users;
  return users;
}

function saveUsersToFile(users: UserRecord[]) {
  ensureDataDir();
  inMemoryUsers = users;
  const payload: UsersDataFile = {
    users,
    migratedAt: new Date().toISOString()
  };
  fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

function loadSessions(): Record<string, SessionData> {
  if (inMemorySessions) return inMemorySessions;

  ensureDataDir();
  let sessions: Record<string, SessionData> = {};

  if (fs.existsSync(SESSIONS_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8');
      const parsed: SessionsDataFile = JSON.parse(raw);
      sessions = parsed.sessions || {};
    } catch {
      sessions = {};
    }
  }

  // Purge expired sessions
  const now = Date.now();
  let changed = false;
  for (const [token, s] of Object.entries(sessions)) {
    if (s.expiresAt <= now) {
      delete sessions[token];
      changed = true;
    }
  }

  if (changed) {
    saveSessionsToFile(sessions);
  }

  inMemorySessions = sessions;
  return sessions;
}

function saveSessionsToFile(sessions: Record<string, SessionData>) {
  ensureDataDir();
  inMemorySessions = sessions;
  const payload: SessionsDataFile = { sessions };
  fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

export function sanitizeUser(record: UserRecord): User {
  const { passwordHash, salt, ...safeUser } = record;
  return safeUser;
}

export async function getAllUsers(): Promise<User[]> {
  const users = loadUsers();
  return users.map(sanitizeUser);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  return user || null;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const users = loadUsers();
  const clean = username.trim().toLowerCase();
  const user = users.find((u) => u.username.trim().toLowerCase() === clean);
  return user || null;
}

export async function createUser(params: {
  username: string;
  password: string;
  role?: UserRole;
  name?: string;
  permissions?: UserPermission[];
}): Promise<User> {
  const users = loadUsers();
  const cleanUsername = params.username.trim().toLowerCase();

  if (users.some((u) => u.username.trim().toLowerCase() === cleanUsername)) {
    throw new Error('اسم المستخدم موجود مسبقاً، يرجى اختيار اسم مستخدم آخر');
  }

  const { hash, salt } = hashPassword(params.password);
  const newUser: UserRecord = {
    id: 'usr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    username: cleanUsername,
    passwordHash: hash,
    salt,
    name: params.name || cleanUsername,
    role: params.role || 'user',
    permissions: params.permissions || [],
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsersToFile(users);

  // Sync to Supabase non-destructively
  (async () => {
    try {
      await supabase.from('users').upsert({
        id: newUser.id,
        username: newUser.username,
        password_hash: newUser.passwordHash,
        salt: newUser.salt,
        name: newUser.name,
        role: newUser.role,
        permissions: newUser.permissions
      });
    } catch {}
  })();

  return sanitizeUser(newUser);
}

export async function updateUser(
  id: string,
  updates: Partial<{
    role: UserRole;
    name: string;
    permissions: UserPermission[];
    password?: string;
  }>
): Promise<User | null> {
  const users = loadUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;

  const current = users[index];

  if (updates.role) {
    current.role = updates.role;
  }
  if (updates.name !== undefined) {
    current.name = updates.name;
  }
  if (Array.isArray(updates.permissions)) {
    current.permissions = updates.permissions;
  }
  if (updates.password && updates.password.trim().length > 0) {
    const { hash, salt } = hashPassword(updates.password.trim());
    current.passwordHash = hash;
    current.salt = salt;
  }
  current.updatedAt = new Date().toISOString();

  users[index] = current;
  saveUsersToFile(users);

  // Sync to Supabase
  (async () => {
    try {
      await supabase.from('users').update({
        name: current.name,
        role: current.role,
        permissions: current.permissions,
        ...(updates.password ? { password_hash: current.passwordHash, salt: current.salt } : {})
      }).eq('id', id);
    } catch {}
  })();

  return sanitizeUser(current);
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = loadUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return false;

  saveUsersToFile(filtered);

  // Sync to Supabase
  (async () => {
    try {
      await supabase.from('users').delete().eq('id', id);
    } catch {}
  })();

  return true;
}

/**
 * Creates an independent session for the authenticated laptop
 */
export async function createSession(userId: string): Promise<{
  token: string;
  signedToken: string;
  expiresAt: number;
  user: User;
}> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const sessions = loadSessions();
  const rawToken = generateSessionToken();
  const signedToken = signSessionToken(rawToken);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  const sessionData: SessionData = {
    sessionId: rawToken,
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    permissions: user.permissions,
    createdAt: now,
    expiresAt
  };

  sessions[rawToken] = sessionData;
  saveSessionsToFile(sessions);

  return {
    token: rawToken,
    signedToken,
    expiresAt,
    user: sanitizeUser(user)
  };
}

/**
 * Validates a session token (signed or raw) and returns user session data
 */
export async function validateSession(tokenOrSignedToken: string): Promise<{
  user: User;
  session: SessionData;
} | null> {
  if (!tokenOrSignedToken) return null;

  let rawToken = tokenOrSignedToken;
  if (tokenOrSignedToken.includes('.')) {
    const verified = verifySignedSessionToken(tokenOrSignedToken);
    if (!verified) return null;
    rawToken = verified;
  }

  const sessions = loadSessions();
  const session = sessions[rawToken];
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    delete sessions[rawToken];
    saveSessionsToFile(sessions);
    return null;
  }

  const userRecord = await getUserById(session.userId);
  if (!userRecord) return null;

  return {
    user: sanitizeUser(userRecord),
    session
  };
}

/**
 * Destroys a session on logout
 */
export async function destroySession(tokenOrSignedToken: string): Promise<void> {
  if (!tokenOrSignedToken) return;

  let rawToken = tokenOrSignedToken;
  if (tokenOrSignedToken.includes('.')) {
    rawToken = tokenOrSignedToken.split('.')[0];
  }

  const sessions = loadSessions();
  if (sessions[rawToken]) {
    delete sessions[rawToken];
    saveSessionsToFile(sessions);
  }
}
