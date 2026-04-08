import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import CreateTrainingForm from '@/components/trainings/CreateTrainingForm';

export default async function NewTrainingPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    return (
        <MainContent>
            <Header title="Create Training" />
            <div className="flex-1 p-8">
                <div className="max-w-2xl">
                    <p className="text-sm text-gray-500 mb-7">Fill in the details below to create a new training session.</p>
                    <CreateTrainingForm />
                </div>
            </div>
        </MainContent>
    );
}
