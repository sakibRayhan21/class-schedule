import { NextResponse } from 'next/server';
import {
  authenticateUser,
  changeAdminPassword,
  changeCrPassword,
  createSessionToken,
  getAuthSession,
  getAuthSessionDetails,
  getSessionCookieName,
  DEFAULT_SESSION_DURATION_SECONDS,
  EXTENDED_SESSION_DURATION_SECONDS,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const details = getAuthSessionDetails(request);
  if (!details || details.isExpired) {
    const response = NextResponse.json({
      authenticated: false,
      user: null,
      expired: details?.isExpired ?? false,
      message: details?.isExpired ? 'Admin session has ended. Please sign in again.' : 'Not authenticated.',
    });

    // Proactively clear cookie if expired
    if (details?.isExpired) {
      response.cookies.set(getSessionCookieName(), '', {
        httpOnly: true,
        maxAge: 0,
        expires: new Date(0),
        path: '/',
      });
      response.cookies.set('unischedule_admin_session', '', {
        httpOnly: true,
        maxAge: 0,
        expires: new Date(0),
        path: '/',
      });
    }

    return response;
  }

  return NextResponse.json({
    authenticated: true,
    user: details.user,
    expiresAt: details.expiresAt,
    remainingSeconds: details.remainingSeconds,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, rememberMe } = body;

    // For backwards compatibility: if only password is provided, assume admin
    const usernameInput = typeof username === 'string' && username.trim().length > 0 ? username : 'admin';

    if (typeof password !== 'string' || !password.trim()) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const authResult = await authenticateUser(usernameInput, password);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication failed.' }, { status: 401 });
    }

    // Determine session lifetime: 7 days if "rememberMe" requested, otherwise standard 2-hour session
    const durationSeconds = rememberMe ? EXTENDED_SESSION_DURATION_SECONDS : DEFAULT_SESSION_DURATION_SECONDS;
    const token = createSessionToken(authResult.user, durationSeconds);
    const expiresAt = Date.now() + durationSeconds * 1000;

    const response = NextResponse.json({
      success: true,
      user: authResult.user,
      expiresAt,
      durationSeconds,
      sessionType: rememberMe ? 'persistent' : 'session',
    });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: durationSeconds,
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error during sign in.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = getAuthSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Authentication is required to change password.' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Current and new passwords are required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    if (session.role === 'admin') {
      const result = await changeAdminPassword(currentPassword, newPassword);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, message: 'Admin password updated successfully.' });
    }

    if (session.role === 'cr') {
      const result = await changeCrPassword(session.batch, currentPassword, newPassword);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, message: `Password for Batch ${session.batch} updated successfully.` });
    }

    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating password.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Signed out successfully.' });
  response.cookies.set(getSessionCookieName(), '', {
    httpOnly: true,
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
  response.cookies.set('unischedule_admin_session', '', {
    httpOnly: true,
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
  return response;
}
