import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function assertOwnershipByAttendee(supabase: ReturnType<typeof createClient>, attendeeId: string, userId: string) {
    const { data } = await supabase
        .from('attendees')
        .select('id, trainings!inner(user_id)')
        .eq('id', attendeeId)
        .eq('trainings.user_id', userId)
        .single();
    return !!data;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await assertOwnershipByAttendee(supabase, params.id, user.id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['full_name', 'email', 'status'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('attendees').update(updates).eq('id', params.id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await assertOwnershipByAttendee(supabase, params.id, user.id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error } = await supabase.from('attendees').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
