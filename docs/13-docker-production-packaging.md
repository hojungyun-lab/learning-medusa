# 13. 컨테이너 패키징 및 프로덕션 Docker 최적화

## 🎯 학습 목표 (Goal)
- 보안성과 빌드 속도, 컨테이너 이미지 크기를 극대화한 3단계 Multi-stage [`Dockerfile`](../examples/basic-app/Dockerfile)을 작성합니다.
- 최신 Medusa v2의 빌드 산출물 구조(`.medusa/server`, `.medusa/client`, Vite Admin 정적 번들)와 Node.js 22 LTS 환경 요구조건을 완벽히 이해합니다.
- Non-root 사용자 권한(`node`) 및 [`dumb-init`](../examples/basic-app/Dockerfile)을 적용하여 안전한 런타임을 구성합니다.
- 부팅 시 데이터베이스 대기, 자동 마이그레이션, 관리자 계정 프로비저닝을 일괄 수행하는 [`entrypoint.sh`](../examples/basic-app/entrypoint.sh) 오케스트레이션을 구축합니다.
- 로컬 개발 환경과 포트 충돌 없이 완전히 격리된 프로덕션 스택([`docker-compose.prod.yml`](../examples/basic-app/docker-compose.prod.yml))을 기동하고 헬스체크 및 백오피스 로그인을 실증합니다.

---

## 💡 핵심 개념 (Core Concepts)

### 1. 왜 Multi-stage 빌드가 필수인가?
Node.js 애플리케이션 개발에는 TypeScript 컴파일러(`tsc`), Vite 번들러, ESLint 등 대용량의 `devDependencies`가 필요합니다. 하지만 실제 운영 환경(Runtime)에서는 트랜스파일된 순수 JavaScript 파일과 런타임 라이브러리만 필요합니다.

```
[전체 의존성 + 소스 코드] (1.2GB+)
       │
       ▼ (npm run build & npm prune --production)
[빌드 산출물 + 운영 의존성만 복사] (684MB)
```

- **용량 절감**: 불필요한 개발 도구를 제거하여 이미지 크기를 획기적으로 경량화합니다 (본 실습 기준 684MB).
- **보안 강화**: 프로덕션 컨테이너에 컴파일러나 패키지 매니저의 불필요한 바이너리를 남기지 않음으로써 공격 표면(Attack Surface)을 최소화합니다.
- **보안 권한 (Non-root)**: 기본 `root` 사용자로 컨테이너를 구동하지 않고 `USER node` 전용 시스템 계정을 사용하여 컨테이너 탈옥(Container Escape) 취약점을 방지합니다.
- **프로세스 수명주기 관리 (`dumb-init`)**: 컨테이너의 PID 1 프로세스로 동작하여 `SIGTERM`, `SIGINT` 등의 종료 시그널을 Node.js 자식 프로세스에 정확히 포워딩하고 좀비 프로세스를 방지합니다.

---

### 2. Medusa v2 빌드 산출물의 내부 구조
Medusa v2는 `npm run build`(`medusa build`) 실행 시 기존 v1처럼 단순 `dist/` 폴더를 생성하지 않고, 고유한 분리 번들 구조를 생성합니다:

| 경로 | 역할 및 설명 | 프로덕션 배치 위치 |
| :--- | :--- | :--- |
| **`.medusa/server`** | TypeScript 코어 서버 소스가 순수 CJS/ESM JavaScript로 컴파일된 디렉토리 | `/app/.medusa/server` 및 `/app/medusa-config.js` |
| **`.medusa/server/public/admin`** | Vite로 번들링된 React 기반 관리자 백오피스 정적 자산 (`index.html`, JS/CSS) | `/app/public/admin` (서버가 `/app/public/admin`에서 직접 서빙) |
| **`.medusa/client`** | Medusa JS SDK 클라이언트 번들 | `/app/.medusa/client` |

