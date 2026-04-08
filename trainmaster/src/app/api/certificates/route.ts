import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get('training_id');

    let query = supabase
        .from('certificates')
        .select('*, trainings!inner(user_id), attendees(full_name, email)')
        .eq('trainings.user_id', user.id)
        .order('issued_at', { ascending: false });

    if (trainingId) {
        query = query.eq('training_id', trainingId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
