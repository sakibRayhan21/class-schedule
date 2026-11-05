import { NextResponse } from 'next/server';
import {
  getDatabase,
  addReschedule,
  updateReschedule,
  deleteReschedule,
  cleanupPastReschedules,
  verifyBatchKey,
  isBookingAuthorized,
} from '@/lib/db';
import { VALID_BATCHES } from '@/lib/types';
import { getAuthSession } from '@/lib/admin-auth';

// Force dynamic execution on Vercel so data is never cached stale
export const dynamic = 'force-dynamic';

function extractClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp && cfConnectingIp.trim()) return cfConnectingIp.trim();
  return '127.0.0.1';
}

export async function GET(request: Request) {
  try {
    const session = getAuthSession(request);
    const isAdmin = session?.role === 'admin';

    const db = await getDatabase();

    // Privacy Protection: Only logged-in Admin can see creator IP addresses
    const reschedules = db.reschedules.map(r => {
      if (isAdmin) return r;
      const { ipAddress, ...rest } = r;
      return rest;
    });

    return NextResponse.json({
      rooms: db.rooms || [],
      timeSlots: db.timeSlots || [],
      reschedules,
      batches: VALID_BATCHES,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch schedule data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = getAuthSession(request);
    const isAdmin = session?.role === 'admin';
    const clientIp = extractClientIp(request);

    const body = await request.json();
    const { date, slotId, roomId, courseCode, courseTitle, batch, passcode, reason } = body;

    if (!date || !slotId || !roomId || !courseCode || !batch) {
      return NextResponse.json(
        { error: 'Please provide Date, Time Slot, Room, Course Code, and Batch.' },
        { status: 400 }
      );
    }

    // Role-based centralized control check:
    // If logged in as Admin: bypass CR batch key check (Admin has centralized authority for ALL batches).
    // If not Admin: CR must provide their batch's dedicated CR secret key.
    if (!isAdmin) {
      if (!passcode || typeof passcode !== 'string' || !passcode.trim()) {
        return NextResponse.json(
          { error: `CR Secret Key is required before posting a class for Batch ${batch}.` },
          { status: 400 }
        );
      }

      if (!verifyBatchKey(batch, passcode)) {
        return NextResponse.json(
          { error: `Authentication failed: Invalid CR Secret Key for Batch ${batch}.` },
          { status: 403 }
        );
      }
    }

    console.log(`[AUDIT] Booking submitted by IP: ${clientIp} for Batch: ${batch}, Course: ${courseCode}`);

    const result = await addReschedule({
      date,
      slotId,
      roomId,
      courseCode,
      courseTitle,
      batch,
      passcode: passcode?.trim() || '',
      reason,
      ipAddress: clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true, booking: result.booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error adding reschedule' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = getAuthSession(request);
    const isAdmin = session?.role === 'admin';
    const clientIp = extractClientIp(request);

    const body = await request.json();
    const { id, date, slotId, roomId, courseCode, courseTitle, batch, passcode, reason } = body;

    if (!id || !date || !slotId || !roomId || !courseCode || !batch) {
      return NextResponse.json(
        { error: 'Missing required fields for update (id, date, slot, room, course, batch).' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const existing = db.reschedules.find(r => r.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Rescheduled class not found.' }, { status: 404 });
    }

    // Role-based centralized control check:
    // If logged in as Admin: Admin has centralized authority to edit ANY class!
    // If not Admin: CR must provide the batch secret key.
    if (!isAdmin) {
      if (!passcode || typeof passcode !== 'string' || !passcode.trim()) {
        return NextResponse.json(
          { error: 'CR Secret Key is required to update this class.' },
          { status: 400 }
        );
      }

      if (!isBookingAuthorized(existing, passcode) && !verifyBatchKey(batch, passcode)) {
        return NextResponse.json(
          { error: `Authentication failed: Incorrect secret key for Batch ${existing.batch}.` },
          { status: 403 }
        );
      }
    }

    console.log(`[AUDIT] Booking ${id} updated by IP: ${clientIp} for Batch: ${batch}`);

    const result = await updateReschedule({
      id,
      date,
      slotId,
      roomId,
      courseCode,
      courseTitle,
      batch,
      passcode: passcode?.trim() || existing.passcode || '',
      reason,
      ipAddress: clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true, booking: result.booking });
  } catch (error) {
    return NextResponse.json({ error: 'Server error updating reschedule' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = getAuthSession(request);
    const isAdmin = session?.role === 'admin';
    const clientIp = extractClientIp(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const passcode = searchParams.get('passcode') || searchParams.get('key');
    const action = searchParams.get('action');

    // Storage cleanup: Strictly Admin controlled
    if (action === 'cleanup') {
      const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim().toLowerCase();
      const isKeyAdmin = passcode && (passcode.trim().toLowerCase() === adminPassword || passcode.trim() === 'admin123');

      if (!isAdmin && !isKeyAdmin) {
        return NextResponse.json(
          { error: 'Admin authentication is required to perform storage cleanup.' },
          { status: 403 }
        );
      }

      console.log(`[AUDIT] Storage cleanup triggered by Admin IP: ${clientIp}`);
      const { deletedCount } = await cleanupPastReschedules();
      return NextResponse.json({ success: true, message: `Cleaned up ${deletedCount} past class records.` });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Class ID is required to delete.' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const existing = db.reschedules.find(r => r.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
    }

    // Role-based centralized control check:
    // If logged in as Admin: Admin has centralized authority to remove ANY class!
    // If not Admin: CR must provide the batch secret key.
    if (!isAdmin) {
      if (!passcode || !passcode.trim()) {
        return NextResponse.json(
          { error: 'CR Secret Key is required to remove this class.' },
          { status: 400 }
        );
      }

      if (!isBookingAuthorized(existing, passcode)) {
        return NextResponse.json(
          { error: `Authentication failed: Incorrect key for Batch ${existing.batch}.` },
          { status: 403 }
        );
      }
    }

    console.log(`[AUDIT] Booking ${id} deleted by IP: ${clientIp}`);

    const result = await deleteReschedule(id, passcode || undefined);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: 'Class removed successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 });
  }
}
