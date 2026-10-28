import fs from 'fs';
import path from 'path';
import { DatabaseFile, RescheduleBooking, VALID_BATCHES, ValidBatch, Room, TimeSlot } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');

// Default CR Keys for the 9 department batches
export const DEFAULT_BATCH_KEYS: Record<string, string> = {
  '15': 'key-15',
  '16': 'key-16',
  '17': 'key-17',
  '18': 'key-18',
  '19': 'key-19',
  '20': 'key-20',
  '21': 'key-21',
  '22-A': 'key-22a',
  '22-B': 'key-22b',
};

// Fallback initial rooms & time slots from local file
function getLocalFallback(): DatabaseFile {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading local database.json:', err);
  }
  return {
    rooms: [
      { id: 'room-301', name: 'Room 301' },
      { id: 'room-302', name: 'Room 302' },
      { id: 'room-401', name: 'Room 401' },
      { id: 'room-303', name: 'Room 303' },
      { id: 'room-304', name: 'Room 304' },
      { id: 'lab-306', name: 'Lab 306' },
      { id: 'lab-307', name: 'Lab 307' },
      { id: 'lab-308', name: 'Lab 308' },
    ],
    timeSlots: [
      { id: 'slot-1', period: 1, label: '08:30 AM - 09:50 AM', startTime: '08:30', endTime: '09:50' },
      { id: 'slot-2', period: 2, label: '09:50 AM - 11:10 AM', startTime: '09:50', endTime: '11:10' },
      { id: 'slot-3', period: 3, label: '11:10 AM - 12:30 PM', startTime: '11:10', endTime: '12:30' },
      { id: 'slot-4', period: 4, label: '01:50 PM - 03:10 PM', startTime: '13:50', endTime: '15:10' },
      { id: 'slot-5', period: 5, label: '03:10 PM - 04:30 PM', startTime: '15:10', endTime: '16:30' },
    ],
    reschedules: [],
  };
}

export function saveLocalDatabase(data: DatabaseFile): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('Error saving local database.json:', err);
  }
}

// Map Supabase snake_case row to CamelCase RescheduleBooking
function mapSupabaseReschedule(row: any): RescheduleBooking {
  return {
    id: row.id,
    date: row.date,
    slotId: row.slot_id,
    roomId: row.room_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    batch: row.batch,
    passcode: row.passcode,
    reason: row.reason || '',
    status: (row.status as 'CONFIRMED' | 'CANCELLED') || 'CONFIRMED',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function getDatabase(): Promise<DatabaseFile> {
  const fallback = getLocalFallback();

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Fetch Reschedules from Supabase
      const { data: rescData, error: rescError } = await supabase
        .from('reschedules')
        .select('*')
        .order('date', { ascending: true });

      if (rescError) {
        console.error('Supabase fetch error for reschedules:', rescError.message);
      }

      // 2. Optional: Fetch Rooms if present in Supabase
      let rooms: Room[] = fallback.rooms;
      const { data: roomData, error: roomError } = await supabase.from('rooms').select('*');
      if (!roomError && roomData && roomData.length > 0) {
        rooms = roomData.map((r: any) => ({ id: r.id, name: r.name }));
      }

      // 3. Optional: Fetch Time Slots if present in Supabase
      let timeSlots: TimeSlot[] = fallback.timeSlots;
      const { data: slotData, error: slotError } = await supabase
        .from('time_slots')
        .select('*')
        .order('period', { ascending: true });
      if (!slotError && slotData && slotData.length > 0) {
        timeSlots = slotData.map((s: any) => ({
          id: s.id,
          period: s.period,
          label: s.label,
          startTime: s.start_time || s.startTime,
          endTime: s.end_time || s.endTime,
        }));
      }

      const reschedules: RescheduleBooking[] = rescData
        ? rescData.map(mapSupabaseReschedule)
        : fallback.reschedules;

      return {
        rooms,
        timeSlots,
        reschedules,
      };
    } catch (err) {
      console.error('Error querying Supabase, falling back to local:', err);
      return fallback;
    }
  }

  return fallback;
}

