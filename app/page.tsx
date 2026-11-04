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
  KeyRound,
  Table as TableIcon,
  LayoutGrid,
  Copy,
  LogOut,
  Lock,
} from 'lucide-react';
import { Room, TimeSlot, RescheduleBooking, VALID_BATCHES, ValidBatch } from '@/lib/types';

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

  // Admin Authentication State (Centralized Control & Integrity)
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminAuthSubmitting, setAdminAuthSubmitting] = useState(false);

  // Add Class Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [date, setDate] = useState(getLocalTodayString);
  const [slotId, setSlotId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [batch, setBatch] = useState<ValidBatch>('22-A');
  const [passcode, setPasscode] = useState('');
  const [reason, setReason] = useState('Makeup Class');

  // Edit Class Modal State
  const [editTarget, setEditTarget] = useState<RescheduleBooking | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSlotId, setEditSlotId] = useState('');
  const [editRoomId, setEditRoomId] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseTitle, setEditCourseTitle] = useState('');
  const [editBatch, setEditBatch] = useState<ValidBatch>('22-A');
  const [editPasscode, setEditPasscode] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editingSubmitting, setEditingSubmitting] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<RescheduleBooking | null>(null);
  const [deletePasscode, setDeletePasscode] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingSubmitting, setDeletingSubmitting] = useState(false);

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Display Style: 'table' (Compact Schedule Table) or 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Check Admin Authentication Session
  const checkAdminSession = async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    } catch {
      setIsAdmin(false);
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
    checkAdminSession();
  }, []);

  // Responsive Display Mode: Desktop defaults to 'table' (Compact Schedule Table),
  // while mobile (< 768px) automatically switches to 'cards' mode.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkViewport = () => {
      const isMobile = window.innerWidth < 768;
      setViewMode(isMobile ? 'cards' : 'table');
    };

    // Set initial view mode based on current screen width
    checkViewport();

    // Automatically switch when resizing or rotating between mobile and desktop viewports
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  useEffect(() => {
    if (rooms.length > 0 && !roomId) setRoomId(rooms[0].id);
    if (timeSlots.length > 0 && !slotId) setSlotId(timeSlots[0].id);
  }, [rooms, timeSlots]);

  // Group by Date & Sort chronologically by slot period
  const dateWiseRows = useMemo(() => {
    const map = new Map<string, RescheduleBooking[]>();
    for (const item of reschedules) {
      if (item.status === 'CONFIRMED' || !item.status) {
        const list = map.get(item.date) || [];
        list.push(item);
        map.set(item.date, list);
      }
    }
    const sortedDates = Array.from(map.entries()).sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
    return sortedDates.map(([d, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        const slotA = timeSlots.find(s => s.id === a.slotId)?.period ?? 99;
        const slotB = timeSlots.find(s => s.id === b.slotId)?.period ?? 99;
        return slotA - slotB;
      });
      return [d, sortedItems] as [string, RescheduleBooking[]];
    });
  }, [reschedules, timeSlots]);

  // Helpers to resolve Room and Slot labels
  const getRoomName = (rId: string) => {
    const found = rooms.find(r => r.id === rId);
    return found ? found.name : rId;
  };

  const getSlot = (sId: string) => {
    return timeSlots.find(s => s.id === sId);
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

  // WhatsApp Notice Generation
  const handleCopyNotice = async (item: RescheduleBooking) => {
    const room = getRoomName(item.roomId);
    const slot = getSlot(item.slotId);
    const time = slot ? slot.label : item.slotId;
    const period = slot ? ` (Period ${slot.period})` : '';
    const dateFormatted = formatDateHeader(item.date);

    const text = [
      `📢 *RESCHEDULED CLASS NOTICE*`,
      `📅 *Date:* ${dateFormatted} (${item.date})`,
      `⏰ *Time:* ${time}${period}`,
      `🏛️ *Room:* ${room}`,
      `📚 *Course:* ${item.courseCode}${item.courseTitle ? ` - ${item.courseTitle}` : ''}`,
      `👥 *Batch:* Batch ${item.batch}`,
      item.reason ? `📝 *Note:* ${item.reason}` : '',
    ].filter(Boolean).join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('📋 Notice copied to clipboard! Ready to share on WhatsApp.');
    } catch {
      showToast('⚠️ Could not copy notice.');
    }
  };

  // Copy Full Day Schedule
  const handleCopyDaySchedule = async (dateStr: string, bookings: RescheduleBooking[]) => {
    const dateFormatted = formatDateHeader(dateStr);
    const lines = [
      `📢 *CLASS SCHEDULE — ${dateFormatted.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    bookings.forEach((item, idx) => {
      const room = getRoomName(item.roomId);
      const slot = getSlot(item.slotId);
      lines.push(
        `${idx + 1}. *${item.courseCode}*${item.courseTitle ? ` - ${item.courseTitle}` : ''}`,
        `   ⏰ ${slot ? slot.label : item.slotId}${slot ? ` (Period ${slot.period})` : ''}`,
        `   🏛️ Room: ${room} | 👥 Batch ${item.batch}`,
        item.reason ? `   📝 Note: ${item.reason}` : '',
        `   ────────────────────────`
      );
    });

    const text = lines.filter(Boolean).join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      showToast(`📋 Copied all notices for ${dateFormatted}!`);
    } catch {
      showToast('⚠️ Could not copy schedule.');
    }
  };

  // Admin Sign In Handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setAdminAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: adminPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminAuthError(data.error || 'Authentication failed. Check your admin password.');
        return;
      }

      setIsAdmin(true);
      setIsAdminModalOpen(false);
      setAdminPassword('');
      showToast('🛡️ Signed in as Department Admin (Centralized Control Active)');
    } catch {
      setAdminAuthError('Network error during admin sign in.');
    } finally {
      setAdminAuthSubmitting(false);
    }
  };

  // Admin Sign Out Handler
  const handleAdminLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAdmin(false);
    showToast('Signed out of Admin Mode');
  };

  // Admin Change Password Handler
  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setAdminAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminAuthError(data.error || 'Failed to update admin password.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setIsPasswordModalOpen(false);
      showToast(data.message || 'Admin password updated successfully!');
    } catch {
      setAdminAuthError('Network error updating password.');
    } finally {
      setAdminAuthSubmitting(false);
    }
  };

  // Open Add Class Modal
  const handleOpenAddModal = () => {
    setErrorMsg(null);
    setPasscode('');
    setIsAddModalOpen(true);
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
    if (!batch) {
      setErrorMsg('Please select a batch.');
      return;
    }
    if (!isAdmin && !passcode.trim()) {
      setErrorMsg(`Please enter the CR Key for Batch ${batch} before posting.`);
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
          batch,
          passcode: isAdmin ? (passcode.trim() || 'admin123') : passcode.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to add class.');
        return;
      }

      // Track newly added class to highlight it
      if (data.booking?.id) {
        setNewlyAddedId(data.booking.id);
        setTimeout(() => setNewlyAddedId(null), 6000);
      }

      // Maintain compact table on desktop, but cards mode on mobile
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      setViewMode(isMobile ? 'cards' : 'table');

      try {
        const confetti = (await import('canvas-confetti')).default;
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {}

      showToast(`🎉 Class scheduled for Batch ${batch}!`);
      setIsAddModalOpen(false);

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

  // Open Edit Modal
  const handleOpenEdit = (item: RescheduleBooking) => {
    setEditTarget(item);
    setEditDate(item.date);
    setEditSlotId(item.slotId);
    setEditRoomId(item.roomId);
    setEditCourseCode(item.courseCode);
    setEditCourseTitle(item.courseTitle);
    setEditBatch((item.batch as ValidBatch) || '22-A');
    setEditReason(item.reason || '');
    setEditPasscode('');
    setEditError(null);
  };

  // Submit Edit Class
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);

    if (!isAdmin && !editPasscode.trim()) {
      setEditError(`Please enter the CR key for Batch ${editTarget.batch} to authorize changes.`);
      return;
    }

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
          batch: editBatch,
          passcode: isAdmin ? (editPasscode.trim() || 'admin123') : editPasscode.trim(),
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
      setEditPasscode('');
      fetchData();
    } catch (err) {
      console.error(err);
      setEditError('Network error updating class.');
    } finally {
      setEditingSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (item: RescheduleBooking) => {
    setDeleteTarget(item);
    setDeletePasscode('');
    setDeleteError(null);
  };

  // Confirm Delete Rescheduled Class
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (!isAdmin && !deletePasscode.trim()) {
      setDeleteError(`Please enter the CR key for Batch ${deleteTarget.batch}.`);
      return;
    }

    setDeletingSubmitting(true);
    try {
      const passcodeParam = isAdmin ? (deletePasscode.trim() || 'admin123') : deletePasscode.trim();
      const res = await fetch(
        `/api/schedule?id=${encodeURIComponent(deleteTarget.id)}&passcode=${encodeURIComponent(
          passcodeParam
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
    } finally {
      setDeletingSubmitting(false);
    }
  };

  // Manual Trigger to Purge Past Classes (Admin Controlled)
  const handlePurgePast = async () => {
    if (!isAdmin) {
      setAdminAuthError('Admin authentication is required to perform database storage cleanup.');
      setIsAdminModalOpen(true);
      return;
    }

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
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-800 font-sans pb-12">
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
                Department Portal • 9 Batches • Centralized Admin & Room Conflict Shield
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Admin Control Bar */}
            {isAdmin ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Admin Mode</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAdminAuthError(null);
                    setIsPasswordModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
                  title="Change Admin Password"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Password</span>
                </button>

                <button
                  type="button"
                  onClick={handlePurgePast}
                  disabled={cleaning}
                  title="Automatically purge past dates to save database storage"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer border border-slate-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">Clean Past</span>
                </button>

                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 font-semibold text-xs border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                  title="Sign out of Admin Mode"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAdminAuthError(null);
                  setIsAdminModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                title="Department Admin Authentication"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Admin Sign In</span>
              </button>
            )}

            {/* Add Class Button */}
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
                No active reschedules. Click Add Class above to allocate a room using your CR key or Admin privileges.
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
          <div className="space-y-6">
            {/* VIEW MODE & SECTION HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Rescheduled Schedule</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {reschedules.filter(r => r.status === 'CONFIRMED' || !r.status).length} Total Classes
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Ordered chronologically by lecture periods
                </p>
              </div>

              {/* View Mode Switcher */}
              <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Compact Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
              </div>
            </div>

            {/* RENDER DATES */}
            {dateWiseRows.map(([dateStr, rowBookings]) => (
              <div
                key={dateStr}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                {/* DATE ROW HEADER */}
                <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                        {formatDateHeader(dateStr)}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {dateStr} • {rowBookings.length} {rowBookings.length === 1 ? 'class' : 'classes'} scheduled
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Share Full Day Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyDaySchedule(dateStr, rowBookings)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold border border-slate-700 hover:border-emerald-500/40 transition-all cursor-pointer"
                      title="Copy full day schedule for WhatsApp"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Day Notice</span>
                    </button>
                  </div>
                </div>

                {/* VIEW MODE 1: COMPACT SCHEDULE TABLE */}
                {viewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[620px]">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                          <th className="py-3 px-5 sm:px-6 w-[24%]">Time Slot</th>
                          <th className="py-3 px-4 sm:px-6 w-[16%]">Room</th>
                          <th className="py-3 px-4 sm:px-6 w-[34%]">Course & Topic</th>
                          <th className="py-3 px-4 sm:px-6 w-[12%] text-center">Batch</th>
                          <th className="py-3 px-5 sm:px-6 w-[14%] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                        {rowBookings.map(item => {
                          const slot = getSlot(item.slotId);
                          const isNewlyAdded = item.id === newlyAddedId;

                          return (
                            <tr
                              key={item.id}
                              className={`transition-all duration-300 group ${
                                isNewlyAdded
                                  ? 'bg-emerald-100/80 ring-2 ring-emerald-500 ring-inset'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* TIME COLUMN */}
                              <td className="py-3.5 px-5 sm:px-6 align-middle">
                                <div className="flex items-center gap-2.5">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs shrink-0 border border-emerald-200/80">
                                    {slot ? `P${slot.period}` : '•'}
                                  </span>
                                  <div className="leading-tight">
                                    <div className="font-bold text-slate-800 whitespace-nowrap">
                                      {slot ? slot.label : item.slotId}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium">
                                      {slot ? `Period ${slot.period}` : 'Custom Slot'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* ROOM COLUMN */}
                              <td className="py-3.5 px-4 sm:px-6 align-middle">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 whitespace-nowrap group-hover:bg-emerald-50 group-hover:text-emerald-900 group-hover:border-emerald-200 transition-colors">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{getRoomName(item.roomId)}</span>
                                </span>
                              </td>

                              {/* COURSE & TOPIC COLUMN */}
                              <td className="py-3.5 px-4 sm:px-6 align-middle">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-extrabold text-slate-900">
                                      {item.courseCode}
                                    </span>
                                    {item.courseTitle && item.courseTitle !== item.courseCode && (
                                      <span className="text-slate-600 font-medium">
                                        — {item.courseTitle}
                                      </span>
                                    )}
                                    {isNewlyAdded && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white animate-pulse shadow-xs">
                                        ✨ Just Added
                                      </span>
                                    )}
                                  </div>
                                  {item.reason && (
                                    <p className="text-[11px] text-slate-500 italic flex items-center gap-1">
                                      <span className="not-italic font-semibold text-slate-400">Note:</span>
                                      <span>{item.reason}</span>
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* BATCH COLUMN */}
                              <td className="py-3.5 px-4 sm:px-6 align-middle text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap bg-emerald-50 text-emerald-900 border-emerald-200">
                                  Batch {item.batch}
                                </span>
                              </td>

                              {/* ACTIONS COLUMN */}
                              <td className="py-3.5 px-5 sm:px-6 align-middle text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {/* WhatsApp Copy Notice */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyNotice(item)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    title="Copy WhatsApp Notice"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>

                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                    title={isAdmin ? "Edit class (Admin Authority)" : "Edit class (CR key required)"}
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span className="hidden lg:inline">Edit</span>
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDelete(item)}
                                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                    title={isAdmin ? "Remove class (Admin Authority)" : "Remove class (CR key required)"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* CARDS DISPLAY STYLE (ALTERNATE VIEW) */
                  <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rowBookings.map(item => {
                      const isNewlyAdded = item.id === newlyAddedId;

                      return (
                        <div
                          key={item.id}
                          className={`bg-slate-50/70 border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                            isNewlyAdded
                              ? 'border-emerald-500 ring-2 ring-emerald-500/80 bg-emerald-50/60'
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
                                {isNewlyAdded && (
                                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                    New
                                  </span>
                                )}
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

                          {/* Card Action Buttons */}
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-medium">
                              Batch: <strong>{item.batch}</strong>
                            </span>

                            <div className="flex items-center gap-1">
                              {/* Copy WhatsApp Notice */}
                              <button
                                type="button"
                                onClick={() => handleCopyNotice(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Copy WhatsApp Notice"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* EDIT BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                title={isAdmin ? "Edit class (Admin Authority)" : "Edit class (CR key required)"}
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              {/* DELETE BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(item)}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title={isAdmin ? "Remove class (Admin Authority)" : "Remove class (CR key required)"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL 1: ADD RESCHEDULED CLASS */}
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

              {/* CR Batch & Key Section */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{isAdmin ? 'Admin Scheduling Authority' : 'CR Batch Authentication *'}</span>
                  </div>
                  {isAdmin ? (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                      Admin Override Active
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-medium">Each batch has its own key</span>
                  )}
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
                      {isAdmin ? 'CR Key (Optional for Admin)' : `CR Key for Batch ${batch} *`}
                    </label>
                    <input
                      type="password"
                      required={!isAdmin}
                      placeholder={isAdmin ? 'Admin override active' : `e.g. key-${batch.toLowerCase()}`}
                      value={passcode}
                      onChange={e => setPasscode(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {isAdmin
                    ? 'As Admin, you can post classes directly for any batch.'
                    : 'Provide your batch\'s CR secret key before posting. No shared common password.'}
                </p>
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

              {/* Batch & Authorization */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{isAdmin ? 'Admin Override Authority' : 'CR Authorization *'}</span>
                  </div>
                  {isAdmin && (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                      Admin Control
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Batch
                    </label>
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
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {isAdmin ? 'CR Key (Optional for Admin)' : `CR Key for Batch ${editTarget.batch} *`}
                    </label>
                    <input
                      type="password"
                      required={!isAdmin}
                      placeholder={isAdmin ? 'Admin override active' : `Secret key for Batch ${editTarget.batch}`}
                      value={editPasscode}
                      onChange={e => setEditPasscode(e.target.value)}
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

      {/* MODAL 3: DELETE CLASS */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Remove Rescheduled Class</h3>
                <p className="text-xs text-slate-500">
                  {isAdmin ? 'Admin Global Authority' : 'Release allocated room'}
                </p>
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

            {!isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter CR Secret Key for Batch {deleteTarget.batch}:
                </label>
                <input
                  type="password"
                  required
                  placeholder="CR Secret Key"
                  value={deletePasscode}
                  onChange={e => setDeletePasscode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
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
                {deletingSubmitting ? 'Removing...' : (isAdmin ? 'Confirm Remove (Admin)' : 'Confirm Remove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADMIN SIGN IN */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAdminLogin}
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Department Admin Sign In</h3>
                  <p className="text-xs text-slate-500">Centralized control and management authority</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminAuthError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{adminAuthError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Password *
              </label>
              <input
                type="password"
                required
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Default password: <code className="text-slate-600 font-mono">admin123</code> (or your custom ADMIN_PASSWORD).
              </p>
            </div>

            <button
              type="submit"
              disabled={adminAuthSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer shadow-md shadow-indigo-600/20 transition-all"
            >
              {adminAuthSubmitting ? 'Authenticating...' : 'Sign In as Admin'}
            </button>
          </form>
        </div>
      )}

      {/* MODAL 5: CHANGE ADMIN PASSWORD */}
      {isPasswordModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleAdminPasswordChange}
            className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Change Admin Password</h3>
                <p className="text-xs text-slate-500">Update Department Admin master credentials</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminAuthError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-xl">
                {adminAuthError}
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={adminAuthSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer shadow-md transition-all"
            >
              {adminAuthSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
