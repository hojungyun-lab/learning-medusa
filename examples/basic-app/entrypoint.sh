#!/bin/sh
set -e

echo "===================================================="
echo "🚀 [ACME Medusa v2] 프로덕션 컨테이너 부팅 시퀀스 시작"
echo "===================================================="

# 심볼릭 링크 안전장치 점검
npm run postinstall 2>/dev/null || true

# 1. 데이터베이스 연결 대기 (최대 30초)
echo "⏳ [1/4] 데이터베이스 연결 상태 확인 중..."
counter=0
max_retries=30

until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => { client.end(); process.exit(0); })
  .catch(() => process.exit(1));
" 2>/dev/null; do
  counter=$((counter + 1))
  if [ $counter -gt $max_retries ]; then
    echo "❌ 데이터베이스 연결 시간 초과. 부팅을 중단합니다."
    exit 1
  fi
  echo "   PostgreSQL 준비 대기 중 ($counter/$max_retries)..."
  sleep 1
done
echo "✅ 데이터베이스 연결 확인 완료."

# 2. 데이터베이스 마이그레이션 실행
echo "🔄 [2/4] Medusa 데이터베이스 마이그레이션 적용 중..."
npx medusa db:migrate
echo "✅ 마이그레이션 완료."

# 3. 최초 관리자 계정 자동 프로비저닝 (환경 변수가 지정된 경우에만 실행)
if [ -n "$MEDUSA_ADMIN_EMAIL" ] && [ -n "$MEDUSA_ADMIN_PASSWORD" ]; then
  echo "👤 [3/4] 관리자 계정 확인 및 생성 중 ($MEDUSA_ADMIN_EMAIL)..."
  npx medusa user --email "$MEDUSA_ADMIN_EMAIL" --password "$MEDUSA_ADMIN_PASSWORD" 2>/dev/null || echo "   (관리자 계정이 이미 존재하므로 건너뜁니다)"
else
  echo "⏩ [3/4] 관리자 계정 생성 환경 변수가 없어 건너뜁니다."
fi

# 4. Medusa v2 서버 기동
echo "🌐 [4/4] Medusa 프로덕션 서버 실행 (포트: ${PORT:-9000})..."
exec npm run start
