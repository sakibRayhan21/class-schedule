export interface Room {
  id: string;
  name: string;
}

export interface TimeSlot {
  id: string;
  period: number;
  label: string;
  startTime: string;
  endTime: string;
}

export const VALID_BATCHES = [
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22-A',
  '22-B',
] as const;

export type ValidBatch = typeof VALID_BATCHES[number];

export interface RescheduleBooking {
  id: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  roomId: string;
  courseCode: string;
  courseTitle: string;
  batch: ValidBatch | string;
  passcode: string; // Batch CR secret authentication key
  reason?: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
}

export interface DatabaseFile {
  rooms: Room[];
  timeSlots: TimeSlot[];
  reschedules: RescheduleBooking[];
}
