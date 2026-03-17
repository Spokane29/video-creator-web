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
  const validEmail = process.env.AUTH_EMAIL || 'mccoy.bill@gmail.com';
  const validPasswordHash = process.env.AUTH_PASSWORD_HASH || hashPassword('Lakers#1');
  
  return email === validEmail && hashPassword(password) === validPasswordHash;
}
