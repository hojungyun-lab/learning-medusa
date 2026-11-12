# 🛍️ ACME Commerce: Medusa.js v2 엔터프라이즈 실무 마스터 가이드

본 저장소는 가상의 글로벌 제조/유통 기업 **ACME Inc.**의 실제 커머스 플랫폼을 단계별로 구축하며, 최신 **Medusa.js v2**의 핵심 아키텍처부터 프로덕션 운영까지 학습할 수 있도록 설계된 종합 실무 가이드 및 데모 프로젝트입니다.

---

## 📌 프로젝트 개요

전통적인 모놀리식 이커머스 솔루션(Shopify, Magento 등)은 비즈니스 로직이 고도화될수록 커스터마이징의 한계에 직면합니다. Medusa.js는 이러한 문제를 해결하기 위해 탄생한 **오픈소스 헤드리스 커머스 프레임워크(Open-source Headless Commerce Framework)**입니다.

Medusa v2는 단순한 플러그인 아키텍처를 넘어, **독립 모듈(Isolated Modules)**, **DML(Data Modeling Language)**, 분산 트랜잭션을 보장하는 **Workflows 엔진(Saga Pattern)**, 그리고 **Remote Query/Link** 시스템을 제공하여 엔터프라이즈급 확장성을 지원합니다.

### 이 가이드북을 통해 얻을 수 있는 역량
1. **모듈형 커머스 아키텍처 설계**: Medusa v2 모듈 시스템 및 데이터 모델링(DML)을 사용한 커스텀 도메인 구축
2. **트랜잭션 안정성 확보**: 분산 환경에서 보상 트랜잭션(Compensation)을 지원하는 Workflows 기반 비즈니스 로직 작성
3. **풀스택 커머스 파이프라인**: Next.js 14+ (App Router) 스토어프론트, Medusa Admin 확장, Stripe 결제, 재고/배송 파이프라인 완성
4. **이벤트 기반 비동기 처리**: Redis Event Bus를 통한 주문/결제 이벤트 감지 및 외부 ERP/알림 시스템 연동
5. **프로덕션 컨테이너라이징 및 클라우드 배포**: Docker Multi-stage 빌드, PostgreSQL 마이그레이션 관리, 고가용성 인프라 운영

---

## 🗂️ 프로젝트 디렉터리 구조

```text
.
├── README.md                  # 프로젝트 소개, 환경 설정, 커리큘럼 로드맵
├── CHEATSHEET.md              # Medusa v2 핵심 문법, DML, Workflow, API 치트시트
├── docs/                      # 15단계 실무 마스터 단계별 학습 가이드
│   ├── 00-environment-setup.md
│   ├── 01-medusa-architecture.md
│   ├── 02-first-medusa-project.md
│   ├── 03-custom-module-and-dml.md
│   ├── 04-module-links-and-query.md
│   ├── 05-workflows-and-saga.md
│   ├── 06-api-routes-and-auth.md
│   ├── 07-admin-widgets-and-ui.md
│   ├── 08-nextjs-storefront-setup.md
│   ├── 09-catalog-and-cart-ux.md
│   ├── 10-stripe-payment-integration.md
│   ├── 11-shipping-and-fulfillment.md
│   ├── 12-subscribers-and-event-bus.md
│   ├── 13-docker-production-packaging.md
│   └── 14-production-deployment-and-monitoring.md
└── examples/                  # 단계별 완성형 참조 소스 코드
    ├── basic-app/             # 00~07단계: Medusa v2 코어 백엔드 및 모듈 데모
    └── final-project/         # 08~14단계: Next.js + Stripe + Redis 연동 실전 완성형
```

---

## ☁️ 프로덕션 배포 인프라 분석: 어디에 어떻게 배포할 것인가?

