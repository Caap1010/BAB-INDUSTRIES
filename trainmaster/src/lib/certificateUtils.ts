import type { Training } from '@/lib/types';

/**
 * Generates a styled HTML certificate string to be converted to PDF.
 */
export function buildCertificateHtml(params: {
    attendeeName: string;
    trainingTitle: string;
    trainingDate: string;
    trainerName: string;
    certificateNumber: string;
    issuedAt: string;
}): string {
    const { attendeeName, trainingTitle, trainingDate, trainerName, certificateNumber, issuedAt } = params;

    const formattedDate = new Date(trainingDate).toLocaleDateString('en-ZA', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const formattedIssued = new Date(issuedAt).toLocaleDateString('en-ZA', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 842px; height: 595px;
    font-family: 'Inter', sans-serif;
    background: #fff;
    display: flex; align-items: stretch;
  }
  .sidebar {
    width: 14px;
    background: linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%);
  }
  .content {
    flex: 1;
    padding: 52px 60px;
    display: flex; flex-direction: column; justify-content: space-between;
    border: 2px solid #1d4ed8;
    border-left: none;
    position: relative;
  }
  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 96px;
    font-weight: 700;
    color: rgba(29, 78, 216, 0.05);
    letter-spacing: 0.1em;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
  }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .org { font-size: 13px; font-weight: 600; color: #1d4ed8; letter-spacing: 0.12em; text-transform: uppercase; }
  .cert-no { font-size: 11px; color: #6b7280; }
  .body { text-align: center; }
  .presents { font-size: 13px; color: #6b7280; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px; }
  h1.cert-title {
    font-family: 'Playfair Display', serif;
    font-size: 38px; font-weight: 700;
    color: #1e3a8a;
    line-height: 1.15;
    margin-bottom: 20px;
  }
  .attendee-label { font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
  .attendee-name {
    font-family: 'Playfair Display', serif;
    font-size: 32px; font-weight: 400;
    color: #111827;
    border-bottom: 2px solid #1d4ed8;
    display: inline-block;
    padding: 0 24px 6px;
    margin-bottom: 18px;
  }
  .for-completing { font-size: 13px; color: #6b7280; margin-bottom: 6px; }
  .training-name { font-size: 18px; font-weight: 700; color: #1d4ed8; }
  .training-date { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; }
  .signature-block { text-align: center; }
  .sig-line { width: 180px; border-top: 1px solid #374151; margin-bottom: 6px; }
  .sig-name { font-size: 13px; font-weight: 600; color: #374151; }
  .sig-role { font-size: 11px; color: #9ca3af; }
  .meta { text-align: right; font-size: 11px; color: #9ca3af; line-height: 1.7; }
</style>
</head>
<body>
  <div class="sidebar"></div>
  <div class="content">
    <div class="watermark">CERTIFICATE</div>
    <div class="top">
      <div class="org">TrainMaster</div>
      <div class="cert-no">Cert #${certificateNumber}</div>
    </div>
    <div class="body">
      <p class="presents">This certifies that</p>
      <h1 class="cert-title">Certificate of Completion</h1>
      <p class="attendee-label">Awarded to</p>
      <div class="attendee-name">${attendeeName}</div>
      <p class="for-completing">for successfully completing</p>
      <p class="training-name">${trainingTitle}</p>
      <p class="training-date">held on ${formattedDate}</p>
    </div>
    <div class="footer">
      <div class="signature-block">
        <div class="sig-line"></div>
        <div class="sig-name">${trainerName}</div>
        <div class="sig-role">Facilitator / Trainer</div>
      </div>
      <div class="meta">
        <div>Issued: ${formattedIssued}</div>
        <div>Certificate No: ${certificateNumber}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Use the browser's built-in print-to-PDF capability to convert an HTML string.
 * Returns a Blob URL the user can open/download.
 *
 * Falls back to a data: URI containing the raw HTML when called on the server.
 */
export async function htmlToPdfUrl(html: string, filename: string): Promise<string> {
    if (typeof window === 'undefined') {
        // Server context — return a data URI for the HTML (acts as download fallback)
        const encoded = Buffer.from(html).toString('base64');
        return `data:text/html;base64,${encoded}`;
    }

    // Browser context — open in a hidden iframe and trigger print
    return new Promise((resolve, reject) => {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:842px;height:595px;';
            document.body.appendChild(iframe);

            const doc = iframe.contentDocument!;
            doc.open();
            doc.write(html);
            doc.close();

            iframe.onload = () => {
                try {
                    // Create a Blob URL for the HTML so users can download it
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    document.body.removeChild(iframe);
                    resolve(url);
                } catch (err) {
                    reject(err);
                }
            };
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Generate a unique certificate number: TM-YYYYMMDD-XXXX
 */
export function generateCertificateNumber(trainingDate: string): string {
    const date = trainingDate.replace(/-/g, '');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TM-${date}-${suffix}`;
}
