# ⚡ Medusa.js v2 핵심 문법 및 패턴 치트시트 (Cheatsheet)

본 문서는 Medusa v2 백엔드 개발 시 자주 사용하는 핵심 API, 데코레이터, 워크플로, DML 모델링 패턴을 빠르게 찾아볼 수 있도록 정리한 요약 레퍼런스입니다.

---

## 1. DML (Data Modeling Language) 패턴

```typescript
// src/modules/b2b-company/models/company.ts
import { model } from "@medusajs/framework/utils"

export const Company = model.define("b2b_company", {
  // 기본 식별자: "comp_" 접두사를 가진 CUID 자동 생성
  id: model.id({ prefix: "comp" }).primaryKey(),
  
  // 문자열 필드
  name: model.text().searchable(),
  tax_id: model.text().unique(),
  
  // 열거형(Enum) 정의
  status: model.enum(["pending", "approved", "suspended"]).default("pending"),
  
  // 정수 및 부동소수점
  credit_limit: model.bigNumber().default(0),
  discount_rate: model.float().default(0.0),
  
  // JSON 임의 데이터 저장
  metadata: model.json().nullable(),
  
  // 일대다(1:N) 관계: 회사는 여러 직원을 가짐
  employees: model.hasMany(() => CompanyEmployee, {
    mappedBy: "company",
  }),
})

export const CompanyEmployee = model.define("b2b_employee", {
  id: model.id({ prefix: "comp_emp" }).primaryKey(),
  email: model.text().unique(),
  is_admin: model.boolean().default(false),
  
  // 다대일(N:1) 역방향 관계
  company: model.belongsTo(() => Company, {
    mappedBy: "employees",
  }),
})
```

---

## 2. 모듈 정의 (Module Definition)

```typescript
// src/modules/b2b-company/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import { Company, CompanyEmployee } from "./models/company"

// MedusaService를 상속받으면 기본 CRUD 메서드가 자동 생성됨
export default class B2BCompanyModuleService extends MedusaService({
  Company,
  CompanyEmployee,
}) {
  // 커스텀 비즈니스 메서드 추가
  async verifyCreditLimit(companyId: string, orderAmount: number): Promise<boolean> {
    const company = await this.retrieveCompany(companyId)
    return Number(company.credit_limit) >= orderAmount
  }
}
```

```typescript
// src/modules/b2b-company/index.ts
import { Module } from "@medusajs/framework/utils"
import B2BCompanyModuleService from "./service"

export const B2B_COMPANY_MODULE = "b2bCompanyModuleService"

export default Module(B2B_COMPANY_MODULE, {
  service: B2BCompanyModuleService,
})
```

---

## 3. 모듈 간 링크 (Cross-Module Links) & Remote Query

```typescript
// src/links/customer-company.ts
import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import B2BCompanyModule from "../modules/b2b-company"

// Customer(Medusa 코어)와 Company(커스텀 모듈)를 1:1로 링크
export default defineLink(
  CustomerModule.linkable.customer,
  B2BCompanyModule.linkable.company
)
```

```typescript
// 원격 쿼리 (Remote Query) 실행 예제
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function fetchCustomerWithCompany(container: any, customerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // GraphQL 스타일로 두 모듈의 데이터를 단일 쿼리로 조인 조회
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "company.id",
      "company.name",
      "company.status"
    ],
    filters: {
      id: customerId,
    },
  })

  return customers[0]
}
```

---

## 4. Workflows & Saga 보상 트랜잭션 (Workflows & Compensation)

```typescript
// src/workflows/create-b2b-order.ts
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { B2B_COMPANY_MODULE } from "../modules/b2b-company"

interface ReserveCreditInput {
  companyId: string
  amount: number
}

// 1. Step 정의 (실행 로직 + 보상/롤백 로직)
export const reserveCompanyCreditStep = createStep(
  "reserve-company-credit-step",
  async (input: ReserveCreditInput, { container }) => {
    const b2bService = container.resolve(B2B_COMPANY_MODULE)
    
    // 신용 한도 차감
    const updated = await b2bService.deductCredit(input.companyId, input.amount)
    
    // 성공 시 반환값과 롤백에 필요한 컨텍스트를 StepResponse에 전달
    return new StepResponse(updated, { 
      companyId: input.companyId, 
      restoredAmount: input.amount 
    })
  },
  // 보상 함수: 이후 단계가 실패할 경우 자동으로 역실행됨 (Saga 패턴)
  async (compensationData, { container }) => {
    if (!compensationData) return
    const b2bService = container.resolve(B2B_COMPANY_MODULE)
    await b2bService.addCredit(compensationData.companyId, compensationData.restoredAmount)
  }
)

// 2. Workflow 정의
export interface CreateB2BOrderWorkflowInput {
  companyId: string
  amount: number
  cartId: string
}

export const createB2BOrderWorkflow = createWorkflow(
  "create-b2b-order-workflow",
  (input: CreateB2BOrderWorkflowInput) => {
    // 순차 실행 및 의존성 주입
    const creditReservation = reserveCompanyCreditStep({
      companyId: input.companyId,
      amount: input.amount,
    })

    return new WorkflowResponse({
      reservation: creditReservation,
    })
  }
)
```

