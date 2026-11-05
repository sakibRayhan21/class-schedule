import fs from 'fs';
import path from 'path';
import { DatabaseFile, RescheduleBooking, VALID_BATCHES, ValidBatch, Room, TimeSlot } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.json');

// Default CR Secret Keys for the 9 department batches
export const DEFAULT_BATCH_KEYS: Record<string, string> = {
  '15': 'senior-15',
  '16': 'boss-16',
  '17': 'abdullah-17',
  '18': 'crs-18',
  '19': 'KR-1015',
  '20': 'cr-20s',
  '21': 'ARG-21',
  '22-A': 'batch-22a',
  '22-B': 'batch-22b',
};

// Validates whether the given key is authorized for the specified batch (or admin override)
export function verifyBatchKey(batch: string, key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toLowerCase();
  if (!cleanKey) return false;

  // Master Admin Override
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim().toLowerCase();
  if (cleanKey === adminPassword || cleanKey === 'admin123') {
    return true;
  }

  const defaultKey = DEFAULT_BATCH_KEYS[batch];
  if (!defaultKey) return false;

  const cleanDefault = defaultKey.trim().toLowerCase();
  if (cleanKey === cleanDefault) return true;

  // Normalize batch and key (strip non-alphanumeric) to accept variations like:
  // "senior15" vs "senior-15", "cr20s" vs "cr-20s", "arg21" vs "arg-21", "22a"
  const normBatch = batch.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normKey = cleanKey.replace(/[^a-z0-9]/g, '');
  const normDefault = cleanDefault.replace(/[^a-z0-9]/g, '');

  if (normKey === normDefault || normKey === `key${normBatch}` || normKey === normBatch) {
    return true;
  }

  return false;
}

// Checks if an existing booking can be modified or deleted using the given key
export function isBookingAuthorized(booking: RescheduleBooking, key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim().toLowerCase();
  if (!cleanKey) return false;

  if (booking.passcode && booking.passcode.trim().toLowerCase() === cleanKey) {
    return true;
  }

  return verifyBatchKey(booking.batch, key);
}

// Returns today's date in YYYY-MM-DD format using local time
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
      { id: 'slot-1', period: 1, label: '08:35 AM - 09:50 AM', startTime: '08:35', endTime: '09:50' },
      { id: 'slot-2', period: 2, label: '09:50 AM - 11:05 AM', startTime: '09:50', endTime: '11:05' },
      { id: 'slot-3', period: 3, label: '11:05 AM - 12:20 PM', startTime: '11:05', endTime: '12:20' },
      { id: 'slot-4', period: 4, label: '12:20 PM - 01:35 PM', startTime: '12:20', endTime: '13:35' },
      { id: 'slot-5', period: 5, label: '01:35 PM - 02:50 PM', startTime: '13:35', endTime: '14:50' },
      { id: 'slot-6', period: 6, label: '02:50 PM - 04:05 PM', startTime: '14:50', endTime: '16:05' },
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
    ipAddress: row.ip_address || row.ipAddress || '',
  };
}

// Automatically purges yesterday's and past classes to save database storage
export async function cleanupPastReschedules(): Promise<{ deletedCount: number }> {
  const today = getTodayDateString();
  let deletedCount = 0;

  // 1. Supabase cleanup: delete where date < today
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('reschedules')
        .delete()
        .lt('date', today)
        .select();

      if (!error && data) {
        deletedCount = data.length;
      }
    } catch (err) {
      console.error('Error auto-cleaning past records in Supabase:', err);
    }
  }

  // 2. Local fallback cleanup
  const localDb = getLocalFallback();
  const initialLen = localDb.reschedules.length;
  localDb.reschedules = localDb.reschedules.filter(r => r.date >= today);
  if (localDb.reschedules.length !== initialLen) {
    saveLocalDatabase(localDb);
    deletedCount = Math.max(deletedCount, initialLen - localDb.reschedules.length);
  }

  return { deletedCount };
}

