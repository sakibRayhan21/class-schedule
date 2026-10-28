import { NextResponse } from 'next/server';
import { getDatabase, addReschedule, deleteReschedule } from '@/lib/db';
import { VALID_BATCHES } from '@/lib/types';

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
    const body = await request.json();
    const { date, slotId, roomId, courseCode, courseTitle, batch, passcode, reason } = body;

    if (!date || !slotId || !roomId || !courseCode || !batch || !passcode) {
      return NextResponse.json(
        { error: 'Please provide Date, Time Slot, Room, Course Code, Batch, and Batch Authentication Key.' },
        { status: 400 }
      );
    }

    const result = await addReschedule({
      date,
      slotId,
      roomId,
      courseCode,
      courseTitle,
      batch,
      passcode,
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const passcode = searchParams.get('passcode');

    if (!id || !passcode) {
      return NextResponse.json(
        { error: 'Class ID and Batch Authentication Key are required to delete.' },
        { status: 400 }
      );
    }

    const result = await deleteReschedule(id, passcode);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: 'Class removed successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 });
  }
}