> [!IMPORTANT]
> **Admin UI 번들 배치 주의점**:
> Medusa v2 런타임의 어드민 로더는 루트 디렉토리 기준 `./public/admin/index.html`을 탐색합니다. 따라서 Multi-stage `Dockerfile` 러너 단계에서 반드시 `.medusa/server/public` 디렉토리를 루트의 `./public` 디렉토리로 복사해야 관리자 웹 UI(`http://localhost:9001/app`)가 정상 서빙됩니다.

---

### 3. Node.js 22 LTS 필수 요구조건
최신 Medusa v2 코어 및 하위 의존성(예: `execa v9` 등)은 ECMAScript 2024의 `Set.prototype.union` 내장 메서드를 사용합니다. `node:20-alpine`에서는 이 메서드가 지원되지 않아 `TypeError: TEXT_ENCODINGS.union is not a function` 빌드 에러가 발생하므로, 반드시 **`node:22-alpine`** 이상의 런타임을 베이스 이미지로 채택해야 합니다.

---

### 4. PostgreSQL SSL 연결 제어 (`DATABASE_SSL`)
Medusa v2는 `NODE_ENV=production` 환경에서 기본적으로 PostgreSQL 연결 시 강력한 SSL 핸드셰이크를 요구합니다. 사내 폐쇄망, 쿠버네티스 내부 통신, 또는 로컬 Docker 격리 네트워크 환경에서는 SSL 인증서가 없으므로 마이그레이션 시 타임아웃(`Connection timed out after 10s`)이 발생할 수 있습니다.
따라서 [`medusa-config.ts`](../examples/basic-app/medusa-config.ts)에 `DATABASE_SSL=false` 환경 변수를 감지하여 조건부로 SSL 검증을 비활성화하는 방어 로직을 구현합니다.

---

## 🏗️ 아키텍처 다이어그램 (Architecture Diagram)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/13-docker-production-dark.svg">
    <img src="images/13-docker-production-light.svg" alt="Medusa v2 Multi-stage 프로덕션 컨테이너 패키징 및 격리 운영 스택 다이어그램" width="760" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;" />
  </picture>
</p>
<p align="center" style="color: #6b7280; font-size: 0.875rem; margin-top: -8px; margin-bottom: 24px;">
  ▲ <b>그림 13-1</b>: 3단계 Multi-stage 빌드 파이프라인(상단)과 Compose 기반 격리 프로덕션 운영 스택(하단)
</p>

---

## 🛠️ 실습 파일 작성 (Hands-on Implementation)

기존 [`examples/basic-app`](../examples/basic-app) 환경에 프로덕션 패키징 설정을 추가합니다.

### 1. `.dockerignore` 파일 생성

컨테이너 빌드 컨텍스트에 불필요하거나 민감한 파일이 포함되지 않도록 차단합니다:

```dockerignore
# examples/basic-app/.dockerignore
node_modules
.medusa
dist
.env
.env.*
.git
.github
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
coverage
.turbo
```

---

### 2. 프로덕션 Multi-stage `Dockerfile` 작성

[`examples/basic-app/Dockerfile`](../examples/basic-app/Dockerfile)에 다음 3단계 파이프라인을 작성합니다:

