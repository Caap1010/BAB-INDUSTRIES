import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import CertificateGenerator from '@/components/certificates/CertificateGenerator';
import CertificateList from '@/components/certificates/CertificateList';

export default async function CertificatesPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: training } = await supabase
        .from('trainings').select('*').eq('id', params.id).eq('user_id', user.id).single();
    if (!training) notFound();

    const { data: attendees } = await supabase
        .from('attendees').select('*').eq('training_id', params.id).eq('status', 'attended').order('full_name');

    const { data: certificates } = await supabase
        .from('certificates')
        .select('*, attendee:attendees(*)')
        .eq('training_id', params.id)
        .order('issued_at', { ascending: false });

    const trainerName = user.user_metadata?.name ?? user.email ?? 'Trainer';

    return (
        <MainContent>
            <Header title={`Certificates — ${training.title}`} />
            <div className="flex-1 p-8 space-y-10">
                <CertificateGenerator
                    training={training}
                    attendees={attendees ?? []}
                    existingIds={certificates?.map((c) => c.attendee_id) ?? []}
                    trainerName={trainerName}
                />
                <div>
                    <h2 className="text-base font-semibold text-gray-800 mb-4">
                        Issued Certificates <span className="font-normal text-gray-400">({certificates?.length ?? 0})</span>
                    </h2>
                    <CertificateList certificates={certificates ?? []} />
                </div>
            </div>
        </MainContent>
    );
}
