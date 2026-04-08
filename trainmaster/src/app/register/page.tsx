'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { AcademicCapIcon } from '@heroicons/react/24/outline';

const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    async function onSubmit(values: FormValues) {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: { data: { name: values.name } },
        });
        setLoading(false);
        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Account created! Check your email to confirm.');
            router.push('/login');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <AcademicCapIcon className="w-10 h-10 text-brand-600" />
                    <span className="text-2xl font-bold text-brand-900">TrainMaster</span>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">Create your account</h2>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                        {[
                            { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Doe', autoComplete: 'name' },
                            { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', autoComplete: 'email' },
                            { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
                            { id: 'confirmPassword', label: 'Confirm Password', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
                        ].map(({ id, label, type, placeholder, autoComplete }) => (
                            <div key={id}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                                <input
                                    type={type}
                                    autoComplete={autoComplete}
                                    placeholder={placeholder}
                                    {...register(id as keyof FormValues)}
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                                />
                                {errors[id as keyof FormValues] && (
                                    <p className="mt-1 text-xs text-red-500">{errors[id as keyof FormValues]?.message}</p>
                                )}
                            </div>
                        ))}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors text-sm"
                        >
                            {loading ? 'Creating account…' : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-brand-600 hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
