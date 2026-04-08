'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    HomeIcon,
    AcademicCapIcon,
    UsersIcon,
    DocumentTextIcon,
    ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    { href: '/trainings', label: 'Trainings', icon: AcademicCapIcon },
    { href: '/attendees', label: 'Attendees', icon: UsersIcon },
    { href: '/certificates', label: 'Certificates', icon: DocumentTextIcon },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    async function handleSignOut() {
        await supabase.auth.signOut();
        toast.success('Signed out');
        router.push('/login');
    }

    return (
        <aside className="flex flex-col w-64 bg-brand-900 min-h-screen">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-brand-700">
                <AcademicCapIcon className="w-8 h-8 text-white" />
                <span className="text-white font-bold text-xl tracking-tight">TrainMaster</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1">
                {nav.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
                                    ? 'bg-brand-600 text-white'
                                    : 'text-blue-100 hover:bg-brand-700 hover:text-white'
                                }`}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Sign-out */}
            <div className="px-4 pb-6">
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-brand-700 hover:text-white transition-colors"
                >
                    <ArrowRightOnRectangleIcon className="w-5 h-5 shrink-0" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
