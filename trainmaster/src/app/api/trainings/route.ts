import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { title, description, date, duration_hours, location } = body;

    if (!title || !date) {
        return NextResponse.json({ error: 'title and date are required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('trainings').insert({
        user_id: user.id,
        title,
        description: description ?? '',
        date,
        duration_hours: Number(duration_hours ?? 1),
        location: location ?? '',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