---

## 5. 커스텀 API 라우트 & 미들웨어 (API Routes & Middlewares)

```typescript
// src/api/admin/b2b/companies/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { B2B_COMPANY_MODULE } from "../../../../modules/b2b-company"

// 요청 유효성 검사 스키마
export const CreateCompanySchema = z.object({
  name: z.string().min(2),
  tax_id: z.string(),
  credit_limit: z.number().nonnegative().optional(),
})

export type CreateCompanyType = z.infer<typeof CreateCompanySchema>

// GET: 회사 목록 조회
export const GET = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const b2bService = req.scope.resolve(B2B_COMPANY_MODULE)
  const [companies, count] = await b2bService.listAndCountCompanies()

  res.status(200).json({
    companies,
    count,
  })
}

// POST: 신규 회사 생성
export const POST = async (
  req: MedusaRequest<CreateCompanyType>,
  res: MedusaResponse
): Promise<void> => {
  const b2bService = req.scope.resolve(B2B_COMPANY_MODULE)
  const newCompany = await b2bService.createCompanies(req.validatedBody)

  res.status(201).json({ company: newCompany })
}
```

```typescript
// src/api/middlewares.ts
import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { CreateCompanySchema } from "./admin/b2b/companies/route"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/b2b/companies",
      method: "POST",
      middlewares: [
        validateAndTransformBody(CreateCompanySchema),
      ],
    },
  ],
})
```

---

## 6. 이벤트 구독자 (Subscribers & Event Bus)

```typescript
// src/subscribers/order-placed.ts
import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = data.id
  console.log(`[Event Bus] 주문 완료 이벤트 수신: ${orderId}`)

  const logger = container.resolve("logger")
  logger.info(`ERP 시스템으로 주문 전송 시작 - Order ID: ${orderId}`)
  
  // 외부 Webhook 또는 알림 서비스 연동 로직 수행
}

// 구독할 이벤트 지정
export const config: SubscriberConfig = {
  event: "order.placed",
}
```

---

## 7. Medusa Admin 위젯 확장 (UI Extensions)

```tsx
// src/admin/widgets/product-b2b-badge.tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading } from "@medusajs/ui"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"

// 상품 상세 페이지 상단에 B2B 전용 뱃지 주입
const ProductB2BWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  return (
    <Container className="p-4 bg-ui-bg-subtle border border-ui-border-base rounded-lg mb-4">
      <div className="flex items-center justify-between">
        <Heading level="h3">ACME B2B 상품 관리</Heading>
        <Badge color="blue">B2B 인증 카탈로그</Badge>
      </div>
      <p className="text-ui-fg-muted text-sm mt-1">
        상품 ID: {data.id}
      </p>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductB2BWidget
```

---

## 8. Next.js 스토어프론트 JS SDK 연동

```typescript
// storefront/src/lib/medusa-client.ts
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
})

// Server Actions 또는 컴포넌트에서 활용 예제
export async function getStoreProducts() {
  const response = await sdk.store.product.list({
    limit: 12,
    fields: "id,title,handle,thumbnail,variants.prices",
  })
  return response.products
}
```

---

## 9. 유용한 CLI 명령어 모음

```bash
# 데이터베이스 마이그레이션 생성 및 반영
npx medusa db:generate [module-name]
npx medusa db:migrate

# 관리자 계정 생성
npx medusa user --email admin@acme.local --password AdminPassword123!

# 테스트용 시드(Seed) 데이터 주입
npm run seed

# 플러그인 링크 동기화
npx medusa db:migrate
```

---

## 10. Railway 클라우드 배포 CLI 치트시트

```bash
# Railway CLI 설치 및 로그인
npm install -g @railway/cli
railway login

# 프로젝트 생성 및 연결
railway init
railway link [project-id]

# 인프라 데이터베이스 원클릭 추가
railway add -d postgres
railway add -d redis

# 환경 변수 확인 및 설정
railway variables
railway variables --set "NODE_ENV=production" "PORT=9000"

# 퍼블릭 도메인 발급 (*.up.railway.app)
railway domain

# 현재 디렉터리 코드 즉시 배포
railway up --detach

# 실시간 프로덕션 로그 스트리밍 모니터링
railway logs
```

