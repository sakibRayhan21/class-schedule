'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  KeyRound,
  Shield,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Room, TimeSlot, RescheduleBooking, VALID_BATCHES, ValidBatch } from '@/lib/types';

export default function RescheduleHomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [reschedules, setReschedules] = useState<RescheduleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form Fields
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [slotId, setSlotId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [batch, setBatch] = useState<ValidBatch>('22-A');
  const [passcode, setPasscode] = useState('');
  const [reason, setReason] = useState('Makeup Class');

  // Status & Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<RescheduleBooking | null>(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch Schedule Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        setTimeSlots(data.timeSlots || []);
        setReschedules(data.reschedules || []);

        if (data.rooms?.length > 0 && !roomId) {
          setRoomId(data.rooms[0].id);
        }
        if (data.timeSlots?.length > 0 && !slotId) {
          setSlotId(data.timeSlots[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (rooms.length > 0 && !roomId) setRoomId(rooms[0].id);
    if (timeSlots.length > 0 && !slotId) setSlotId(timeSlots[0].id);
  }, [rooms, timeSlots]);

  // Group by Date:
  // A row appears on home screen if and only if it is added to reschedule!
  const dateWiseRows = useMemo(() => {
    const map = new Map<string, RescheduleBooking[]>();
    for (const item of reschedules) {
      if (item.status === 'CONFIRMED' || !item.status) {
        const list = map.get(item.date) || [];
        list.push(item);
        map.set(item.date, list);
      }
    }
    return Array.from(map.entries()).sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
  }, [reschedules]);

  // Helpers to resolve Room and Slot labels
  const getRoomName = (rId: string) => {
    const found = rooms.find(r => r.id === rId);
    return found ? found.name : rId;
  };

  const getSlotLabel = (sId: string) => {
    const found = timeSlots.find(s => s.id === sId);
    return found ? `${found.label} (Period ${found.period})` : sId;
  };

  const formatDateHeader = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Submit Add Class
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!date) {
      setErrorMsg('Please select a date.');
      return;
    }
    if (!slotId) {
      setErrorMsg('Please select a time slot.');
      return;
    }
    if (!roomId) {
      setErrorMsg('Please select a room.');
      return;
    }
    if (!courseCode.trim()) {
      setErrorMsg('Please enter the course code (e.g. CSE 3101).');
      return;
    }
    if (!batch) {
      setErrorMsg('Please select your batch.');
      return;
    }
    if (!passcode.trim()) {
      setErrorMsg(`Please enter the secret key for Batch ${batch}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          slotId,
          roomId,
          courseCode: courseCode.trim(),
          courseTitle: courseTitle.trim() || courseCode.trim(),
          batch,
          passcode: passcode.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to add class.');
        return;
      }

      // Success
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      showToast(`🎉 Class added for Batch ${batch}!`);
      setIsModalOpen(false);

      // Reset
      setCourseCode('');
      setCourseTitle('');
      setPasscode('');
      setReason('');

      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Rescheduled Class
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!deletePasscode.trim()) {
      setDeleteError(`Please enter the secret key for Batch ${deleteTarget.batch}.`);
      return;
    }

    try {
      const res = await fetch(
        `/api/schedule?id=${encodeURIComponent(deleteTarget.id)}&passcode=${encodeURIComponent(
          deletePasscode.trim()
        )}`,
        { method: 'DELETE' }
      );
      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || 'Authentication failed: Incorrect key.');
        return;
      }

      showToast('🗑️ Rescheduled class removed');
      setDeleteTarget(null);
      setDeletePasscode('');
      setDeleteError(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setDeleteError('Network error deleting class');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Class Reschedule Board
              </h1>
              <p className="text-xs text-slate-500">
                Department Class Captain Portal • 9 Batches • Room Conflict Shield
              </p>
            </div>
          </div>

          {/* Add Class Button */}
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm shadow-md shadow-emerald-600/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Class</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
          <div className="max-w-2xl space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/80 border border-emerald-500/30 text-xs font-semibold text-emerald-200">
              <Shield className="w-3.5 h-3.5" />
              Batch Authentication (Batches: 15, 16, 17, 18, 19, 20, 21, 22-A, 22-B)
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Date-Wise Rescheduled Classes
            </h2>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              When a class is added to reschedule, its date row appears below. Rooms are protected from double-booking.
            </p>
          </div>
        </div>

        {/* DATE-WISE ROWS */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 shadow-xs">
            Loading scheduled classes...
          </div>
        ) : dateWiseRows.length === 0 ? (
          /* Empty State if No Reschedules Exist */
          <div className="bg-white rounded-3xl p-12 sm:p-16 text-center border border-slate-200 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800">No Rescheduled Classes Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                No dates have reschedules. Click the <strong>Add Class</strong> button above to allocate a room using your Batch key.
              </p>
            </div>
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Class</span>
            </button>
          </div>
        ) : (
          /* RENDER EACH DATE AS A DEDICATED ROW */
          <div className="space-y-6">
            {dateWiseRows.map(([rowDate, rowBookings]) => (
              <div
                key={rowDate}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Date Row Header */}
                <div className="bg-slate-100/80 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                    </span>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-slate-900">
                        {formatDateHeader(rowDate)}
                      </h3>
                      <span className="text-xs text-slate-500 font-medium">
                        Date: {rowDate}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {rowBookings.length} {rowBookings.length === 1 ? 'Rescheduled Class' : 'Rescheduled Classes'}
                  </span>
                </div>

                {/* Scheduled Classes Cards for this Date */}
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rowBookings.map(item => (
                    <div
                      key={item.id}
                      className="bg-slate-50/70 border border-slate-200 hover:border-emerald-300 rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Room Allocation Badge + Time */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs">
                            <MapPin className="w-3.5 h-3.5 text-emerald-200" />
                            {getRoomName(item.roomId)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-600 font-semibold text-xs">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {getSlotLabel(item.slotId)}
                          </span>
                        </div>

                        {/* Course & Batch */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              Batch {item.batch}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {item.courseCode}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-base leading-snug mt-1">
                            {item.courseTitle}
                          </h4>
                        </div>

                        {/* Reason / Note */}
                        {item.reason && (
                          <div className="pt-2 border-t border-slate-200/80 text-xs text-slate-600 italic">
                            Note: {item.reason}
                          </div>
                        )}
                      </div>

                      {/* Remove Button */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Batch: <strong>{item.batch}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(item);
                            setDeletePasscode('');
                            setDeleteError(null);
                          }}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete class (Batch key required)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ADD CLASS MODAL WITH BATCH + KEY AUTHENTICATION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <h3 className="font-bold text-lg">Add Rescheduled Class</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              {/* Conflict Error Message */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              {/* BATCH & SECRET KEY AUTHENTICATION */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                  <span>CR Batch Authentication *</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Select Batch *
                    </label>
                    <select
                      value={batch}
                      onChange={e => setBatch(e.target.value as ValidBatch)}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {VALID_BATCHES.map(b => (
                        <option key={b} value={b}>
                          Batch {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Batch Secret Key *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder={`Secret key for Batch ${batch}`}
                      value={passcode}
                      onChange={e => setPasscode(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Slot *
                  </label>
                  <select
                    value={slotId}
                    onChange={e => setSlotId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {timeSlots.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.label} (Period {s.period})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Room Allocation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room Allocation *
                </label>
                <select
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course Code & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE 3101"
                    value={courseCode}
                    onChange={e => setCourseCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Database Systems"
                    value={courseTitle}
                    onChange={e => setCourseTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Reason (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Reschedule (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Makeup Class for missed lecture"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                >
                  {submitting ? 'Checking Room...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL (BATCH SECRET KEY AUTHENTICATION) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Remove Rescheduled Class</h3>
                <p className="text-xs text-slate-500">Release the allocated room</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to remove <strong>{deleteTarget.courseCode}</strong> for{' '}
              <strong>Batch {deleteTarget.batch}</strong> in{' '}
              <strong>{getRoomName(deleteTarget.roomId)}</strong> on{' '}
              <strong>{deleteTarget.date}</strong>?
            </p>

            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-xl font-medium">
                {deleteError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter Secret Key for Batch {deleteTarget.batch}:
              </label>
              <input
                type="password"
                placeholder="Secret Key"
                value={deletePasscode}
                onChange={e => setDeletePasscode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Keep Class
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-sm transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
