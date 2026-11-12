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