export async function addReschedule(data: {
  date: string;
  slotId: string;
  roomId: string;
  courseCode: string;
  courseTitle?: string;
  batch: string;
  passcode: string;
  reason?: string;
}): Promise<{ success: boolean; booking?: RescheduleBooking; error?: string }> {
  const currentDb = await getDatabase();

  const room = currentDb.rooms.find(r => r.id === data.roomId);
  const slot = currentDb.timeSlots.find(s => s.id === data.slotId);

  if (!room) {
    return { success: false, error: 'Selected room does not exist.' };
  }
  if (!slot) {
    return { success: false, error: 'Selected time slot does not exist.' };
  }
  if (!VALID_BATCHES.includes(data.batch as ValidBatch)) {
    return {
      success: false,
      error: `Invalid Batch! Please select one of the 9 department batches: ${VALID_BATCHES.join(', ')}.`,
    };
  }
  if (!data.passcode || data.passcode.trim().length === 0) {
    return { success: false, error: 'Batch CR Authentication Key is required.' };
  }

  // 1. Room Allocation Conflict Check
  const roomConflict = currentDb.reschedules.find(
    r =>
      r.date === data.date &&
      r.slotId === data.slotId &&
      r.roomId === data.roomId &&
      (r.status === 'CONFIRMED' || !r.status)
  );

  if (roomConflict) {
    return {
      success: false,
      error: `Room Allocation Conflict: "${room.name}" is already booked on ${data.date} at ${slot.label} by Batch ${roomConflict.batch} (${roomConflict.courseCode})! Please choose a different room or time.`,
    };
  }

  // 2. Batch Overlap Check (Cannot double book the same batch at the same time)
  const batchConflict = currentDb.reschedules.find(
    r =>
      r.date === data.date &&
      r.slotId === data.slotId &&
      r.batch.toLowerCase() === data.batch.toLowerCase() &&
      (r.status === 'CONFIRMED' || !r.status)
  );

  if (batchConflict) {
    return {
      success: false,
      error: `Batch Conflict: Batch ${data.batch} is already scheduled for "${batchConflict.courseCode}" at this time on ${data.date}.`,
    };
  }

  const newBookingId = `resc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const courseCodeFormatted = data.courseCode.trim().toUpperCase();
  const courseTitleFormatted = data.courseTitle?.trim() || courseCodeFormatted;

  // Save to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('reschedules')
        .insert({
          id: newBookingId,
          date: data.date,
          slot_id: data.slotId,
          room_id: data.roomId,
          course_code: courseCodeFormatted,
          course_title: courseTitleFormatted,
          batch: data.batch,
          passcode: data.passcode.trim(),
          reason: data.reason?.trim() || '',
          status: 'CONFIRMED',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return { success: false, error: `Failed to save to Supabase: ${insertError.message}` };
      }

      return { success: true, booking: mapSupabaseReschedule(inserted) };
    } catch (err: any) {
      console.error('Supabase exception:', err);
      return { success: false, error: err.message || 'Error connecting to database' };
    }
  }

  // Fallback to local database.json (for offline/local development)
  const newBooking: RescheduleBooking = {
    id: newBookingId,
    date: data.date,
    slotId: data.slotId,
    roomId: data.roomId,
    courseCode: courseCodeFormatted,
    courseTitle: courseTitleFormatted,
    batch: data.batch,
    passcode: data.passcode.trim(),
    reason: data.reason?.trim() || '',
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  currentDb.reschedules.push(newBooking);
  saveLocalDatabase(currentDb);

  return { success: true, booking: newBooking };
}

export async function deleteReschedule(
  id: string,
  passcode: string
): Promise<{ success: boolean; error?: string }> {
  const currentDb = await getDatabase();
  const booking = currentDb.reschedules.find(r => r.id === id);

  if (!booking) {
    return { success: false, error: 'Rescheduled class not found.' };
  }

  const defaultKey = DEFAULT_BATCH_KEYS[booking.batch];
  const isAuthorized =
    booking.passcode.toLowerCase() === passcode.trim().toLowerCase() ||
    (defaultKey && defaultKey.toLowerCase() === passcode.trim().toLowerCase()) ||
    passcode.trim() === 'admin123';

  if (!isAuthorized) {
    return {
      success: false,
      error: `Authentication failed: Incorrect key for Batch ${booking.batch}.`,
    };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { error: deleteError } = await supabase.from('reschedules').delete().eq('id', id);
      if (deleteError) {
        return { success: false, error: `Supabase delete failed: ${deleteError.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete from database' };
    }
  }

  // Local fallback
  const index = currentDb.reschedules.findIndex(r => r.id === id);
  if (index !== -1) {
    currentDb.reschedules.splice(index, 1);
    saveLocalDatabase(currentDb);
  }
  return { success: true };
}