```dockerfile
# ------------------------------------------------------------------------------
# 1단계: 의존성 설치 (Dependencies)
# 최신 Medusa v2 및 빌드 도구 호환성을 위해 Node.js 22 LTS Alpine 사용
# ------------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# musl-libc 호환 라이브러리 설치 (네이티브 모듈 컴파일 지원)
RUN apk add --no-cache libc6-compat

# package.json 및 package-lock.json 복사 후 클린 설치
COPY package.json package-lock.json* ./
RUN npm ci

# ------------------------------------------------------------------------------
# 2단계: 소스 빌드 (Builder)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# TypeScript 컴파일 및 Admin UI 번들링 (.medusa/server, .medusa/client 생성)
ENV NODE_ENV=production
RUN npm run build

# 프로덕션 런타임에 불필요한 devDependencies 정리
RUN npm prune --production
RUN npm run postinstall || true

# ------------------------------------------------------------------------------
# 3단계: 프로덕션 런타임 (Runner)
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9000

# 컨테이너 프로세스 시그널(SIGTERM/SIGINT) 처리를 위한 dumb-init 설치
RUN apk add --no-cache dumb-init

# 보안을 위한 non-root 전용 시스템 계정 전환
USER node

# 의존성 및 프로덕션 모듈 복사
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
RUN npm run postinstall || true

# 빌드 산출물(.medusa) 복사
COPY --chown=node:node --from=builder /app/.medusa ./.medusa

# 컴파일된 medusa-config.js, 서버 소스(src), 어드민 번들 정적 자산(public)을 루트로 배치
COPY --chown=node:node --from=builder /app/.medusa/server/medusa-config.js ./medusa-config.js
COPY --chown=node:node --from=builder /app/.medusa/server/src ./src
COPY --chown=node:node --from=builder /app/.medusa/server/public ./public

# 부팅 및 마이그레이션 자동화 스크립트 복사
COPY --chown=node:node --from=builder /app/entrypoint.sh ./entrypoint.sh

# 포트 개방
EXPOSE 9000

# dumb-init을 통해 entrypoint.sh 실행 (PID 1 신호 처리 및 DB 마이그레이션 자동화)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./entrypoint.sh"]
```

---

### 3. 컨테이너 부팅 오케스트레이션 스크립트 (`entrypoint.sh`)

컨테이너가 시작될 때 데이터베이스가 준비될 때까지 안전하게 대기한 후, 마이그레이션을 실행하고 최초 관리자 계정을 생성한 뒤 Medusa 서버를 기동합니다:

```bash
#!/bin/sh
# examples/basic-app/entrypoint.sh
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
```

실행 권한을 부여합니다:
```bash
chmod +x examples/basic-app/entrypoint.sh
```

---

### 4. 격리 프로덕션 스택 명세 (`docker-compose.prod.yml`)

로컬 개발 환경(포트 `9000`, `5432`, `6379`)과 완전히 격리하기 위해 독립 네임스페이스 `acme-medusa-prod`와 외부 포트 매핑(`9001`, `5433`, `6380`)을 적용합니다:

```yaml
# examples/basic-app/docker-compose.prod.yml
name: acme-medusa-prod

services:
  # ----------------------------------------------------------------------------
  # Medusa v2 코어 백엔드 프로덕션 애플리케이션
  # ----------------------------------------------------------------------------
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: acme-medusa-backend:prod
    container_name: acme-prod-app
    restart: unless-stopped
    ports:
      # 로컬 개발 환경(:9000)과의 포트 충돌 방지를 위해 호스트 9001번에 매핑
      - "9001:9000"
    environment:
      - NODE_ENV=production
      - PORT=9000
      - DATABASE_URL=postgres://medusa_user:medusa_prod_password@postgres:5432/medusa_prod_db
      - DATABASE_SSL=false
      - COOKIE_SECURE=false
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=supersecret_jwt_for_production_test_only_acme_123
      - COOKIE_SECRET=supersecret_cookie_for_production_test_only_acme_123
      - STORE_CORS=http://localhost:3000,http://localhost:9001
      - ADMIN_CORS=http://localhost:9001,http://localhost:9000
      - AUTH_CORS=http://localhost:3000,http://localhost:9001
      - MEDUSA_ADMIN_EMAIL=admin@acme.local
      - MEDUSA_ADMIN_PASSWORD=AcmePassword123!
      - STRIPE_API_KEY=${STRIPE_API_KEY:-sk_test_acme_mock_stripe_key_2026}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-whsec_acme_mock_stripe_webhook_2026}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - prod-network

  # ----------------------------------------------------------------------------
  # PostgreSQL 16 프로덕션 데이터베이스
  # ----------------------------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: acme-prod-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: medusa_user
      POSTGRES_PASSWORD: medusa_prod_password
      POSTGRES_DB: medusa_prod_db
    ports:
      # 로컬 개발용 5432 포트 충돌 방지를 위해 호스트 5433번에 매핑
      - "5433:5432"
    volumes:
      - prod_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medusa_user -d medusa_prod_db"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - prod-network

  # ----------------------------------------------------------------------------
  # Redis 7 메시지 브로커 & 캐시
  # ----------------------------------------------------------------------------
  redis:
    image: redis:7-alpine
    container_name: acme-prod-redis
    restart: unless-stopped
    ports:
      # 로컬 개발용 6379 포트 충돌 방지를 위해 호스트 6380번에 매핑
      - "6380:6379"
    volumes:
      - prod_redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - prod-network

networks:
  prod-network:
    driver: bridge

volumes:
  prod_pgdata:
  prod_redisdata:
```

