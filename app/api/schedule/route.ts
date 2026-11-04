import { NextResponse } from 'next/server';
import { getDatabase, addReschedule, updateReschedule, deleteReschedule, cleanupPastReschedules } from '@/lib/db';
import { VALID_BATCHES, ValidBatch } from '@/lib/types';
import { getAuthSession } from '@/lib/admin-auth';

// Force dynamic execution on Vercel so data is never cached stale
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDatabase();
    return NextResponse.json({
      rooms: db.rooms || [],
      timeSlots: db.timeSlots || [],
      reschedules: db.reschedules || [],
      batches: VALID_BATCHES,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch schedule data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = getAuthSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in as CR or Admin to schedule a class.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { date, slotId, roomId, courseCode, courseTitle, batch, reason } = body;

    if (!date || !slotId || !roomId || !courseCode || !batch) {
      return NextResponse.json(
        { error: 'Please provide Date, Time Slot, Room, Course Code, and Batch.' },
        { status: 400 }
      );
    }

    // Role-based authorization check:
    // CR can ONLY schedule for their own batch! Admin can schedule for ANY batch.
    if (session.role === 'cr' && session.batch !== batch) {
      return NextResponse.json(
        { error: `Permission denied: As CR for Batch ${session.batch}, you can only schedule classes for Batch ${session.batch}.` },
        { status: 403 }
      );
    }

    const result = await addReschedule({
      date,
      slotId,
      roomId,
      courseCode,
      courseTitle,
      batch,
      reason,
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
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to edit a class.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, date, slotId, roomId, courseCode, courseTitle, batch, reason } = body;

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

    // Role-based authorization check:
    // CR can ONLY edit their own batch's classes, and cannot change the batch.
    // Admin can edit ANY class from any batch.
    if (session.role === 'cr') {
      if (existing.batch !== session.batch) {
        return NextResponse.json(
          { error: `Permission denied: As CR for Batch ${session.batch}, you can only edit classes belonging to your own batch.` },
          { status: 403 }
        );
      }
      if (batch !== session.batch) {
        return NextResponse.json(
          { error: `Permission denied: As CR for Batch ${session.batch}, you cannot transfer this class to Batch ${batch}.` },
          { status: 403 }
        );
      }
    }

    const result = await updateReschedule({
      id,
      date,
      slotId,
      roomId,
      courseCode,
      courseTitle,
      batch,
      reason,
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
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    // Optional manual cleanup trigger: Strictly Admin only
    if (action === 'cleanup') {
      if (session.role !== 'admin') {
        return NextResponse.json({ error: 'Only Admin can perform past records cleanup.' }, { status: 403 });
      }
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

    // Admin can remove ANY class.
    // CR can remove their OWN batch's class if authorized.
    if (session.role !== 'admin' && !(session.role === 'cr' && existing.batch === session.batch)) {
      return NextResponse.json(
        { error: 'Permission denied: Only Admin or the batch CR can remove this class.' },
        { status: 403 }
      );
    }

    const result = await deleteReschedule(id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: 'Class removed successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 });
  }
}
