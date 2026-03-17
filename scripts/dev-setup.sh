#!/bin/bash
# RÖLIX Development Setup Script
# Run once after cloning the repo

set -e

echo "🚀 RÖLIX Dev Setup"
echo "==================="

# 1. Copy env files if they don't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example"
  echo "⚠️  Please edit .env with your Google OAuth credentials"
fi

if [ ! -f frontend/.env.local ]; then
  cat > frontend/.env.local << 'EOF'
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
EOF
  echo "✅ Created frontend/.env.local"
  echo "⚠️  Please add your Google OAuth credentials"
fi

# 2. Start infrastructure services
echo ""
echo "📦 Starting infrastructure services..."
cd docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio
cd ..

echo "⏳ Waiting for services to be ready..."
sleep 5

# 3. Create MinIO buckets
echo "🪣 Creating MinIO buckets..."
docker exec rolix-minio mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null || true
docker exec rolix-minio mc mb local/rolix-uploads --ignore-existing 2>/dev/null || true
docker exec rolix-minio mc mb local/rolix-results --ignore-existing 2>/dev/null || true
echo "✅ MinIO buckets ready"

# 4. Setup frontend
echo ""
echo "🖥️  Setting up frontend..."
cd frontend
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
cd ..

# 5. Setup backend
echo ""
echo "🐍 Setting up backend..."
cd backend
python -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt
cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start development:"
echo "  Terminal 1: cd frontend && npm run dev"
echo "  Terminal 2: cd backend && uvicorn app.main:app --reload --port 8000"
echo "  Terminal 3: cd backend && celery -A app.workers.celery_app worker --loglevel=info"
