'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { buildCertificateHtml, generateCertificateNumber, htmlToPdfUrl } from '@/lib/certificateUtils';
import { DocumentCheckIcon } from '@heroicons/react/24/outline';
import type { Attendee, Training } from '@/lib/types';

interface Props {
    training: Training;
    attendees: Attendee[];  // already filtered to status === 'attended'
    existingIds: string[];  // attendee_ids that already have certs
    trainerName: string;
}

export default function CertificateGenerator({ training, attendees, existingIds, trainerName }: Props) {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const eligible = attendees.filter((a) => !existingIds.includes(a.id));

    async function generateCertificates() {
        if (!eligible.length) {
            toast('All attended attendees already have certificates.', { icon: 'ℹ️' });
            return;
        }

        setLoading(true);
        let issued = 0;
        const errors: string[] = [];

        for (const attendee of eligible) {
            try {
                const certNumber = generateCertificateNumber(training.date);
                const issuedAt = new Date().toISOString();

                const html = buildCertificateHtml({
                    attendeeName: attendee.full_name,
                    trainingTitle: training.title,
                    trainingDate: training.date,
                    trainerName,
                    certificateNumber: certNumber,
                    issuedAt,
                });

                // Generate a Blob/data URL (client-side)
                const pdfUrl = await htmlToPdfUrl(html, `${certNumber}.html`);

                const { error } = await supabase.from('certificates').insert({
                    attendee_id: attendee.id,
                    training_id: training.id,
                    certificate_number: certNumber,
                    issued_at: issuedAt,
                    pdf_url: pdfUrl,
                });

                if (error) {
                    errors.push(`${attendee.full_name}: ${error.message}`);
                } else {
                    issued++;
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                errors.push(`${attendee.full_name}: ${msg}`);
            }
        }

        setLoading(false);

        if (issued > 0) {
            toast.success(`${issued} certificate${issued > 1 ? 's' : ''} generated!`);
            router.refresh();
        }
        if (errors.length) {
            errors.forEach((e) => toast.error(e));
        }
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                        <DocumentCheckIcon className="w-5 h-5 text-brand-600" />
                        Generate Certificates
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {eligible.length === 0
                            ? 'All attended attendees already have certificates.'
                            : `${eligible.length} attendee${eligible.length > 1 ? 's' : ''} eligible for certificates.`}
                    </p>
                </div>
                <button
                    onClick={generateCertificates}
                    disabled={loading || eligible.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Generating…' : 'Generate Certificates'}
                </button>
            </div>

            {eligible.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-gray-600">
                    {eligible.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block shrink-0" />
                            {a.full_name} <span className="text-gray-400">({a.email})</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
