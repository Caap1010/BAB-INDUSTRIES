import { createClient } from '@/lib/supabase/server';
import { BellIcon } from '@heroicons/react/24/outline';

export default async function Header({ title }: { title: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'TM';

    return (
        <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
            <div className="flex items-center gap-4">
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Notifications">
                    <BellIcon className="w-5 h-5 text-gray-500" />
                </button>
                <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
                    {initials}
                </div>
            </div>
        </header>
    );
}