export async function getDatabase(): Promise<DatabaseFile> {
  const fallback = getLocalFallback();

  // Automatically prune yesterday's past classes to preserve storage
  try {
    await cleanupPastReschedules();
  } catch (err) {
    console.error('Error during automatic past schedule cleanup:', err);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Fetch Reschedules from Supabase (today and upcoming only)
      const { data: rescData, error: rescError } = await supabase
        .from('reschedules')
        .select('*')
        .order('date', { ascending: true });

      if (rescError) {
        console.error('Supabase fetch error for reschedules:', rescError.message);
      }

      // 2. Fetch Rooms if present in Supabase
      let rooms: Room[] = fallback.rooms;
      const { data: roomData, error: roomError } = await supabase.from('rooms').select('*');
      if (!roomError && roomData && roomData.length > 0) {
        rooms = roomData.map((r: any) => ({ id: r.id, name: r.name }));
      }

      // 3. Fetch Time Slots if present in Supabase
      let timeSlots: TimeSlot[] = fallback.timeSlots;
      const { data: slotData, error: slotError } = await supabase
        .from('time_slots')
        .select('*')
        .order('period', { ascending: true });
      if (!slotError && slotData && slotData.length >= fallback.timeSlots.length) {
        timeSlots = slotData.map((s: any) => ({
          id: s.id,
          period: s.period,
          label: s.label,
          startTime: s.start_time || s.startTime,
          endTime: s.end_time || s.endTime,
        }));
      } else if (!slotError && fallback.timeSlots?.length > 0) {
        // If Supabase has outdated or fewer slots, use latest 6 fallback slots and sync to Supabase
        timeSlots = fallback.timeSlots;
        try {
          const syncPayload = fallback.timeSlots.map(s => ({
            id: s.id,
            period: s.period,
            label: s.label,
            start_time: s.startTime,
            end_time: s.endTime,
          }));
          await supabase.from('time_slots').upsert(syncPayload, { onConflict: 'id' });
        } catch {
          // Graceful fallback if client does not have upsert permissions on time_slots
        }
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
  passcode?: string;
  reason?: string;
  ipAddress?: string;
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

  // Validate CR Key for this batch if provided
  if (data.passcode && !verifyBatchKey(data.batch, data.passcode)) {
    return {
      success: false,
      error: `Authentication failed: Invalid CR Secret Key for Batch ${data.batch}.`,
    };
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
  const passcodeFormatted = data.passcode?.trim() || '';

  // Save to Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const insertPayload: any = {
        id: newBookingId,
        date: data.date,
        slot_id: data.slotId,
        room_id: data.roomId,
        course_code: courseCodeFormatted,
        course_title: courseTitleFormatted,
        batch: data.batch,
        passcode: passcodeFormatted,
        reason: data.reason?.trim() || '',
        status: 'CONFIRMED',
      };
      if (data.ipAddress) {
        insertPayload.ip_address = data.ipAddress.trim();
      }

      let { data: inserted, error: insertError } = await supabase
        .from('reschedules')
        .insert(insertPayload)
        .select()
        .single();

      // Graceful fallback if table does not yet have ip_address column
      if (insertError && data.ipAddress && insertError.message?.toLowerCase().includes('ip_address')) {
        console.warn('Supabase reschedules table missing ip_address column, retrying without it:', insertError.message);
        delete insertPayload.ip_address;
        const retryResult = await supabase
          .from('reschedules')
          .insert(insertPayload)
          .select()
          .single();
        inserted = retryResult.data;
        insertError = retryResult.error;
      }

      if (!insertError && inserted) {
        const mapped = mapSupabaseReschedule(inserted);
        if (!mapped.ipAddress && data.ipAddress) {
          mapped.ipAddress = data.ipAddress.trim();
        }
        return { success: true, booking: mapped };
      }
      console.warn('Supabase insert failed, falling back to local database:', insertError?.message);
    } catch (err: any) {
      console.warn('Supabase insert exception, falling back to local database:', err.message);
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
    passcode: passcodeFormatted,
    reason: data.reason?.trim() || '',
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
    ipAddress: data.ipAddress?.trim() || '',
  };

  currentDb.reschedules.push(newBooking);
  saveLocalDatabase(currentDb);

  return { success: true, booking: newBooking };
}

// Edit / Update an existing rescheduled class
export async function updateReschedule(data: {
  id: string;
  date: string;
  slotId: string;
  roomId: string;
  courseCode: string;
  courseTitle?: string;
  batch: string;
  passcode?: string;
  reason?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; booking?: RescheduleBooking; error?: string }> {
  const currentDb = await getDatabase();
  const existing = currentDb.reschedules.find(r => r.id === data.id);

  if (!existing) {
    return { success: false, error: 'Rescheduled class not found.' };
  }

  // Authorize using the existing batch's passcode, new batch key, or admin override
  if (data.passcode && !isBookingAuthorized(existing, data.passcode) && !verifyBatchKey(data.batch, data.passcode)) {
    return {
      success: false,
      error: `Authentication failed: Incorrect secret key for Batch ${existing.batch}.`,
    };
  }

  const room = currentDb.rooms.find(r => r.id === data.roomId);
  const slot = currentDb.timeSlots.find(s => s.id === data.slotId);

  if (!room) {
    return { success: false, error: 'Selected room does not exist.' };
  }
  if (!slot) {
    return { success: false, error: 'Selected time slot does not exist.' };
  }

  // Check room conflict with any OTHER class (excluding this class itself)
  const roomConflict = currentDb.reschedules.find(
    r =>
      r.id !== data.id &&
      r.date === data.date &&
      r.slotId === data.slotId &&
      r.roomId === data.roomId &&
      (r.status === 'CONFIRMED' || !r.status)
  );

  if (roomConflict) {
    return {
      success: false,
      error: `Room Allocation Conflict: "${room.name}" is already booked on ${data.date} at ${slot.label} by Batch ${roomConflict.batch} (${roomConflict.courseCode})!`,
    };
  }

  // Check batch conflict with any OTHER class
  const batchConflict = currentDb.reschedules.find(
    r =>
      r.id !== data.id &&
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

  const courseCodeFormatted = data.courseCode.trim().toUpperCase();
  const courseTitleFormatted = data.courseTitle?.trim() || courseCodeFormatted;
  const passcodeFormatted = data.passcode?.trim() || existing.passcode || '';

  // Update in Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const updatePayload: any = {
        date: data.date,
        slot_id: data.slotId,
        room_id: data.roomId,
        course_code: courseCodeFormatted,
        course_title: courseTitleFormatted,
        batch: data.batch,
        passcode: passcodeFormatted,
        reason: data.reason?.trim() || '',
      };
      if (data.ipAddress) {
        updatePayload.ip_address = data.ipAddress.trim();
      }

      let { data: updated, error: updateError } = await supabase
        .from('reschedules')
        .update(updatePayload)
        .eq('id', data.id)
        .select()
        .single();

      if (updateError && data.ipAddress && updateError.message?.toLowerCase().includes('ip_address')) {
        delete updatePayload.ip_address;
        const retryResult = await supabase
          .from('reschedules')
          .update(updatePayload)
          .eq('id', data.id)
          .select()
          .single();
        updated = retryResult.data;
        updateError = retryResult.error;
      }

      if (!updateError && updated) {
        const mapped = mapSupabaseReschedule(updated);
        if (!mapped.ipAddress && data.ipAddress) {
          mapped.ipAddress = data.ipAddress.trim();
        }
        return { success: true, booking: mapped };
      }
      console.warn('Supabase update failed, falling back to local database:', updateError?.message);
    } catch (err: any) {
      console.warn('Supabase update exception, falling back to local database:', err.message);
    }
  }

  // Update in local fallback
  const index = currentDb.reschedules.findIndex(r => r.id === data.id);
  if (index !== -1) {
    currentDb.reschedules[index] = {
      ...currentDb.reschedules[index],
      date: data.date,
      slotId: data.slotId,
      roomId: data.roomId,
      courseCode: courseCodeFormatted,
      courseTitle: courseTitleFormatted,
      batch: data.batch,
      passcode: passcodeFormatted,
      reason: data.reason?.trim() || '',
      ipAddress: data.ipAddress?.trim() || currentDb.reschedules[index].ipAddress || '',
    };
    saveLocalDatabase(currentDb);
    return { success: true, booking: currentDb.reschedules[index] };
  }

  return { success: false, error: 'Failed to update class' };
}

export async function deleteReschedule(
  id: string,
  passcode?: string
): Promise<{ success: boolean; error?: string }> {
  const currentDb = await getDatabase();
  const booking = currentDb.reschedules.find(r => r.id === id);

  if (!booking) {
    return { success: false, error: 'Rescheduled class not found.' };
  }

  if (passcode && !isBookingAuthorized(booking, passcode)) {
    return {
      success: false,
      error: `Authentication failed: Incorrect key for Batch ${booking.batch}.`,
    };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { error: deleteError } = await supabase.from('reschedules').delete().eq('id', id);
      if (!deleteError) {
        // Also remove from local fallback if present
        const index = currentDb.reschedules.findIndex(r => r.id === id);
        if (index !== -1) {
          currentDb.reschedules.splice(index, 1);
          saveLocalDatabase(currentDb);
        }
        return { success: true };
      }
      console.warn('Supabase delete failed, falling back to local database:', deleteError.message);
    } catch (err: any) {
      console.warn('Supabase delete exception, falling back to local database:', err.message);
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
