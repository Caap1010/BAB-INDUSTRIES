import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import AttendanceMarker from '@/components/attendance/AttendanceMarker';

export default async function AttendancePage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: training } = await supabase
        .from('trainings').select('*').eq('id', params.id).eq('user_id', user.id).single();
    if (!training) notFound();

    const { data: attendees } = await supabase
        .from('attendees').select('*').eq('training_id', params.id).order('full_name');

    return (
        <MainContent>
            <Header title={`Attendance — ${training.title}`} />
            <div className="flex-1 p-8">
                <p className="text-sm text-gray-500 mb-6">
                    Check the box next to each attendee who was present. Changes save immediately.
                </p>
                <AttendanceMarker trainingId={params.id} initialAttendees={attendees ?? []} />
            </div>
        </MainContent>
    );
}