---

### 5. `medusa-config.ts` 프로덕션 대응 업데이트

[`examples/basic-app/medusa-config.ts`](../examples/basic-app/medusa-config.ts)의 `projectConfig`에 `databaseDriverOptions`를 추가하여 `DATABASE_SSL=false`일 때 연결 타임아웃을 방지하고, 로컬 HTTP 테스트 시 브라우저 쿠키 거부를 방지하도록 `cookieOptions`를 설정합니다:

```typescript
// examples/basic-app/medusa-config.ts 발췌
projectConfig: {
  databaseUrl: process.env.DATABASE_URL,
  databaseDriverOptions: process.env.DATABASE_SSL === "false" 
    ? { connection: { ssl: false } } 
    : undefined,
  http: {
    storeCors: process.env.STORE_CORS!,
    adminCors: process.env.ADMIN_CORS!,
    authCors: process.env.AUTH_CORS!,
    jwtSecret: process.env.JWT_SECRET || "supersecret",
    cookieSecret: process.env.COOKIE_SECRET || "supersecret",
  },
  cookieOptions: process.env.COOKIE_SECURE === "false"
    ? { secure: false }
    : undefined,
},
```

---

## 🧪 4단계 실전 검증 파이프라인 (Step-by-Step Production Verification)

작성된 패키징 설정이 운영 환경에서 오류 없이 동작하는지 단계별로 검증합니다.

### 1단계: Multi-stage Docker 이미지 빌드

```bash
cd examples/basic-app
docker build -t acme-medusa-backend:prod .
```

**빌드 주요 출력 확인**:
```
 => [builder 5/7] RUN npm run build                                       14.4s
 => [builder 6/7] RUN npm prune --production                              28.4s
 => [runner  8/11] COPY --chown=node:node --from=builder /app/.medusa/server/medusa-config.js ./medusa-config.js
 => [runner  9/11] COPY --chown=node:node --from=builder /app/.medusa/server/src ./src
 => [runner 10/11] COPY --chown=node:node --from=builder /app/.medusa/server/public ./public
 => naming to docker.io/library/acme-medusa-backend:prod
```

---

### 2단계: 이미지 크기 및 경량화 레이어 검증

빌드된 이미지 크기를 확인합니다:

```bash
docker images acme-medusa-backend:prod
```

**터미널 출력 예시**:
```
IMAGE                      ID             DISK USAGE   CONTENT SIZE
acme-medusa-backend:prod   41154285df04        684MB             0B
```
TypeScript 소스와 방대한 `node_modules` 전체를 포함했을 때의 용량(1.5GB 이상) 대비 **약 55% 이상의 디스크 용량 절감**을 달성했습니다.

---

### 3단계: 격리 프로덕션 스택 기동 및 부팅 시퀀스 확인

```bash
docker compose -f docker-compose.prod.yml up -d
```

**컨테이너 상태 확인**:
```bash
docker compose -f docker-compose.prod.yml ps
```
```
NAME                 IMAGE                      COMMAND                  SERVICE    STATUS
acme-prod-app        acme-medusa-backend:prod   "/usr/bin/dumb-init …"   app        running
acme-prod-postgres   postgres:16-alpine         "docker-entrypoint.s…"   postgres   healthy
acme-prod-redis      redis:7-alpine             "docker-entrypoint.s…"   redis      healthy
```

