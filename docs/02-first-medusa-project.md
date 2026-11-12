# 02. Medusa v2 프로젝트 생성 및 구조 해부

## 🎯 학습 목표 (Goal)
- Medusa CLI를 사용하여 ACME 사의 백엔드 프로젝트를 초기화합니다.
- `medusa-config.ts`의 설정 구조와 백엔드 프로젝트의 각 폴더 역할을 정확히 이해합니다.
- 최초 관리자(Admin) 계정을 발급하고 어드민 대시보드에 접속합니다.

---

## 💡 핵심 개념 (Core Concepts)

### Medusa v2 프로젝트 구조의 특징
Medusa v2는 Next.js의 App Router처럼 규약 기반(Convention over Configuration) 디렉터리 구조를 갖추고 있습니다.
- `src/modules/`: 독립적인 비즈니스 도메인(DML 모델, 서비스, 저장소)이 위치하는 곳입니다.
- `src/api/`: Express 기반의 HTTP 라우트 핸들러가 위치하며, Storefront용 API와 Admin용 API로 구분됩니다.
- `src/workflows/`: 분산 트랜잭션을 실행하는 비즈니스 플로우 스크립트가 모여 있습니다.
- `src/subscribers/`: 이벤트 버스(Redis)로부터 이벤트를 전달받아 비동기 작업을 처리하는 리스너입니다.
- `src/admin/`: 관리자 대시보드에 직접 주입되는 React/Vite 기반 UI 위젯 및 커스텀 페이지입니다.

---

## 🛠️ 실습 코드 (Hands-on)

### 1. 프로젝트 초기화 (CLI 명령어)

학습 진행 방식에 따라 아래 두 가지 방법 중 하나를 선택합니다:

> **💡 학습 트랙 선택 안내:**
> - **[트랙 A] 빈 폴더에서 직접 하나씩 작성하며 배우고 싶은 경우:**
>   `examples/` 외부의 새로운 작업 디렉터리(예: 본인의 작업 폴더)에서 아래의 CLI 명령어를 실행하여 새 프로젝트를 스캐폴딩합니다.
> - **[트랙 B] 이미 완성된 예제 코드를 분석하고 구동해보고 싶은 경우:**
>   CLI 생성을 건너뛰고, 저장소에 이미 준비된 `examples/basic-app/` 디렉터리로 이동하여 코드를 확인합니다.

```bash
# [트랙 A 전용] 새로운 작업 디렉터리에서 Medusa CLI 실행
npx create-medusa-app@latest acme-backend

# 프롬프트 선택 가이드:
# ? Which project template would you like to use? -> 기본 권장 템플릿 선택
# ? Install dependencies? -> Yes

# 생성이 완료되면 프로젝트 디렉터리로 이동
cd acme-backend
```

### 2. 핵심 설정 파일 (`medusa-config.ts`) 작성 및 분석
프로젝트 루트의 `medusa-config.ts` 파일에서 Docker 인프라(Postgres, Redis)와 연결을 구성합니다.

```typescript
// medusa-config.ts
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

// .env 파일의 환경 변수 로드
loadEnv(process.env.NODE_ENV || 'development', process.cwd())

export default defineConfig({
  projectConfig: {
    // PostgreSQL 연결 설정
    databaseUrl: process.env.DATABASE_URL || "postgres://medusa_user:medusa_password@localhost:5432/medusa_db",
    
    // Redis 이벤트 버스 설정
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    
    // HTTP CORS(교차 출처 리소스 공유) 보안 정책 설정
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000,http://localhost:7001",
      authCors: process.env.AUTH_CORS || "http://localhost:3000,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret-acme-jwt-token-key-2026",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret-acme-cookie-key-2026",
    },
  },
  admin: {
    // 백오피스 어드민 UI 활성화 (기본 경로: http://localhost:9000/app)
    disable: false,
    path: "/app",
  },
  modules: [
    // 향후 개발할 커스텀 모듈 및 플러그인이 이곳에 등록됩니다.
  ],
})
```

### 3. 데이터베이스 마이그레이션 및 최초 관리자 계정 생성
데이터베이스 스키마를 초기화하고 백오피스에 접속할 관리자 계정을 생성합니다.

```bash
# 1. 코어 데이터베이스 테이블 생성
npx medusa db:migrate

# 2. 슈퍼 관리자 계정 생성
npx medusa user --email admin@acme.local --password AdminPassword123!
```

### 4. 개발 서버 실행 및 브라우저 확인
```bash
# 백엔드 서버 구동
npm run dev
```

서버가 구동되면 다음 엔드포인트가 활성화됩니다:

1. **관리자 대시보드 (Web UI)**: **`http://localhost:9000/app`** (👈 브라우저 접속 경로)
2. **REST API 베이스 URL**: `http://localhost:9000`
3. **헬스체크**: `http://localhost:9000/health` (서버 정상 시 200 OK)

> **💡 주의: 브라우저에 `http://localhost:9000`으로만 접속했을 때 `Cannot GET /`이 뜨는 이유**
> Medusa v2는 **헤드리스(Headless) 백엔드 API 엔진**이므로, 웹 프론트엔드가 없는 루트 경로(`/`)는 기본적으로 404(`Cannot GET /`)를 반환합니다.
> 백오피스 관리자 화면은 반드시 뒤에 **`/app`**을 붙인 **`http://localhost:9000/app`** 경로로 접속해야 합니다.

브라우저에서 `http://localhost:9000/app`에 접속하여 앞서 생성한 슈퍼 관리자 계정(`admin@acme.local` / `AdminPassword123!`)으로 로그인합니다.

<p align="center">
  <img src="images/02-admin-login.png" alt="Medusa Admin 대시보드 로그인 화면" width="460" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;" />
</p>

---

## 🏁 마무리 및 다음 단계
이제 ACME 커머스의 기본 백엔드 엔진과 관리자 대시보드가 정상적으로 가동되었습니다.

다음 단계인 [03-custom-module-and-dml.md](03-custom-module-and-dml.md)에서는 ACME 사의 핵심 요구사항인 **B2B 기업 회원 및 여신 한도(Credit Limit) 관리 모듈**을 DML(Data Modeling Language)을 통해 직접 정의하고 서비스 계층을 구현합니다.

