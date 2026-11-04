import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabase';
import { VALID_BATCHES, ValidBatch } from './types';

const COOKIE_NAME = 'unischedule_session';
const LEGACY_COOKIE_NAME = 'unischedule_admin_session';

const ADMIN_CREDENTIAL_ID = 'default';
const ADMIN_CREDENTIALS_PATH = path.join(process.cwd(), 'data', 'admin-credentials.json');
const CR_CREDENTIALS_PATH = path.join(process.cwd(), 'data', 'cr-credentials.json');

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'development-session-secret-class-schedule-2026';
const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminKYAU';

export type SessionUser =
  | { role: 'admin'; username: string }
  | { role: 'cr'; username: string; batch: ValidBatch };

export interface CrAccountInfo {
  batch: ValidBatch;
  username: string;
}

// Canonical CR Usernames for the 9 Batches
export const CR_ACCOUNTS: Record<ValidBatch, string> = {
  '15': 'cr-15',
  '16': 'cr-16',
  '17': 'cr-17',
  '18': 'cr-18',
  '19': 'cr-19',
  '20': 'cr-20',
  '21': 'cr-21',
  '22-A': 'cr-22a',
  '22-B': 'cr-22b',
};

// Default passwords accepted for first-time sign in
const DEFAULT_CR_PASSWORDS: Record<ValidBatch, string[]> = {
  '15': ['cr123', 'key-15', 'cr-15', '15'],
  '16': ['cr123', 'key-16', 'cr-16', '16'],
  '17': ['cr123', 'key-17', 'cr-17', '17'],
  '18': ['cr123', 'key-18', 'cr-18', '18'],
  '19': ['cr123', 'key-19', 'cr-19', '19'],
  '20': ['cr123', 'key-20', 'cr-20', '20'],
  '21': ['cr123', 'key-21', 'cr-21', '21'],
  '22-A': ['cr123', 'key-22a', 'cr-22a', 'cr22a', '22-a', '22a'],
  '22-B': ['cr123', 'key-22b', 'cr-22b', 'cr22b', '22-b', '22b'],
};

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const [salt, expected] = encodedHash.split(':');
  if (!salt || !expected) return false;
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

// ---------------- Admin Credentials ----------------
type AdminCredentials = { passwordHash: string };

async function readAdminCredentials(): Promise<AdminCredentials> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('admin_credentials')
        .select('password_hash')
        .eq('id', ADMIN_CREDENTIAL_ID)
        .maybeSingle();
      if (data?.password_hash) return { passwordHash: data.password_hash };
    } catch (err) {
      console.error('Error reading admin credentials from Supabase:', err);
    }
  }

  try {
    if (fs.existsSync(ADMIN_CREDENTIALS_PATH)) {
      return JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_PATH, 'utf8')) as AdminCredentials;
    }
  } catch (error) {
    console.error('Unable to read admin credentials locally:', error);
  }

  return { passwordHash: hashPassword(INITIAL_ADMIN_PASSWORD, 'initial-admin-salt') };
}

async function writeAdminCredentials(credentials: AdminCredentials): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('admin_credentials').upsert({
        id: ADMIN_CREDENTIAL_ID,
        password_hash: credentials.passwordHash,
        updated_at: new Date().toISOString(),
      });
      if (!error) return;
      console.error('Unable to persist admin credentials in Supabase:', error.message);
    } catch (err) {
      console.error('Supabase exception saving admin credentials:', err);
    }
  }

  try {
    fs.mkdirSync(path.dirname(ADMIN_CREDENTIALS_PATH), { recursive: true });
    fs.writeFileSync(ADMIN_CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf8');
  } catch (error) {
    console.error('Unable to persist admin credentials locally:', error);
    throw new Error('Unable to save new admin password.');
  }
}

// ---------------- CR Credentials ----------------
type CrCredentialRecord = {
  batch: ValidBatch;
  username: string;
  passwordHash: string;
  updatedAt?: string;
};
type CrCredentialsMap = Record<string, CrCredentialRecord>;

async function readCrCredentialsMap(): Promise<CrCredentialsMap> {
  const map: CrCredentialsMap = {};

  if (supabase) {
    try {
      const { data } = await supabase.from('cr_credentials').select('*');
      if (Array.isArray(data)) {
        for (const row of data) {
          if (row.batch && row.password_hash) {
            map[row.batch] = {
              batch: row.batch as ValidBatch,
              username: row.username || CR_ACCOUNTS[row.batch as ValidBatch] || `cr-${row.batch}`,
              passwordHash: row.password_hash,
              updatedAt: row.updated_at,
            };
          }
        }
      }
    } catch (err) {
      // Supabase table might not exist yet, fallback to local
    }
  }

  try {
    if (fs.existsSync(CR_CREDENTIALS_PATH)) {
      const local = JSON.parse(fs.readFileSync(CR_CREDENTIALS_PATH, 'utf8')) as CrCredentialsMap;
      return { ...local, ...map };
    }
  } catch (error) {
    console.error('Unable to read cr-credentials locally:', error);
  }

  return map;
}

async function writeCrCredential(record: CrCredentialRecord): Promise<void> {
  if (supabase) {
    try {
      const { error } = await supabase.from('cr_credentials').upsert({
        batch: record.batch,
        username: record.username,
        password_hash: record.passwordHash,
        updated_at: new Date().toISOString(),
      });
      if (!error) {
        // Also update local copy for offline fallback
      }
    } catch (err) {
      console.error('Error saving CR credentials to Supabase:', err);
    }
  }

  try {
    const existing = await readCrCredentialsMap();
    existing[record.batch] = record;
    fs.mkdirSync(path.dirname(CR_CREDENTIALS_PATH), { recursive: true });
    fs.writeFileSync(CR_CREDENTIALS_PATH, JSON.stringify(existing, null, 2), 'utf8');
  } catch (err) {
    console.error('Unable to write CR credentials locally:', err);
    throw new Error('Unable to save CR password.');
  }
}

