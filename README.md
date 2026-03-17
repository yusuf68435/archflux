# ArchFlux

AI-powered architectural facade DXF converter. Upload a facade photo and get a professional CAD-ready DXF file in minutes.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Auth | NextAuth v5 (Google OAuth, database sessions) |
| Database | PostgreSQL 16 + Prisma ORM |
| Queue | Redis 7 + Celery |
| Storage | MinIO (S3-compatible) |
| AI Models | YOLOv8 + SAM2 |
| DXF Generation | ezdxf |
| Payments | Stripe |
| Email | Resend |
| Backend | FastAPI + Python 3.12 |
| Infrastructure | Docker Compose + Nginx |
| CI/CD | GitHub Actions |

## Quick Start (Development)

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### 1. Clone & configure

```bash
git clone <repo>
cd archflux

# Frontend env
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your values

# Docker env
cp docker/.env.example docker/.env
# Edit docker/.env with your values
```

### 2. Start services

```bash
# Start Postgres, Redis, MinIO
docker compose -f docker/docker-compose.yml up -d postgres redis minio

# Run database migrations
cd frontend
npx prisma migrate dev
npx prisma db seed   # (if seed exists)
cd ..
```

### 3. Run frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. Run backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Run Celery worker

```bash
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `S3_ENDPOINT` | MinIO endpoint (e.g. `http://localhost:9000`) |
| `S3_ACCESS_KEY` | MinIO access key |
| `S3_SECRET_KEY` | MinIO secret key |
| `S3_BUCKET_UPLOADS` | Upload bucket name |
| `S3_BUCKET_RESULTS` | Results bucket name |
| `AI_SERVICE_URL` | Backend FastAPI URL |
| `AI_SERVICE_API_KEY` | Backend API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email API key (optional) |
| `EMAIL_FROM` | Sender address (optional) |

### Backend (`.env` in `backend/`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (asyncpg) |
| `REDIS_URL` | Redis connection string |
| `S3_ENDPOINT` | MinIO endpoint |
| `S3_ACCESS_KEY` | MinIO access key |
| `S3_SECRET_KEY` | MinIO secret key |
| `API_KEY` | Shared secret with frontend |
| `DEVICE` | `cuda` or `cpu` |
| `SENTRY_DSN` | Sentry DSN (optional) |

## Production Deployment

```bash
# Build and start all services
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d

# Run migrations
docker compose exec frontend npx prisma migrate deploy
```

See `docker/docker-compose.prod.yml` and `docker/nginx/nginx.conf` for production configuration.

## Features

- **Upload & Crop** — Drag-and-drop image upload with optional crop region
- **AI Conversion** — YOLOv8 element detection + SAM2 segmentation + DXF generation
- **Job Types** — Full conversion, partial split (H/V/grid), detail extraction
- **DXF Viewer** — Interactive SVG-based viewer with layer toggle
- **Manual Coding** — Place axis lines and text annotations on the drawing
- **Auto Coding** — AI-detected axis and dimension placement
- **Credits** — Credit-based pricing with Stripe checkout
- **Admin Panel** — User management, refund handling, system health, charts
- **i18n** — Turkish and English UI

## Architecture

```
archflux/
├── frontend/           # Next.js app (pages, API routes, Prisma)
│   ├── src/app/        # App Router pages & API routes
│   ├── src/components/ # UI components
│   ├── src/lib/        # Utilities (auth, stripe, email, s3…)
│   └── prisma/         # Database schema & migrations
├── backend/            # FastAPI AI service
│   └── app/
│       ├── api/        # REST endpoints
│       ├── pipeline/   # AI processing modules
│       └── workers/    # Celery tasks
└── docker/             # Docker Compose, Nginx config
```

## License

Private — all rights reserved.