### Q. Cloudflare에 Medusa 백엔드 배포가 가능한가요?
> **결론: 백엔드 코어는 불가능하거나 권장되지 않으며, 프론트엔드(Next.js Storefront)는 최적입니다.**
- **Medusa 백엔드 엔진 특성**: Medusa v2 코어는 지속 실행되는 Node.js(20+) 프로세스 환경, PostgreSQL 데이터베이스 연결 풀링(Connection Pooling), Redis 소켓 연결(이벤트 버스/캐시), 그리고 동적 모듈 로딩 시스템을 필요로 합니다.
- **Cloudflare Workers의 한계**: Cloudflare Workers는 V8 Isolate 기반의 무상태(Stateless) 서버리스 환경으로, 장기 실행 백그라운드 프로세스(Workflows 수명 주기, 이벤트 리스너) 및 표준 Node.js C++ 네이티브 모듈 실행에 제약이 있습니다.
- **최적의 하이브리드 구성**: 
  - **백엔드(Medusa Backend + DB + Redis)**: 컨테이너 지원 PaaS(Railway, Render) 또는 가상 사설 서버(VPS, AWS ECS/Lightsail).
  - **프론트엔드(Storefront)**: **Cloudflare Pages** 또는 **Vercel**을 통해 글로벌 엣지(Edge) 네트워크에 배포.

### 📊 백엔드 배포 플랫폼 비교 및 추천

| 서비스 | 티어/비용 | 장점 | 고려사항 / 단점 | 추천 대상 |
| :--- | :--- | :--- | :--- | :--- |
| **Railway** | 월 $5 무료 크레딧 제공, 이후 종량제 | • GitHub 연동 시 자동 Docker 빌드<br>• Managed PostgreSQL 및 Redis 원클릭 프로비저닝<br>• Medusa 공식 레퍼런스 가이드 제공 | • 사용량 초과 시 크레딧 소진 후 과금 전환 | **초기 개발 및 데모 배포 (가장 권장)** |
| **Render** | 무료 웹 서비스 및 DB 플랜 제공 | • 직관적인 대시보드<br>• 기본 무료 SSL 및 커스텀 도메인 지원 | • 무료 인스턴스는 15분 미사용 시 슬립(Cold Start 약 50초 소요)<br>• 무료 PostgreSQL은 90일 만료 제약 | 프로토타입 검증용 |
| **Fly.io** | 소규모 리소스 무료(Free Allowance) | • 전 세계 리전에 경량 MicroVM(Firecracker)으로 배포<br>• Dockerfile을 가장 충실하게 반영 | • CLI 중심 운영으로 초보자 진입 장벽 존재 | CLI 친화적인 중급 개발자 |
| **Hetzner / AWS Lightsail** (VPS) | 월 $4 ~ $5 고정 비용 | • CPU/RAM 독점 자원 제공<br>• Docker Compose로 완벽한 독립 환경 구성 가능 | • OS 보안 패치, 방화벽, 백업 등 수동 인프라 운영 필요 | 비용 효율성이 중요한 실제 상용 운영 |

---

## 🚀 빠른 시작 (Getting Started)

### 1. 사전 요구사항 검증
개발 머신에 아래 도구들이 설치되어 있는지 확인합니다.

```bash
# Node.js 버전 확인 (Node v20 이상 권장)
node -v   # v20.x.x 이상

# 패키지 매니저 버전 확인 (npm, yarn, 또는 pnpm)
npm -v    # v10.x.x 이상

# Docker 및 Docker Compose 버전 확인
docker -v
docker compose version
```

### 2. 새 Medusa v2 프로젝트 생성 (학습자 직접 실습용)
빈 디렉터리에서 Medusa CLI를 사용하여 프로젝트를 스캐폴딩합니다.

```bash
# Medusa v2 스타터 프로젝트 생성
npx create-medusa-app@latest acme-commerce

# 프로젝트 디렉터리로 이동
cd acme-commerce

# 의존성 설치 확인 및 개발 서버 기동
npm run dev
```

### 3. 본 저장소의 예제 코드(examples) 실행 방법

#### [기초 데모] basic-app 실행
```bash
# 1. basic-app 디렉터리로 이동
cd examples/basic-app

# 2. 로컬 데이터베이스 및 캐시 컨테이너 구동
docker compose up -d

# 3. 의존성 패키지 설치
npm install

# 4. 데이터베이스 마이그레이션 실행
npx medusa db:migrate

# 5. 백엔드 개발 서버 실행 (포트 9000 및 Admin 대시보드 7001 자동 바인딩)
npm run dev
```

