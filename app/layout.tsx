import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UniSchedule - University Class Reschedule & Room Allocation',
  description: 'Conflict-free classroom allocation and rescheduling portal for University Class Captains and Coordinators',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-emerald-500 selection:text-white flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <footer className="w-full border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-600 mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-center gap-2">
            <span className="text-emerald-600 font-bold">✨</span>
            <p className="font-semibold text-slate-700 tracking-wide">
              All credit goes to the King AI Agents and his friend Sakib Rayhan
            </p>
            <span className="text-emerald-600 font-bold">✨</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