**앱 컨테이너 부팅 로그 모니터링**:
```bash
docker logs acme-prod-app
```
```
====================================================
🚀 [ACME Medusa v2] 프로덕션 컨테이너 부팅 시퀀스 시작
====================================================
⏳ [1/4] 데이터베이스 연결 상태 확인 중...
✅ 데이터베이스 연결 확인 완료.
🔄 [2/4] Medusa 데이터베이스 마이그레이션 적용 중...
{"level":"info","message":"Running migrations...","timestamp":"2026-11-08 01:14:37"}
{"level":"info","message":"Migrations completed","timestamp":"2026-11-08 01:14:37"}
✅ 마이그레이션 완료.
👤 [3/4] 관리자 계정 확인 및 생성 중 (admin@acme.local)...
🌐 [4/4] Medusa 프로덕션 서버 실행 (포트: 9000)...
{"level":"info","message":"Server is ready on port: 9000","timestamp":"2026-11-08 01:14:42"}
```

---

### 4단계: 헬스체크, Admin 백오피스 및 인증 API 검증

호스트 9001번 포트로 매핑된 프로덕션 서버를 대상으로 통신 테스트를 수행합니다.

#### ① 헬스체크 엔드포인트 검증
```bash
curl -i http://localhost:9001/health
```
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 2

OK
```

#### ② Admin 웹 백오피스 정적 번들 서빙 및 로그인 화면 확인
브라우저에서 **`http://localhost:9001/app`** (또는 `http://localhost:9001/app/login`)에 접속하거나 curl로 확인합니다:
```bash
curl -i http://localhost:9001/app
```
```html
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
    <head>
      <script type="module" crossorigin src="/app/assets/index-CNPxdSoi.js"></script>
      <link rel="stylesheet" crossorigin href="/app/assets/index-bpqKk56c.css">
    </head>
    <body>
        <div id="medusa"></div>
    </body>
</html>
```

<p align="center">
  <img src="images/13-step4-admin-login.png" alt="포트 9001 프로덕션 컨테이너에서 정상 서빙되는 Medusa Admin 로그인 화면" width="700" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;" />
</p>
<p align="center" style="color: #6b7280; font-size: 0.875rem; margin-top: -8px; margin-bottom: 24px;">
  ▲ <b>4단계-②</b>: 호스트 9001번 포트 프로덕션 컨테이너에서 Vite 정적 번들이 로드된 Medusa 백오피스 로그인 화면
</p>

#### ③ 관리자 로그인 및 B2B 커스텀 대시보드 검증
1. 로그인 화면에서 환경 변수로 주입된 자격 증명을 입력합니다:
   - **Email**: `admin@acme.local`
   - **Password**: `AcmePassword123!`
2. **`[Continue with Email]`** 버튼을 클릭하여 백오피스 대시보드로 진입합니다.
3. 좌측 사이드바에 07단계까지 구축한 커스텀 메뉴(**B2B 기업 승인 관리**, **B2B 기업 목록**, **Saga 트랜잭션 감사**, **B2B 고객 연동 현황**)와 좌측 하단 관리자 계정 프로필(**`admin@acme.local`**)이 정상 표출되는지 확인합니다:

<p align="center">
  <img src="images/13-step4-admin-dashboard.png" alt="프로덕션 컨테이너 환경에서 admin@acme.local로 로그인 완료된 Medusa 관리자 주문/B2B 대시보드 화면" width="700" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;" />
</p>
<p align="center" style="color: #6b7280; font-size: 0.875rem; margin-top: -8px; margin-bottom: 24px;">
  ▲ <b>4단계-③</b>: 프로덕션 컨테이너 격리 스택에서 admin@acme.local로 로그인 성공 후 B2B 관리자 대시보드 활성화 화면
</p>

#### ④ 프로덕션 관리자 로그인 API 및 세션 검증
CLI 또는 API 테스트 도구를 통해 직접 토큰 발급 및 사용자 조회를 검증합니다:

