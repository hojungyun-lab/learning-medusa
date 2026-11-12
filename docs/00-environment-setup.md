# 00. 개발 환경 구성 및 도커(Docker) 기반 인프라 격리

## 🎯 학습 목표 (Goal)
- Medusa v2 백엔드 구동에 필요한 독립된 컨테이너 인프라(PostgreSQL 16, Redis 7)를 Docker Compose로 구축합니다.
- 호스트 머신의 개발 도구(Node.js 20+, npm)와 컨테이너 간의 네트워크 및 환경 변수를 설정합니다.

---

## 💡 핵심 개념 (Core Concepts)

### 왜 PostgreSQL과 Redis를 컨테이너로 격리하는가?
Medusa v2는 고성능 관계형 데이터베이스인 **PostgreSQL**과 분산 인메모리 저장소인 **Redis**를 핵심 기반으로 사용합니다.
- **PostgreSQL**: 주문, 제품, 고객, 커스텀 비즈니스 모듈의 정규화된 데이터를 안전하게 보관하고 트랜잭션을 처리합니다.
- **Redis**: 실시간 캐싱뿐만 아니라 이벤트 기반 메시지 브로커(Event Bus)로 동작하여, 주문 완료, 결제 승인 등의 이벤트를 비동기로 워커(Worker)에 전달합니다.
- 로컬 머신에 직접 DB/Redis를 설치하면 OS별 의존성 및 포트 충돌 문제가 발생하기 쉬우므로, `docker-compose.yml`을 통해 프로젝트별로 완벽히 격리된 환경을 표준화합니다.

---

## 🛠️ 실습 코드 (Hands-on)

### 1. `docker-compose.yml` 파일 작성
프로젝트 루트 경로에 PostgreSQL과 Redis 컨테이너를 정의합니다.

```yaml
# docker-compose.yml
version: "3.8"

services:
  # 1. 관계형 데이터베이스 (PostgreSQL 16)
  postgres:
    image: postgres:16-alpine
    container_name: acme-medusa-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: medusa_user
      POSTGRES_PASSWORD: medusa_password
      POSTGRES_DB: medusa_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medusa_user -d medusa_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 2. 인메모리 캐시 및 이벤트 버스 (Redis 7)
  redis:
    image: redis:7-alpine
    container_name: acme-medusa-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

### 2. 컨테이너 기동 및 헬스체크 확인
터미널에서 백그라운드로 컨테이너를 실행하고 상태를 확인합니다.

```bash
# docker-compose.yml 파일이 위치한 디렉터리로 이동
cd examples/basic-app

# 컨테이너 백그라운드 실행
docker compose up -d

# 실행 중인 컨테이너 상태 점검
docker compose ps
```

정상적인 경우 다음과 유사한 출력(healthy 상태)을 확인할 수 있습니다:
```text
NAME                   IMAGE                COMMAND                  SERVICE    STATUS
acme-medusa-postgres   postgres:16-alpine   "docker-entrypoint.s…"   postgres   Up (healthy)
acme-medusa-redis      redis:7-alpine       "docker-entrypoint.s…"   redis      Up (healthy)
```

### 3. 환경 변수 템플릿(`.env.template`) 준비 및 `.env` 생성
Medusa 백엔드가 컨테이너화된 DB와 Redis에 접근할 수 있도록 연결 정보를 명시합니다.

> **💡 왜 `.env` 대신 `.env.template`을 먼저 작성하나요?**
> - **보안(Security)**: `.env` 파일에는 데이터베이스 암호, JWT 시크릿 키 등 민감한 정보가 포함되므로 `.gitignore`에 등록하여 Git 저장소에 커밋하지 않는 것이 보안 표준입니다.
> - **협업 표준(Template)**: 팀원이나 다른 개발자가 프로젝트를 클론했을 때 어떤 환경 변수가 필요한지 알 수 있도록 뼈대(청사진) 역할을 하는 `.env.template`을 저장소에 공유합니다.

#### 템플릿 내용 (`.env.template`)
```bash
# .env.template
# 데이터베이스 연결 문자열
DATABASE_URL=postgres://medusa_user:medusa_password@localhost:5432/medusa_db

# Redis 이벤트 버스 및 캐시 URL
REDIS_URL=redis://localhost:6379

# Medusa 시스템 비밀키 및 세션 시크릿 (실무 환경에서는 32자리 난수 사용)
JWT_SECRET=supersecret-acme-jwt-token-key-2026
COOKIE_SECRET=supersecret-acme-cookie-key-2026

# 서버 기본 포트
PORT=9000
```

#### 실제 구동용 `.env` 파일 생성 명령어
터미널에서 템플릿을 복사하여 백엔드가 실제로 읽을 `.env` 파일을 생성합니다.

```bash
# .env.template을 복사하여 실제 환경 변수 파일 생성
cp .env.template .env
```

---

## 🏁 마무리 및 다음 단계
이제 Medusa v2가 요구하는 핵심 인프라(PostgreSQL, Redis)가 완벽히 독립된 가상 컨테이너 환경에서 준비되었습니다.

다음 단계인 [01-medusa-architecture.md](01-medusa-architecture.md)에서는 Medusa v2의 4대 핵심 축인 **프레임워크 코어, 독립 모듈, 링크(Link), 워크플로(Workflow)**의 내부 동작 메커니즘을 심도 있게 분석합니다.

