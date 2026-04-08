import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import CertificateList from '@/components/certificates/CertificateList';

export default async function CertificatesIndexPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Fetch all certificates for this user's trainings
    const { data: certificates } = await supabase
        .from('certificates')
        .select('*, attendee:attendees(*), training:trainings(*)')
        .in(
            'training_id',
            (await supabase.from('trainings').select('id').eq('user_id', user.id)).data?.map((t) => t.id) ?? []
        )
        .order('issued_at', { ascending: false });

    return (
        <MainContent>
            <Header title="Certificates" />
            <div className="flex-1 p-8">
                <p className="text-sm text-gray-500 mb-6">All certificates issued across your training sessions.</p>
                <CertificateList certificates={certificates ?? []} />
            </div>
        </MainContent>
    );
}