#### [실전 프로젝트] final-project 실행
```bash
# 1. final-project 디렉터리로 이동
cd examples/final-project

# 2. 인프라 서비스 구동 (Postgres, Redis, Stripe CLI)
docker compose up -d

# 3. 환경 변수 복사 및 설정
cp .env.example .env

# 4. 패키지 설치 및 빌드
npm install
npm run build

# 5. 풀스택 프로덕션 프리뷰 실행
npm run start
```

---

## 📚 전체 학습 커리큘럼

| 단계 | 카테고리 | 문서 (파일명 링크) | 핵심 내용 |
| :---: | :---: | :--- | :--- |
| **00** | 환경 구축 | [00-environment-setup.md](docs/00-environment-setup.md) | Docker Compose 기반 PostgreSQL 16 및 Redis 7 환경 격리 및 구동 |
| **01** | 아키텍처 | [01-medusa-architecture.md](docs/01-medusa-architecture.md) | Medusa v2 아키텍처 해부: 프레임워크 코어, 분산 모듈, 링크, 워크플로 |
| **02** | 프로젝트 세팅 | [02-first-medusa-project.md](docs/02-first-medusa-project.md) | CLI 초기화, 프로젝트 구조 탐색, medusa-config.ts 설정 심층 분석 |
| **03** | 데이터 모델링 | [03-custom-module-and-dml.md](docs/03-custom-module-and-dml.md) | DML(Data Modeling Language)을 활용한 ACME 커스텀 B2B 모듈 및 서비스 구현 |
| **04** | 모듈 링크 | [04-module-links-and-query.md](docs/04-module-links-and-query.md) | Module Link를 통한 Product와 B2B 모듈 간 관계 형성 및 Remote Query 활용 |
| **05** | 비즈니스 로직 | [05-workflows-and-saga.md](docs/05-workflows-and-saga.md) | Workflows 엔진: Step 생성, 보상 트랜잭션(Compensation) 및 에러 복구 |
| **06** | API & 보안 | [06-api-routes-and-auth.md](docs/06-api-routes-and-auth.md) | Custom HTTP API 라우트 개발, Zod 스키마 검증, 세션/API Key 인증 파이프라인 |
| **07** | 백오피스 확장 | [07-admin-widgets-and-ui.md](docs/07-admin-widgets-and-ui.md) | Medusa Admin UI Extension: 위젯(Widget) 인젝션 및 전용 관리자 페이지 개발 |
| **08** | 스토어프론트 | [08-nextjs-storefront-setup.md](docs/08-nextjs-storefront-setup.md) | Next.js 14+ App Router 스토어프론트 연동 및 Medusa JS Client/SDK 통합 |
| **09** | 카탈로그 & 장바구니 | [09-catalog-and-cart-ux.md](docs/09-catalog-and-cart-ux.md) | 제품 카탈로그 페이지네이션, 옵션 매트릭스 렌더링, Cart 상태 관리 로직 |
| **10** | 결제 시스템 | [10-stripe-payment-integration.md](docs/10-stripe-payment-integration.md) | Stripe Payment Provider 연동, Payment Intent 라이프사이클 및 웹훅 처리 |
| **11** | 배송 & 세금 | [11-shipping-and-fulfillment.md](docs/11-shipping-and-fulfillment.md) | Fulfillment Provider 구성, 배송 옵션 계산 및 세금(Tax) 프로바이더 연동 |
| **12** | 이벤트 자동화 | [12-subscribers-and-event-bus.md](docs/12-subscribers-and-event-bus.md) | Redis 기반 Event Bus, Subscriber를 활용한 주문 완료 알림 및 비동기 처리 |
| **13** | 컨테이너 패키징 | [13-docker-production-packaging.md](docs/13-docker-production-packaging.md) | Multi-stage Dockerfile 빌드, non-root 사용자 보안 설정 및 이미지 최적화 |
| **14** | 실무 배포 & 운영 | [14-production-deployment-and-monitoring.md](docs/14-production-deployment-and-monitoring.md) | Railway 배포 실습, DB 마이그레이션 자동화, 헬스체크 및 Pino 로깅 모니터링 |

---

## 📋 핵심 요약 빠른 참조
문법과 API 패턴을 즉시 확인하려면 [CHEATSHEET.md](CHEATSHEET.md)를 참고하세요.

