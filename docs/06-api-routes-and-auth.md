# 06. 커스텀 API 라우트 및 인증/인가(Auth & RBAC) 파이프라인

## 🎯 학습 목표 (Goal)
- Medusa v2의 파일 기반 HTTP 라우팅 체계(`src/api/`)를 익히고 REST 엔드포인트를 구축합니다.
- Zod를 이용한 강력한 요청 유효성 검사 및 Medusa 인증 세션/API 키 미들웨어를 적용합니다.

---

## 💡 핵심 개념 (Core Concepts)

### Storefront API와 Admin API의 분리
Medusa는 접근 주체에 따라 API 네임스페이스를 엄격히 분리합니다.
- `src/api/store/*`: 최종 소비자가 사용하는 공개 엔드포인트(카탈로그 조회, 장바구니 담기, 체크아웃). Publishable API Key 또는 고객 JWT 세션으로 보호됩니다.
- `src/api/admin/*`: 운영자 및 백오피스 관리자가 사용하는 권한 엔드포인트(상품 등록, 여신 승인, 주문 처리). 관리자 JWT 세션 및 역할 기반 권한(RBAC) 검증이 필수입니다.

---

## 🛠️ 실습 코드 (Hands-on)

### 1. Zod 유효성 검사 스키마 및 엔드포인트 작성 (`src/api/admin/b2b/companies/route.ts`)

```typescript
// src/api/admin/b2b/companies/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { B2B_COMPANY_MODULE } from "../../../../modules/b2b-company"
import B2BCompanyModuleService from "../../../../modules/b2b-company/service"

// 1. 요청 페이로드 검증 스키마 정의
export const CreateCompanySchema = z.object({
  name: z.string().min(2, "회사명은 최소 2글자 이상이어야 합니다."),
  business_number: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, "올바른 사업자등록번호 형식(XXX-XX-XXXXX)이 아닙니다."),
  credit_limit: z.number().int().positive().optional(),
  phone: z.string().min(8),
})

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>

// 2. GET: B2B 기업 목록 조회
export const GET = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const b2bService: B2BCompanyModuleService = req.scope.resolve(B2B_COMPANY_MODULE)

  // 쿼리 파라미터 파싱
  const limit = Number(req.query.limit) || 20
  const offset = Number(req.query.offset) || 0

  const [companies, count] = await b2bService.listAndCountCompanies({}, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  res.status(200).json({
    companies,
    count,
    limit,
    offset,
  })
}

// 3. POST: 신규 B2B 기업 등록 (미들웨어에서 검증 완료된 바디 사용)
export const POST = async (
  req: MedusaRequest<CreateCompanyInput>,
  res: MedusaResponse
): Promise<void> => {
  const b2bService: B2BCompanyModuleService = req.scope.resolve(B2B_COMPANY_MODULE)

  // req.validatedBody에는 Zod 검증을 통과한 순수 객체만 안전하게 전달됨
  const payload = req.validatedBody || (req.body as CreateCompanyInput)

  const newCompany = await b2bService.createCompanies({
    name: payload.name,
    business_number: payload.business_number,
    credit_limit: payload.credit_limit || 10_000_000,
    phone: payload.phone,
    status: "pending",
  })

  res.status(201).json({
    company: newCompany,
    message: "성공적으로 B2B 기업이 등록되었습니다.",
  })
}
```

### 2. 미들웨어 설정 및 검증기 바인딩 (`src/api/middlewares.ts`)

```typescript
// src/api/middlewares.ts
import {
  defineMiddlewares,
  validateAndTransformBody,
  authenticate,
} from "@medusajs/framework/http"
import { CreateCompanySchema } from "./admin/b2b/companies/route"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/b2b/*",
      // admin 네임스페이스의 모든 요청에 관리자 인증 강제 (Bearer 토큰 또는 Session 쿠키)
      middlewares: [
        authenticate("user", ["session", "bearer"]),
      ],
    },
    {
      matcher: "/admin/b2b/companies",
      method: "POST",
      middlewares: [
        // Zod 스키마로 Request Body 유효성 검사 및 파싱
        validateAndTransformBody(
          CreateCompanySchema as unknown as Parameters<typeof validateAndTransformBody>[0]
        ),
      ],
    },
  ],
})
```

---

### 3. curl을 활용한 실시간 API & 인증/검증 테스트 (Hands-on CLI Test)

터미널에서 `curl`을 사용하여 우리가 구현한 REST 엔드포인트의 **보안 인증 차단, 토큰 발급, 데이터 조회, Zod 유효성 검사, 신규 리소스 생성** 전 과정을 검증합니다.

#### 1) 시나리오 1: 관리자 JWT 인증 토큰 획득 (`POST /auth/user/emailpass`)
Medusa v2의 관리자 인증 엔드포인트에 계정 정보를 전송하여 Bearer 토큰을 발급받습니다.

