'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Attendee } from '@/lib/types';

export default function AttendanceMarker({
    trainingId,
    initialAttendees,
}: {
    trainingId: string;
    initialAttendees: Attendee[];
}) {
    const supabase = createClient();
    const [attendees, setAttendees] = useState(initialAttendees);
    const [busy, setBusy] = useState<string | null>(null);

    async function toggle(id: string, current: string) {
        const next = current === 'attended' ? 'absent' : 'attended';
        setBusy(id);
        const { error } = await supabase.from('attendees').update({ status: next }).eq('id', id);
        setBusy(null);
        if (error) { toast.error(error.message); return; }
        setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, status: next } : a)));
    }

    const attended = attendees.filter((a) => a.status === 'attended').length;

    return (
        <div className="max-w-xl space-y-3">
            <p className="text-xs text-gray-400 mb-4">{attended} / {attendees.length} marked as attended</p>
            {attendees.map((a) => (
                <label
                    key={a.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${a.status === 'attended' ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                        } ${busy === a.id ? 'opacity-50 pointer-events-none' : ''}`}
                >
                    <input
                        type="checkbox"
                        checked={a.status === 'attended'}
                        onChange={() => toggle(a.id, a.status)}
                        className="w-5 h-5 accent-green-600 rounded"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">{a.full_name}</p>
                        <p className="text-xs text-gray-400">{a.email}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.status === 'attended' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {a.status === 'attended' ? 'Attended' : 'Absent'}
                    </span>
                </label>
            ))}
            {!attendees.length && <p className="text-sm text-gray-400">No attendees found for this training.</p>}
        </div>
    );
}
