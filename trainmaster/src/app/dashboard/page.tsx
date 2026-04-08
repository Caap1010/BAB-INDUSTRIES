import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import { PlusIcon, CalendarIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { Training } from '@/lib/types';

export default async function DashboardPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const today = new Date().toISOString().split('T')[0];

    const { data: trainings } = await supabase
        .from('trainings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

    const upcoming = (trainings ?? []).filter((t: Training) => t.date >= today);
    const past = (trainings ?? []).filter((t: Training) => t.date < today);

    return (
        <MainContent>
            <Header title="Dashboard" />
            <div className="flex-1 p-8">
                {/* Stats bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Total Trainings', value: trainings?.length ?? 0, color: 'bg-blue-50 text-blue-700' },
                        { label: 'Upcoming', value: upcoming.length, color: 'bg-green-50 text-green-700' },
                        { label: 'Completed', value: past.length, color: 'bg-gray-100 text-gray-600' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={`rounded-xl p-5 ${color}`}>
                            <p className="text-sm font-medium opacity-70">{label}</p>
                            <p className="text-3xl font-bold mt-1">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-800">Upcoming Trainings</h2>
                    <Link
                        href="/trainings/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" /> New Training
                    </Link>
                </div>

                <TrainingList trainings={upcoming} empty="No upcoming trainings yet." />

                <h2 className="text-lg font-semibold text-gray-800 mt-10 mb-4">Past Trainings</h2>
                <TrainingList trainings={past} empty="No past trainings." />
            </div>
        </MainContent>
    );
}

function TrainingCard({ training }: { training: Training }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{training.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{training.description}</p>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {new Date(training.date).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                        </span>
                        <span className="flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {training.duration_hours}h
                        </span>
                        {training.location && (
                            <span className="flex items-center gap-1">
                                <MapPinIcon className="w-3.5 h-3.5" />
                                {training.location}
                            </span>
                        )}
                    </div>
                </div>
                <Link
                    href={`/trainings/${training.id}`}
                    className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                >
                    Manage →
                </Link>
            </div>
        </div>
    );
}

function TrainingList({ trainings, empty }: { trainings: Training[]; empty: string }) {
    if (!trainings.length) {
        return <p className="text-sm text-gray-400 py-6">{empty}</p>;
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trainings.map((t) => <TrainingCard key={t.id} training={t} />)}
        </div>
    );
}
