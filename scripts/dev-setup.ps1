# RÖLIX Development Setup Script (Windows PowerShell)
# Run once after cloning the repo

$ErrorActionPreference = "Stop"

Write-Host "🚀 RÖLIX Dev Setup" -ForegroundColor Cyan
Write-Host "==================="

# 1. Copy env files if they don't exist
if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env from .env.example" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env with your Google OAuth credentials" -ForegroundColor Yellow
}

if (!(Test-Path "frontend/.env.local")) {
    @"
DATABASE_URL="postgresql://rolix:rolix_dev_pass@localhost:5432/rolix_dev"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production-min-32-chars!!"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_UPLOADS="rolix-uploads"
S3_BUCKET_RESULTS="rolix-results"
S3_REGION="us-east-1"
AI_BACKEND_URL="http://localhost:8000"
AI_BACKEND_API_KEY="dev-api-key-change-in-production"
"@ | Out-File -FilePath "frontend/.env.local" -Encoding UTF8
    Write-Host "✅ Created frontend/.env.local" -ForegroundColor Green
    Write-Host "⚠️  Please add your Google OAuth credentials" -ForegroundColor Yellow
}

# 2. Start infrastructure services
Write-Host ""
Write-Host "📦 Starting infrastructure services..." -ForegroundColor Cyan
Push-Location docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio
Pop-Location

Write-Host "⏳ Waiting for services to be ready..."
Start-Sleep -Seconds 5

# 3. Setup frontend
Write-Host ""
Write-Host "🖥️  Setting up frontend..." -ForegroundColor Cyan
Push-Location frontend
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
Pop-Location

# 4. Setup backend
Write-Host ""
Write-Host "🐍 Setting up backend..." -ForegroundColor Cyan
Push-Location backend
python -m venv venv 2>$null
& .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Pop-Location

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start development:" -ForegroundColor Cyan
Write-Host "  Terminal 1: cd frontend; npm run dev"
Write-Host "  Terminal 2: cd backend; uvicorn app.main:app --reload --port 8000"
Write-Host "  Terminal 3: cd backend; celery -A app.workers.celery_app worker --loglevel=info"
