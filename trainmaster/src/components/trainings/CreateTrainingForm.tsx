'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
    title: z.string().min(3, 'Title is required'),
    description: z.string().optional(),
    date: z.string().min(1, 'Date is required'),
    duration_hours: z.coerce.number().min(0.5, 'Duration must be at least 0.5'),
    location: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function CreateTrainingForm() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { duration_hours: 8 },
    });

    async function onSubmit(values: FormValues) {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error('Not authenticated'); setLoading(false); return; }

        const { data, error } = await supabase.from('trainings').insert({
            user_id: user.id,
            title: values.title,
            description: values.description ?? '',
            date: values.date,
            duration_hours: values.duration_hours,
            location: values.location ?? '',
        }).select().single();

        setLoading(false);
        if (error) { toast.error(error.message); return; }
        toast.success('Training created!');
        router.push(`/trainings/${data.id}`);
    }

    const fields = [
        { id: 'title', label: 'Title', type: 'text', placeholder: 'e.g. First Aid Level 2' },
        { id: 'date', label: 'Date', type: 'date', placeholder: '' },
        { id: 'duration_hours', label: 'Duration (hours)', type: 'number', placeholder: '8' },
        { id: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Johannesburg CBD' },
    ];

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg" noValidate>
            {fields.map(({ id, label, type, placeholder }) => (
                <div key={id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                        type={type}
                        placeholder={placeholder}
                        step={type === 'number' ? '0.5' : undefined}
                        {...register(id as keyof FormValues)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    />
                    {errors[id as keyof FormValues] && (
                        <p className="mt-1 text-xs text-red-500">{errors[id as keyof FormValues]?.message}</p>
                    )}
                </div>
            ))}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                    rows={4}
                    placeholder="Brief description of the training content…"
                    {...register('description')}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
                />
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                    {loading ? 'Creating…' : 'Create Training'}
                </button>
            </div>
        </form>
    );
}
