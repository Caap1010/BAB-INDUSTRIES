import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import type { Attendee } from '@/lib/types';

const STATUS_STYLES = {
    invited: 'bg-blue-100 text-blue-700',
    attended: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
};

export default async function AttendeesPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: userTrainings } = await supabase
        .from('trainings').select('id').eq('user_id', user.id);
    const trainingIds = userTrainings?.map((t) => t.id) ?? [];

    const { data: attendees } = await supabase
        .from('attendees')
        .select('*, training:trainings(id, title)')
        .in('training_id', trainingIds.length ? trainingIds : [''])
        .order('full_name');

    return (
        <MainContent>
            <Header title="Attendees" />
            <div className="flex-1 p-8">
                <p className="text-sm text-gray-500 mb-6">All attendees across your training sessions.</p>
                {!attendees?.length ? (
                    <p className="text-gray-400 text-sm">No attendees found. Add attendees through a training session.</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                                <tr>
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Email</th>
                                    <th className="px-4 py-3 text-left">Training</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {(attendees as (Attendee & { training: { id: string; title: string } })[]).map((a) => (
                                    <tr key={a.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">{a.full_name}</td>
                                        <td className="px-4 py-3 text-gray-500">{a.email}</td>
                                        <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{a.training?.title ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[a.status]}`}>
                                                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </MainContent>
    );
}