```bash
# 1) 관리자 로그인 및 JWT 토큰 발급
ADMIN_TOKEN=$(curl -s -X POST http://localhost:9001/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.local","password":"AcmePassword123!"}' \
  | node -e "let d=''; process.stdin.on('data', c=>d+=c); process.stdin.on('end', ()=>console.log(JSON.parse(d).token));")

# 2) 토큰을 통한 관리자 프로필 정보 조회
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:9001/admin/users/me
```
```json
{
  "user": {
    "id": "user_01M76X3YHSH8YCS32076YATHMB",
    "email": "admin@acme.local",
    "created_at": "2026-11-12T03:34:12.793Z"
  }
}
```
정상적으로 관리자 JWT 세션 토큰이 발급되고 프로덕션 관리자 프로필 조회가 완료됨을 확인하였습니다.

---

## 🏢 F&B 엔터프라이즈 실무 모범 사례 (Best Practices)

### 1. Graceful Shutdown과 진행 중인 결제 트랜잭션 보호
F&B 프랜차이즈 및 B2B 원두 정기 발주 시스템에서는 신규 컨테이너 배포나 오토스케일링 인다운 시 결제 중이던 주문이 중간에 끊기면 큰 손실이 발생합니다.
- [`dumb-init`](../examples/basic-app/Dockerfile)을 컨테이너의 PID 1 프로세스로 설정하면, 쿠버네티스나 Docker 데몬이 발송하는 `SIGTERM` 시그널이 Medusa 코어 프로세스에 온전히 전달됩니다.
- Medusa v2는 수신된 `SIGTERM`을 감지하여 신규 HTTP 요청 수신을 차단하고, 이미 진행 중인 Stripe 결제나 워크플로우 트랜잭션이 완료될 때까지 기본 `terminationGracePeriod`(30초) 동안 정상 대기 후 안전하게 종료됩니다.

### 2. Non-root 파일시스템 보안 및 Read-Only 컨테이너 전략
- 프로덕션 컨테이너는 어떠한 경우에도 `root` 계정으로 실행하지 않고 `USER node` 전용 계정으로 구동합니다.
- F&B 운영 환경에서는 해킹이나 파일 훼손을 방지하기 위해 컨테이너 루트 파일시스템을 읽기 전용(`read_only: true`)으로 마운트하고, 임시 파일이 필요한 경로(`/tmp`)만 임시 메모리 볼륨(`tmpfs`)으로 할당하는 것이 권장됩니다.
- 상품 이미지(원두 사진, 메뉴 카탈로그) 및 사업자등록증 사본 등의 영구 파일은 로컬 컨테이너 디스크가 아닌 AWS S3 또는 Cloudflare R2 파일 모듈 프로바이더로 분리 저장해야 합니다.

### 3. 민감 정보(Secrets)와 12-Factor App 분리
- Stripe 시크릿 키(`sk_test_...`), DB 패스워드, JWT/쿠키 시크릿은 절대 Git 저장소나 이미지 레이어에 하드코딩해서는 안 됩니다.
- Docker Secrets 또는 오케스트레이터의 시크릿 매니저(Kubernetes Secret, Railway Variables)를 통해 런타임 환경 변수로 안전하게 주입받도록 구성합니다.

---

## 🏁 마무리 및 다음 단계

이제 ACME Medusa v2 백엔드는 **보안성(Non-root), 경량화(Multi-stage), 안정성(dumb-init 및 자동 마이그레이션)**을 모두 완비한 프로덕션 컨테이너 이미지로 패키징되었습니다.

다음 최종 단계인 [14-production-deployment-and-monitoring.md](14-production-deployment-and-monitoring.md)에서는:
- 패키징된 컨테이너를 클라우드 PaaS(Railway)에 실제 프로덕션으로 배포하고,
- 관리형 PostgreSQL/Redis와의 무중단 마이그레이션 연동 및
- Pino 구조화 로깅과 프로덕션 모니터링 전략을 완결합니다.
