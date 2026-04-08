'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
    full_name: z.string().min(2, 'Full name is required'),
    email: z.string().email('Invalid email'),
});
type FormValues = z.infer<typeof schema>;

export default function AddAttendeeForm({ trainingId }: { trainingId: string }) {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    async function onSubmit(values: FormValues) {
        setLoading(true);
        const { error } = await supabase.from('attendees').insert({
            training_id: trainingId,
            full_name: values.full_name,
            email: values.email,
            status: 'invited',
        });
        setLoading(false);
        if (error) { toast.error(error.message); return; }
        toast.success('Attendee added!');
        reset();
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap gap-3 items-start" noValidate>
            <div>
                <input
                    type="text"
                    placeholder="Full name"
                    {...register('full_name')}
                    className="px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm w-56"
                />
                {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>}
            </div>
            <div>
                <input
                    type="email"
                    placeholder="Email"
                    {...register('email')}
                    className="px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm w-64"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
                {loading ? 'Adding…' : '+ Add'}
            </button>
        </form>
    );
}
