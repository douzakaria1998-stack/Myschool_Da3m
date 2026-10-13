import crypto from 'crypto';

const SECRET_KEY = process.env.AUTH_SECRET || 'da3m_secure_jwt_secret_key_2026_superadmin';

/**
 * Hashes a password with a cryptographically secure random salt using scrypt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt
  };
}

/**
 * Verifies a password against the stored hash and salt in constant time
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (keyBuffer.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(keyBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates an opaque cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates an HMAC signature for a token to prevent tampering
 */
export function signSessionToken(token: string): string {
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(token);
  const signature = hmac.digest('hex');
  return `${token}.${signature}`;
}

/**
 * Verifies a signed session token
 */
export function verifySignedSessionToken(signedToken: string): string | null {
  if (!signedToken || !signedToken.includes('.')) return null;
  const [token, signature] = signedToken.split('.');
  if (!token || !signature) return null;

  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(token);
  const expectedSignature = hmac.digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expBuffer.length) return null;

  if (crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return token;
  }
  return null;
}
