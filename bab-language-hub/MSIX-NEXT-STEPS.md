# BAB Language Hub — MSIX Next Steps (Work Laptop Restricted)

Your work laptop is blocking key endpoints/tunneling needed for automatic MSIX generation.

## What is already done

- PWA setup is complete (manifest + service worker + install flow).
- Branding/icons are configured to use BAB Language Hub logo assets.
- Automation files are prepared:
  - `generate-msix.ps1`
  - `pwabuilder-msix-request.json`

## Fastest path now

1. Host `bab-language-hub` on a public HTTPS URL (GitHub Pages, Netlify, Vercel, etc.).
2. On any network/machine that can reach PWABuilder endpoints, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\generate-msix.ps1 -PublicUrl "https://your-public-url"
```

1. Output package will be saved to:

```text
bab-language-hub\dist\BAB-Language-Hub-msix.zip
```

## If script is blocked by policy

- Open <https://www.pwabuilder.com> on an unrestricted machine/network.
- Paste your public app URL.
- Choose Windows package generation and download the package zip.

## Publisher note

- Browser install prompts use site origin/domain as publisher context.
- For controlled publisher branding in packaged output, use MSIX generation workflow (script/PWABuilder) with your chosen publisher details.
