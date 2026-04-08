import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function assertOwnership(supabase: ReturnType<typeof createClient>, trainingId: string, userId: string) {
    const { data } = await supabase
        .from('trainings').select('id').eq('id', trainingId).eq('user_id', userId).single();
    return !!data;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await assertOwnership(supabase, params.id, user.id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data, error } = await supabase
        .from('attendees').select('*').eq('training_id', params.id).order('full_name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await assertOwnership(supabase, params.id, user.id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { full_name, email } = body;
    if (!full_name || !email) {
        return NextResponse.json({ error: 'full_name and email are required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('attendees').insert({
        training_id: params.id,
        full_name,
        email,
        status: 'invited',
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