// Helper to resolve any username / alias to its canonical batch
export function resolveBatchFromUsername(input: string): ValidBatch | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase().replace(/\s+/g, '');

  if (['15', 'cr15', 'cr-15', 'batch15'].includes(clean)) return '15';
  if (['16', 'cr16', 'cr-16', 'batch16'].includes(clean)) return '16';
  if (['17', 'cr17', 'cr-17', 'batch17'].includes(clean)) return '17';
  if (['18', 'cr18', 'cr-18', 'batch18'].includes(clean)) return '18';
  if (['19', 'cr19', 'cr-19', 'batch19'].includes(clean)) return '19';
  if (['20', 'cr20', 'cr-20', 'batch20'].includes(clean)) return '20';
  if (['21', 'cr21', 'cr-21', 'batch21'].includes(clean)) return '21';
  if (['22-a', '22a', 'cr22a', 'cr-22a', 'cr-22-a', 'batch22-a', 'batch22a'].includes(clean)) return '22-A';
  if (['22-b', '22b', 'cr22b', 'cr-22b', 'cr-22-b', 'batch22-b', 'batch22b'].includes(clean)) return '22-B';

  // Check if exactly matches a ValidBatch
  const match = VALID_BATCHES.find(b => b.toLowerCase() === clean);
  return match || null;
}

// ---------------- Session Signing ----------------
function sign(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function createSessionToken(user: SessionUser): string {
  const payloadData = {
    ...user,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function getSessionFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const decoded = decodeURIComponent(token);
  const separator = decoded.lastIndexOf('.');
  if (separator < 1) return null;

  const payload = decoded.slice(0, separator);
  const signature = decoded.slice(separator + 1);

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    const data = JSON.parse(raw);

    if (data.role === 'admin') {
      return { role: 'admin', username: data.username || 'admin' };
    }
    if (data.role === 'cr' && data.batch && VALID_BATCHES.includes(data.batch)) {
      return {
        role: 'cr',
        username: data.username || CR_ACCOUNTS[data.batch as ValidBatch] || `cr-${data.batch}`,
        batch: data.batch,
      };
    }
  } catch {
    // If legacy format (timestamp:hex.sig), treat as admin
    return { role: 'admin', username: 'admin' };
  }

  return null;
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

export function getAuthSession(request: Request): SessionUser | null {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie
    .split(';')
    .map(v => v.trim())
    .find(v => v.startsWith(`${COOKIE_NAME}=`) || v.startsWith(`${LEGACY_COOKIE_NAME}=`))
    ?.split('=')[1];

  return getSessionFromToken(token);
}

// Legacy helper for routes that only check admin
export function isValidSessionToken(token: string | undefined): boolean {
  const session = getSessionFromToken(token);
  return session?.role === 'admin';
}

// ---------------- Authentication Verifications ----------------
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const credentials = await readAdminCredentials();
  return verifyPassword(password, credentials.passwordHash);
}

export async function verifyCrPassword(batch: ValidBatch, password: string): Promise<boolean> {
  const map = await readCrCredentialsMap();
  const record = map[batch];

  if (record?.passwordHash) {
    if (verifyPassword(password, record.passwordHash)) return true;
  }

  // Also check initial default passwords
  const defaults = DEFAULT_CR_PASSWORDS[batch] || ['cr123'];
  const trimmed = password.trim();
  return defaults.some(d => d.toLowerCase() === trimmed.toLowerCase());
}

// Unified authenticate for either Admin or CR
export async function authenticateUser(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: SessionUser; error?: string }> {
  const cleanUsername = usernameInput.trim();
  const password = passwordInput.trim();

  if (!cleanUsername || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  // 1. Try Admin
  if (cleanUsername.toLowerCase() === 'admin') {
    const isAdminValid = await verifyAdminPassword(password);
    if (isAdminValid) {
      return { success: true, user: { role: 'admin', username: 'admin' } };
    }
    return { success: false, error: 'Incorrect Admin password.' };
  }

  // 2. Try CR Batch Resolution
  const batch = resolveBatchFromUsername(cleanUsername);
  if (batch) {
    const isCrValid = await verifyCrPassword(batch, password);
    if (isCrValid) {
      return {
        success: true,
        user: {
          role: 'cr',
          username: CR_ACCOUNTS[batch],
          batch,
        },
      };
    }
    return {
      success: false,
      error: `Incorrect password for Batch ${batch} CR. (Default initial password is "cr123" or "key-${batch.toLowerCase().replace('-', '')}")`,
    };
  }

  return {
    success: false,
    error: `Unknown username "${cleanUsername}". Use your CR username (e.g. cr-22a, cr-15) or "admin".`,
  };
}

// ---------------- Change Passwords ----------------
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const credentials = await readAdminCredentials();
  if (!verifyPassword(currentPassword, credentials.passwordHash)) {
    return { success: false, error: 'Current admin password is incorrect.' };
  }
  await writeAdminCredentials({ passwordHash: hashPassword(newPassword) });
  return { success: true };
}

export async function changeCrPassword(
  batch: ValidBatch,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const isCurrentValid = await verifyCrPassword(batch, currentPassword);
  if (!isCurrentValid) {
    return { success: false, error: `Current password for Batch ${batch} is incorrect.` };
  }

  await writeCrCredential({
    batch,
    username: CR_ACCOUNTS[batch],
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}
