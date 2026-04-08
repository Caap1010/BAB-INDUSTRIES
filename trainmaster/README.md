# TrainMaster

A full-stack training management and certificate generation SaaS built with **Next.js 14**, **Supabase**, and **TailwindCSS**.

---

## Features

- **Auth** — Email/password signup & login via Supabase Auth
- **Trainings** — Create, view, edit, and delete training sessions
- **Attendees** — Add attendees per training; track status (invited / attended / absent)
- **Attendance Marking** — Mark attendance with live checkbox toggles
- **Certificate Generator** — Auto-generate styled PDF certificates for attendees who attended
- **Certificate Downloads** — Download individual certificates as PDFs
- **Dashboard** — Overview of upcoming and past trainings with quick stats

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Auth & DB | Supabase (PostgreSQL + RLS) |
| Styling | TailwindCSS 3 |
| Forms | react-hook-form + zod |
| Icons | @heroicons/react |
| Toasts | react-hot-toast |
| Deployment | Vercel |

---

## Getting Started

### 1. Prerequisites

- Node.js ≥ 18
- A [Supabase](https://supabase.com) account (free tier is sufficient)
- A [Vercel](https://vercel.com) account (for deployment)

---

### 2. Clone the repository

```bash
git clone <your-repo-url>
cd trainmaster
```

---

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these values in your Supabase project under **Settings → API**.

---

### 4. Set up the database

1. Go to your Supabase project dashboard.
2. Open **SQL Editor** (left sidebar).
3. Copy the contents of [`supabase/schema.sql`](supabase/schema.sql) and paste it into the editor.
4. Click **Run**.

This creates the following tables with Row-Level Security (RLS) enabled:

| Table | Description |
|---|---|
| `users` | User profiles linked to `auth.users` |
| `trainings` | Training sessions owned by a user |
| `attendees` | Attendees per training |
| `certificates` | Issued certificates per attendee |

A trigger (`handle_new_user`) automatically creates a `users` profile on every signup.

---

### 5. Install dependencies

```bash
npm install
```

---

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
trainmaster/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── trainings/          # GET (list), POST (create)
│   │   │   │   └── [id]/           # GET, PATCH, DELETE single training
│   │   │   │       └── attendees/  # GET, POST attendees for a training
│   │   │   ├── attendees/          # GET (list), POST (create)
│   │   │   │   └── [id]/           # PATCH, DELETE single attendee
│   │   │   └── certificates/       # GET (list, filter by training_id)
│   │   ├── dashboard/              # Dashboard page
│   │   ├── trainings/
│   │   │   ├── new/                # Create training form
│   │   │   └── [id]/
│   │   │       ├── attendance/     # Mark attendance
│   │   │       └── certificates/   # Generate & download certificates
│   │   ├── attendees/              # All attendees view
│   │   ├── certificates/           # All certificates view
│   │   ├── login/
│   │   └── register/
│   ├── components/
│   │   ├── layout/                 # Sidebar, Header, MainContent
│   │   ├── trainings/              # CreateTrainingForm
│   │   ├── attendees/              # AddAttendeeForm, AttendeeTable
│   │   ├── attendance/             # AttendanceMarker
│   │   └── certificates/          # CertificateGenerator, CertificateList
│   ├── lib/
│   │   ├── supabase/               # client.ts, server.ts, middleware.ts
│   │   ├── types.ts                # Shared TypeScript interfaces
│   │   └── certificateUtils.ts     # Certificate HTML + PDF Blob generation
│   └── middleware.ts               # Auth guard for protected routes
├── supabase/
│   └── schema.sql                  # Full database schema
├── .env.example                    # Template for environment variables
├── vercel.json                     # Vercel deployment config
└── package.json
```

---

## Protected Routes

The following paths require authentication. Unauthenticated users are redirected to `/login`:

- `/dashboard`
- `/trainings`
- `/attendees`
- `/certificates`

---

## API Reference

All API routes require the user to be authenticated (Supabase session cookie). Ownership is enforced — users can only access their own data.

### Trainings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/trainings` | List all trainings for the current user |
| `POST` | `/api/trainings` | Create a new training |
| `GET` | `/api/trainings/:id` | Get a single training |
| `PATCH` | `/api/trainings/:id` | Update a training |
| `DELETE` | `/api/trainings/:id` | Delete a training |
| `GET` | `/api/trainings/:id/attendees` | List attendees for a training |
| `POST` | `/api/trainings/:id/attendees` | Add an attendee to a training |

### Attendees

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/attendees?training_id=...` | List attendees (optionally filter by training) |
| `POST` | `/api/attendees` | Create an attendee |
| `PATCH` | `/api/attendees/:id` | Update attendee (name, email, status) |
| `DELETE` | `/api/attendees/:id` | Delete an attendee |

### Certificates

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/certificates?training_id=...` | List certificates (optionally filter by training) |

---

## Deploying to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked about environment variables, add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Option B — Vercel Dashboard

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repo.
3. Add the two environment variables above under **Environment Variables**.
4. Click **Deploy**.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Your Supabase anon/public API key |

---

## License

MIT