```bash
# 관리자 JWT 토큰 발급 및 환경 변수 저장
ADMIN_TOKEN=$(curl -s -X POST http://localhost:9000/auth/user/emailpass \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.local",
    "password": "AdminPassword123!"
  }' | node -e "let d=''; process.stdin.on('data', c=>d+=c); process.stdin.on('end', ()=>console.log(JSON.parse(d).token));")

echo "발급된 관리자 토큰: ${ADMIN_TOKEN:0:35}..."
```

**응답 예시:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY3Rvcl9pZCI6InVzZXJfMDE...",
}
```

---

#### 2) 시나리오 2: 인증 헤더 없이 호출 시 보안 차단 검증 (`401 Unauthorized`)
미들웨어(`authenticate`)가 정상 작동하여 토큰이 없는 비인가 요청을 즉시 거부하는지 확인합니다.

```bash
# 토큰 없이 보호된 Admin 엔드포인트 호출
curl -i http://localhost:9000/admin/b2b/companies
```

**응답 예시 (HTTP 401 Unauthorized):**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{"message":"Unauthorized"}
```

---

#### 3) 시나리오 3: Bearer 토큰을 포함한 기업 목록 정상 조회 (`200 OK`)
발급받은 JWT 토큰을 `Authorization: Bearer <token>` 헤더에 포함하여 호출합니다.

```bash
# 인증 토큰을 포함하여 B2B 기업 목록 조회
curl -s http://localhost:9000/admin/b2b/companies \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**응답 예시 (HTTP 200 OK):**
```json
{
  "companies": [
    {
      "id": "comp_01M6J2GESZ3B5WX1F425CEKG5Y",
      "name": "(주)대한글로벌 (m)",
      "business_number": "123-45-67890",
      "status": "pending",
      "credit_limit": 50000000,
      "spent_amount": 0,
      "phone": "02-1234-5678"
    },
    {
      "id": "comp_01M6J2GESZ9RVA8B6ZVDNVGMJ9",
      "name": "ACME 부품유통 (m)",
      "business_number": "987-65-43210",
      "status": "approved",
      "credit_limit": 100000000,
      "spent_amount": 5000000,
      "phone": "031-987-6543"
    }
  ],
  "count": 2,
  "limit": 20,
  "offset": 0
}
```

---

#### 4) 시나리오 4: Zod 스키마 유효성 검사 실패 유도 (`400 Bad Request`)
사업자등록번호 형식(XXX-XX-XXXXX)이 맞지 않거나 전화번호가 너무 짧은 불량 데이터를 전송하여 Zod 검증 엔진이 사전에 차단하는지 확인합니다.

```bash
# 잘못된 규격의 바디 전송 (유효성 검사 실패 테스트)
curl -s -X POST http://localhost:9000/admin/b2b/companies \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "잘못된 기업 (m)",
    "business_number": "12345",
    "phone": "010"
  }' | jq .
```

**응답 예시 (HTTP 400 Bad Request - Zod 차단):**
```json
{
  "type": "invalid_data",
  "message": "Invalid request: 올바른 사업자등록번호 형식(XXX-XX-XXXXX)이 아닙니다.; Value for field 'phone' too small, expected at least: '8'"
}
```

---

#### 5) 시나리오 5: 정상 페이로드로 신규 B2B 기업 등록 (`201 Created`)
모든 Zod 검증 규칙을 충족하는 완전한 페이로드를 전송하여 DB에 신규 리소스를 생성합니다.

```bash
# 정상적인 신규 B2B 기업 등록
curl -s -X POST http://localhost:9000/admin/b2b/companies \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "(주)동해식품 (m)",
    "business_number": "555-88-99999",
    "credit_limit": 70000000,
    "phone": "033-123-4567"
  }' | jq .
```

**응답 예시 (HTTP 201 Created):**
```json
{
  "company": {
    "id": "comp_01M6J6V3MB349CQFABY3RNAMMP",
    "name": "(주)동해식품 (m)",
    "business_number": "555-88-99999",
    "status": "pending",
    "phone": "033-123-4567",
    "credit_limit": 70000000,
    "spent_amount": 0
  },
  "message": "성공적으로 B2B 기업이 등록되었습니다."
}
```

---

## 🏁 마무리 및 다음 단계
이제 타입 안전성과 관리자 보안 인증이 적용된 커스텀 REST API 엔드포인트 파이프라인이 완성되었습니다.

다음 단계인 [07-admin-widgets-and-ui.md](07-admin-widgets-and-ui.md)에서는 운영자가 별도의 프론트엔드 작업 없이도 백오피스 대시보드에서 직접 B2B 기업을 확인하고 승인할 수 있도록 **Medusa Admin UI 컴포넌트(Widget & Page)**를 구현합니다.

