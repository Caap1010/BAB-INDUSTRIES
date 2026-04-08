'use client';

import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { Certificate } from '@/lib/types';

export default function CertificateList({ certificates }: { certificates: Certificate[] }) {
    if (!certificates.length) {
        return <p className="text-sm text-gray-400">No certificates issued yet. Generate them above.</p>;
    }

    function downloadCert(cert: Certificate) {
        if (!cert.pdf_url) return;
        const a = document.createElement('a');
        a.href = cert.pdf_url;
        a.download = `${cert.certificate_number}.html`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                        <th className="px-4 py-3 text-left">Recipient</th>
                        <th className="px-4 py-3 text-left">Certificate #</th>
                        <th className="px-4 py-3 text-left">Issued</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {certificates.map((cert) => (
                        <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">
                                {cert.attendee?.full_name ?? '—'}
                                <span className="block text-xs text-gray-400">{cert.attendee?.email}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{cert.certificate_number}</td>
                            <td className="px-4 py-3 text-gray-500">
                                {new Date(cert.issued_at).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {cert.pdf_url ? (
                                    <button
                                        onClick={() => downloadCert(cert)}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
                                    >
                                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                                        Download
                                    </button>
                                ) : (
                                    <span className="text-xs text-gray-300">No file</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
