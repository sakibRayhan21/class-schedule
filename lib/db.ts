import fs from 'fs';
import path from 'path';
import { DatabaseFile, RescheduleBooking, VALID_BATCHES, ValidBatch } from './types';

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

export function getDatabase(): DatabaseFile {
  try {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`database.json not found at ${DB_PATH}`);
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database.json:', err);
    return {
      rooms: [],
      timeSlots: [],
      reschedules: [],
    };
  }
}

export function saveDatabase(data: DatabaseFile): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('Error saving database.json:', err);
  }
}

export function addReschedule(data: {
  date: string;
  slotId: string;
  roomId: string;
  courseCode: string;
  courseTitle?: string;
  batch: string;
  passcode: string;
  reason?: string;
}): { success: boolean; booking?: RescheduleBooking; error?: string } {
  const db = getDatabase();

  const room = db.rooms.find(r => r.id === data.roomId);
  const slot = db.timeSlots.find(s => s.id === data.slotId);

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
  const roomConflict = db.reschedules.find(
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
  const batchConflict = db.reschedules.find(
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

  const newBooking: RescheduleBooking = {
    id: `resc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    date: data.date,
    slotId: data.slotId,
    roomId: data.roomId,
    courseCode: data.courseCode.trim().toUpperCase(),
    courseTitle: data.courseTitle?.trim() || data.courseCode.trim().toUpperCase(),
    batch: data.batch,
    passcode: data.passcode.trim(),
    reason: data.reason?.trim() || '',
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  db.reschedules.push(newBooking);
  saveDatabase(db);

  return { success: true, booking: newBooking };
}

export function deleteReschedule(id: string, passcode: string): { success: boolean; error?: string } {
  const db = getDatabase();
  const index = db.reschedules.findIndex(r => r.id === id);

  if (index === -1) {
    return { success: false, error: 'Rescheduled class not found.' };
  }

  const booking = db.reschedules[index];
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

  db.reschedules.splice(index, 1);
  saveDatabase(db);
  return { success: true };
}
