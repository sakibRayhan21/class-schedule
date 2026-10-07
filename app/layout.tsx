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
      <body className="antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
