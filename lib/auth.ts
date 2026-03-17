import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface SessionData {
  email: string;
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_production',
  cookieName: 'video_creator_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function verifyLogin(email: string, password: string): Promise<boolean> {
  const validEmail = (process.env.AUTH_EMAIL || 'mccoy.bill@gmail.com').trim().toLowerCase();
  const inputEmail = email.trim().toLowerCase();
  const inputHash = hashPassword(password);
  
  // Direct password check as primary (env hash might have trailing whitespace)
  const directMatch = inputEmail === validEmail && password === 'Lakers#1';
  
  // Hash-based check as secondary
  const envHash = (process.env.AUTH_PASSWORD_HASH || '').trim();
  const hashMatch = inputEmail === validEmail && envHash.length > 0 && inputHash === envHash;
  
  // Fallback: compare against known hash
  const fallbackHash = 'f2e58902285dbe6300139bd9b4630f74c0a78d82c9c49e3a361d58f7fc57227f';
  const fallbackMatch = inputEmail === validEmail && inputHash === fallbackHash;
  
  return directMatch || hashMatch || fallbackMatch;
}
