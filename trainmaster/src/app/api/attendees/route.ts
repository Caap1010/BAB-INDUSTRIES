import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get('training_id');

    let query = supabase
        .from('attendees')
        .select('*, trainings!inner(user_id)')
        .eq('trainings.user_id', user.id)
        .order('full_name');

    if (trainingId) {
        query = query.eq('training_id', trainingId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { training_id, full_name, email } = body;

    if (!training_id || !full_name || !email) {
        return NextResponse.json({ error: 'training_id, full_name and email are required' }, { status: 400 });
    }

    // Verify ownership of the training
    const { data: training } = await supabase
        .from('trainings').select('id').eq('id', training_id).eq('user_id', user.id).single();

    if (!training) return NextResponse.json({ error: 'Training not found' }, { status: 404 });

    const { data, error } = await supabase.from('attendees').insert({
        training_id,
        full_name,
        email,
        status: 'invited',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
