'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Shield,
  Sparkles,
  RefreshCw,
  User,
  KeyRound,
  LogOut,
  Lock,
} from 'lucide-react';
import { Room, TimeSlot, RescheduleBooking, VALID_BATCHES, ValidBatch } from '@/lib/types';

export type SessionUser =
  | { role: 'admin'; username: string }
  | { role: 'cr'; username: string; batch: ValidBatch };

const CR_USERNAMES: Record<ValidBatch, string> = {
  '15': 'cr-15',
  '16': 'cr-16',
  '17': 'cr-17',
  '18': 'cr-18',
  '19': 'cr-19',
  '20': 'cr-20',
  '21': 'cr-21',
  '22-A': 'cr-22a',
  '22-B': 'cr-22b',
};

// Returns local date formatted as YYYY-MM-DD
function getLocalTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RescheduleHomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [reschedules, setReschedules] = useState<RescheduleBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('cr-22a');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Add Class Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [date, setDate] = useState(getLocalTodayString);
  const [slotId, setSlotId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [batch, setBatch] = useState<ValidBatch>('22-A');
  const [reason, setReason] = useState('Makeup Class');

  // Edit Class Modal State
  const [editTarget, setEditTarget] = useState<RescheduleBooking | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSlotId, setEditSlotId] = useState('');
  const [editRoomId, setEditRoomId] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editBatch, setEditBatch] = useState<ValidBatch>('22-A');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editingSubmitting, setEditingSubmitting] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<RescheduleBooking | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingSubmitting, setDeletingSubmitting] = useState(false);

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isCR = currentUser?.role === 'cr';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Check Current Authentication Session
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.user.role === 'cr') {
            setBatch(data.user.batch);
          }
        } else {
          setCurrentUser(null);
        }
      }
    } catch {
      setCurrentUser(null);
    }
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
    checkAuth();
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

  // Determine permissions for a specific class item
  const canEditClass = (item: RescheduleBooking) => {
    if (isAdmin) return true;
    if (isCR && currentUser?.batch === item.batch) return true;
    return false;
  };

  const canDeleteClass = () => {
    return isAdmin;
  };

  // Open Add Class Modal with proper batch lock
  const handleOpenAddModal = () => {
    if (!currentUser) {
      setAuthError('Please sign in with your CR or Admin credentials to schedule a class.');
      setIsLoginModalOpen(true);
      return;
    }
    setErrorMsg(null);
    if (currentUser.role === 'cr') {
      setBatch(currentUser.batch);
    }
    setIsAddModalOpen(true);
  };

  // Submit Add Class
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetBatch = isCR && currentUser ? currentUser.batch : batch;

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
          batch: targetBatch,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to add class.');
        return;
      }

      // Success
      try {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {
        // Fallback gracefully if confetti fails to load
      }
      showToast(`🎉 Class scheduled for Batch ${targetBatch}!`);
      setIsAddModalOpen(false);

      // Reset
      setCourseCode('');
      setCourseTitle('');
      setReason('');

      fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal with Prepopulated Values
  const handleOpenEdit = (item: RescheduleBooking) => {
    if (!currentUser) {
      setAuthError('Please sign in to edit classes.');
      setIsLoginModalOpen(true);
      return;
    }
    if (!canEditClass(item)) {
      showToast(`⚠️ Only Batch ${item.batch} CR or Admin can edit this class.`);
      return;
    }

    setEditTarget(item);
    setEditDate(item.date);
    setEditSlotId(item.slotId);
    setEditRoomId(item.roomId);
    setEditCourseCode(item.courseCode);
    setEditCourseTitle(item.courseTitle);
    setEditBatch((item.batch as ValidBatch) || '22-A');
    setEditReason(item.reason || '');
    setEditError(null);
  };

  // Submit Edit Class
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);

    const targetBatch = isCR && currentUser ? currentUser.batch : editBatch;

    setEditingSubmitting(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTarget.id,
          date: editDate,
          slotId: editSlotId,
          roomId: editRoomId,
          courseCode: editCourseCode.trim(),
          courseTitle: editCourseTitle.trim() || editCourseCode.trim(),
          batch: targetBatch,
          reason: editReason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error || 'Failed to update class.');
        return;
      }

      showToast('✏️ Class updated successfully!');
      setEditTarget(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setEditError('Network error updating class.');
    } finally {
      setEditingSubmitting(false);
    }
  };

  // Delete Rescheduled Class (Admin Only)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingSubmitting(true);
    try {
      const res = await fetch(
        `/api/schedule?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete class.');
        return;
      }

      showToast('🗑️ Rescheduled class removed');
      setDeleteTarget(null);
      setDeleteError(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setDeleteError('Network error deleting class');
    } finally {
      setDeletingSubmitting(false);
    }
  };

  // Sign in as CR or Admin
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Unable to sign in.');
        return;
      }

      setCurrentUser(data.user);
      setIsLoginModalOpen(false);
      setLoginPassword('');

      if (data.user.role === 'admin') {
        showToast('🛡️ Signed in as Department Admin');
      } else {
        setBatch(data.user.batch);
        showToast(`🎓 Signed in as CR for Batch ${data.user.batch}`);
      }
    } catch {
      setAuthError('Network error signing in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Sign out
  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setCurrentUser(null);
    setIsPasswordModalOpen(false);
    showToast('Signed out successfully');
  };

  // Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Unable to update password.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setIsPasswordModalOpen(false);
      showToast(data.message || 'Password updated successfully!');
    } catch {
      setAuthError('Network error updating password.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Manual Trigger to Purge Past Classes (Admin Only)
  const handlePurgePast = async () => {
    if (!confirm("Clean up yesterday's and older past classes from database?")) return;
    try {
      setCleaning(true);
      const res = await fetch('/api/schedule?action=cleanup', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(`🧹 ${data.message || 'Past records cleaned up!'}`);
        fetchData();
      } else {
        showToast(`⚠️ ${data.error || 'Cleanup failed'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCleaning(false);
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 shrink-0">
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

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {currentUser ? (
              <>
                {/* User Identity Pill */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  {isAdmin ? (
                    <>
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-indigo-900 font-bold">Admin</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-900 font-bold">CR • Batch {currentUser.batch}</span>
                    </>
                  )}
                </div>

                {/* Change Password */}
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setIsPasswordModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                  title="Change Password"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Password</span>
                </button>

                {/* Sign Out */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 font-semibold text-xs border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setIsLoginModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
              >
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>CR / Admin Sign In</span>
              </button>
            )}

            {/* Storage Saver Clean Button (Admin Only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={handlePurgePast}
                disabled={cleaning}
                title="Automatically purge past dates to save database storage"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer border border-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Clean Past Records</span>
              </button>
            )}

            {/* Add Class Button (CR & Admin) */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Class</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Banner with Role & Feasibility Notice */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
          <div className="max-w-2xl space-y-2 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/80 border border-emerald-500/30 text-xs font-semibold text-emerald-200">
              <Shield className="w-3.5 h-3.5" />
              {isAdmin ? (
                <span>Admin Mode • Full Authority to Edit or Remove Any Class</span>
              ) : isCR ? (
                <span>CR Mode • Authorized to Add & Edit Classes for Batch {currentUser.batch}</span>
              ) : (
                <span>Public View • Sign in with your CR or Admin account to schedule or edit</span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Date-Wise Rescheduled Classes
            </h2>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              When a class is rescheduled, its date row appears below. Rooms are protected against duplicate booking.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>
                <strong>Auto Storage Saver Active:</strong> Past classes are automatically cleared to keep your cloud database fast and storage-efficient.
              </span>
            </div>
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
              <h3 className="text-lg font-bold text-slate-800">No Rescheduled Classes Scheduled</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                No active reschedules. {currentUser ? 'Click Add Class above to allocate a room.' : 'Sign in as your Batch CR or Admin to schedule classes.'}
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
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
                  {rowBookings.map(item => {
                    const editable = canEditClass(item);
                    const deletable = canDeleteClass();

                    return (
                      <div
                        key={item.id}
                        className={`bg-slate-50/70 border rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                          isCR && currentUser?.batch === item.batch
                            ? 'border-emerald-300 ring-1 ring-emerald-200/50 bg-emerald-50/20'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
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

                        {/* Card Action Buttons: EDIT (CR for own batch, or Admin) & DELETE (Admin only) */}
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-medium">
                            Batch: <strong>{item.batch}</strong>
                          </span>

                          <div className="flex items-center gap-1">
                            {/* EDIT BUTTON */}
                            {editable && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                title={isAdmin ? "Edit class (Admin)" : "Edit your batch's class"}
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}

                            {/* DELETE BUTTON (Admin Only) */}
                            {deletable && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(item);
                                  setDeleteError(null);
                                }}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="Remove class (Admin only)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {!editable && !deletable && (
                              <span className="text-[11px] text-slate-400 italic">View Only</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL 1: ADD CLASS */}
      {isAddModalOpen && (
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
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              {/* Batch Selection / Lock */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Department Batch *
                </label>
                {isCR && currentUser ? (
                  <div className="flex items-center justify-between bg-white border border-emerald-300 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-slate-900">Batch {currentUser.batch}</span>
                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      Locked to your CR account
                    </span>
                  </div>
                ) : (
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
                )}
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
                  onClick={() => setIsAddModalOpen(false)}
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

      {/* MODAL 2: EDIT CLASS */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                <h3 className="font-bold text-lg">Edit Rescheduled Class</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{editError}</span>
                </div>
              )}

              {/* Batch Info */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Batch
                </label>
                {isAdmin ? (
                  <select
                    value={editBatch}
                    onChange={e => setEditBatch(e.target.value as ValidBatch)}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {VALID_BATCHES.map(b => (
                      <option key={b} value={b}>
                        Batch {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between bg-white border border-emerald-300 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-slate-900">Batch {editTarget.batch}</span>
                    <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                      Your Batch
                    </span>
                  </div>
                )}
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
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Slot *
                  </label>
                  <select
                    value={editSlotId}
                    onChange={e => setEditSlotId(e.target.value)}
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
                  value={editRoomId}
                  onChange={e => setEditRoomId(e.target.value)}
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
                    value={editCourseCode}
                    onChange={e => setEditCourseCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Title
                  </label>
                  <input
                    type="text"
                    value={editCourseTitle}
                    onChange={e => setEditCourseTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Reschedule
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                >
                  {editingSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CLASS (Admin Only) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Remove Rescheduled Class</h3>
                <p className="text-xs text-slate-500">Release the allocated room (Admin Action)</p>
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
                disabled={deletingSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white cursor-pointer shadow-sm transition-all"
              >
                {deletingSubmitting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SIGN IN (CR & Admin) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleLogin}
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <User className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">CR & Admin Sign In</h3>
                  <p className="text-xs text-slate-500">Authenticate to add or edit classes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* Quick Batch Selection Chips */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-600">
                Quick Select Batch / Role:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VALID_BATCHES.map(b => {
                  const targetUsername = CR_USERNAMES[b] || `cr-${b}`;
                  const isSelected = loginUsername.toLowerCase() === targetUsername.toLowerCase();
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setLoginUsername(targetUsername)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Batch {b}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setLoginUsername('admin')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    loginUsername.toLowerCase() === 'admin'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. cr-22a, cr-15, or admin"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Default CR password: <code className="text-slate-600 font-mono">cr123</code> (or your batch key). Admin: <code className="text-slate-600 font-mono">admin123</code>.
              </p>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer shadow-md shadow-emerald-600/20 transition-all"
            >
              {authSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      )}

      {/* MODAL 5: CHANGE PASSWORD */}
      {isPasswordModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handlePasswordChange}
            className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Change Password</h3>
                <p className="text-xs text-slate-500">
                  {currentUser.role === 'admin'
                    ? 'Updating Department Admin password'
                    : `Updating Batch ${currentUser.batch} CR password`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-xl">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password *
              </label>
              <input
                type="password"
                required
                placeholder="Current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="New password (min 6 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer shadow-md transition-all"
            >
              {authSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
