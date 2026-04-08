'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { TrashIcon } from '@heroicons/react/24/outline';
import type { Attendee, AttendeeStatus } from '@/lib/types';

const STATUS_STYLES: Record<AttendeeStatus, string> = {
    invited: 'bg-blue-100 text-blue-700',
    attended: 'bg-green-100 text-green-700',
    absent: 'bg-red-100  text-red-700',
};

export default function AttendeeTable({
    trainingId,
    initialAttendees,
}: {
    trainingId: string;
    initialAttendees: Attendee[];
}) {
    const router = useRouter();
    const supabase = createClient();
    const [attendees, setAttendees] = useState(initialAttendees);
    const [busy, setBusy] = useState<string | null>(null);

    async function updateStatus(id: string, status: AttendeeStatus) {
        setBusy(id);
        const { error } = await supabase.from('attendees').update({ status }).eq('id', id);
        setBusy(null);
        if (error) { toast.error(error.message); return; }
        setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    }

    async function deleteAttendee(id: string) {
        if (!confirm('Remove this attendee?')) return;
        setBusy(id);
        const { error } = await supabase.from('attendees').delete().eq('id', id);
        setBusy(null);
        if (error) { toast.error(error.message); return; }
        toast.success('Attendee removed');
        setAttendees((prev) => prev.filter((a) => a.id !== id));
        router.refresh();
    }

    if (!attendees.length) {
        return <p className="text-sm text-gray-400">No attendees yet. Add one above.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Email</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {attendees.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{a.full_name}</td>
                            <td className="px-4 py-3 text-gray-500">{a.email}</td>
                            <td className="px-4 py-3">
                                <select
                                    value={a.status}
                                    disabled={busy === a.id}
                                    onChange={(e) => updateStatus(a.id, e.target.value as AttendeeStatus)}
                                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-brand-500 ${STATUS_STYLES[a.status]}`}
                                >
                                    <option value="invited">Invited</option>
                                    <option value="attended">Attended</option>
                                    <option value="absent">Absent</option>
                                </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    onClick={() => deleteAttendee(a.id)}
                                    disabled={busy === a.id}
                                    className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                                    aria-label="Remove attendee"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
