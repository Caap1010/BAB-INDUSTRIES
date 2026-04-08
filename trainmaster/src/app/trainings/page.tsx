import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import MainContent from '@/components/layout/MainContent';
import Header from '@/components/layout/Header';
import { PlusIcon, CalendarIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { Training } from '@/lib/types';

export default async function TrainingsPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: trainings } = await supabase
        .from('trainings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    return (
        <MainContent>
            <Header title="Trainings" />
            <div className="flex-1 p-8">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">{trainings?.length ?? 0} training session{trainings?.length !== 1 ? 's' : ''}</p>
                    <Link
                        href="/trainings/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" /> New Training
                    </Link>
                </div>

                {trainings?.length === 0 && (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-lg font-medium">No trainings yet</p>
                        <p className="text-sm mt-1">Create your first training session to get started.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(trainings ?? []).map((t: Training) => (
                        <Link
                            key={t.id}
                            href={`/trainings/${t.id}`}
                            className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-brand-300 transition-all group"
                        >
                            <h3 className="font-semibold text-gray-800 group-hover:text-brand-700 truncate">{t.title}</h3>
                            {t.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                            )}
                            <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {new Date(t.date).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                                </span>
                                <span className="flex items-center gap-1">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    {t.duration_hours}h
                                </span>
                                {t.location && (
                                    <span className="flex items-center gap-1">
                                        <MapPinIcon className="w-3.5 h-3.5" />
                                        {t.location}
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MainContent>
    );
}
