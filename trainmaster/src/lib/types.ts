export type UserRole = 'trainer' | 'admin';

export interface AppUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface Training {
    id: string;
    user_id: string;
    title: string;
    description: string;
    date: string;         // ISO date string
    duration_hours: number;
    location: string;
    created_at?: string;
}

export type AttendeeStatus = 'invited' | 'attended' | 'absent';

export interface Attendee {
    id: string;
    training_id: string;
    full_name: string;
    email: string;
    status: AttendeeStatus;
    created_at?: string;
}

export interface Certificate {
    id: string;
    attendee_id: string;
    training_id: string;
    certificate_number: string;
    issued_at: string;
    pdf_url: string | null;
    created_at?: string;
    // Joined fields:
    attendee?: Attendee;
    training?: Training;
}
