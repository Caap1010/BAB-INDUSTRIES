import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import AttendeeTable from '@/components/attendees/AttendeeTable';
import AddAttendeeForm from '@/components/attendees/AddAttendeeForm';

export default async function TrainingDetailPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: training } = await supabase
        .from('trainings')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

    if (!training) notFound();

    const { data: attendees } = await supabase
        .from('attendees')
        .select('*')
        .eq('training_id', params.id)
        .order('full_name');

    return (
        <MainContent>
            <Header title={training.title} />
            <div className="flex-1 p-8 space-y-8">
                {/* Training meta */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                        <span><strong className="text-gray-800">Date:</strong> {new Date(training.date).toLocaleDateString('en-ZA', { dateStyle: 'long' })}</span>
                        <span><strong className="text-gray-800">Duration:</strong> {training.duration_hours}h</span>
                        <span><strong className="text-gray-800">Location:</strong> {training.location || '—'}</span>
                    </div>
                    {training.description && <p className="mt-3 text-sm text-gray-500">{training.description}</p>}
                    <div className="flex gap-3 mt-5">
                        <Link href={`/trainings/${training.id}/attendance`} className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
                            Mark Attendance
                        </Link>
                        <Link href={`/trainings/${training.id}/certificates`} className="inline-flex items-center px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors">
                            Certificates
                        </Link>
                    </div>
                </div>

                {/* Add attendee */}
                <div>
                    <h2 className="text-base font-semibold text-gray-800 mb-4">Add Attendee</h2>
                    <AddAttendeeForm trainingId={params.id} />
                </div>

                {/* Attendee list */}
                <div>
                    <h2 className="text-base font-semibold text-gray-800 mb-4">
                        Attendees <span className="text-gray-400 font-normal">({attendees?.length ?? 0})</span>
                    </h2>
                    <AttendeeTable trainingId={params.id} initialAttendees={attendees ?? []} />
                </div>
            </div>
        </MainContent>
    );
}
