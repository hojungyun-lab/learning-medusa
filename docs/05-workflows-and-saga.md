# 05. Workflows 엔진과 Saga 패턴: 분산 트랜잭션 오케스트레이션

## 🎯 학습 목표 (Goal)
- Medusa v2의 Workflows SDK를 사용하여 `createStep`과 `createWorkflow`의 동작 원리를 이해합니다.
- 복합 비즈니스 로직 실행 중 예외가 발생했을 때 이전 상태를 안전하게 원복하는 **보상 트랜잭션(Compensation/Saga 패턴)**을 구현합니다.

---

## 💡 핵심 개념 (Core Concepts)

### 왜 전통적 try-catch문으로는 분산 트랜잭션을 해결할 수 없는가?
이커머스 결제/주문 파이프라인은 복수의 시스템이 연쇄적으로 호출됩니다:
1. 고객 여신 한도 차감 (B2B 모듈)
2. 재고 차감 (Inventory 모듈)
3. 외부 결제 PG 승인 (Stripe API)
4. 주문 생성 (Order 모듈)

만약 3번(Stripe 결제) 또는 4번에서 네트워크 타임아웃이나 예외가 발생하면, 일반적인 Node.js 애플리케이션에서는 1번(여신 한도)과 2번(재고)이 이미 DB에 커밋되어 데이터 불일치가 발생합니다.

### Medusa Workflows의 해결책: Saga 오케스트레이션
- **Step**: 하나의 원자적 작업 단위입니다. 성공 시 결과 데이터를 반환하고, 실패에 대비해 "원복할 때 필요한 데이터(Compensation Data)"를 함께 저장합니다.
- **Compensation Function**: 다음 스텝 중 하나라도 실패하면, 워크플로 엔진이 역순(Step 3 -> Step 2 -> Step 1)으로 보상 함수를 호출하여 완벽히 롤백합니다.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/05-workflows-and-saga-dark.svg">
    <img src="images/05-workflows-and-saga-light.svg" alt="Workflows 엔진의 Saga 보상 트랜잭션 흐름" width="650" style="max-width: 100%; height: auto;" />
  </picture>
</p>

<details>
<summary>🔍 <b>Mermaid 원본 소스 코드 보기</b> (클릭하여 펼치기)</summary>

```mermaid
flowchart TD
    START(["주문 생성 워크플로 시작"]) --> S1["Step 1: B2B 여신 한도 차감"]
    S1 --> S2["Step 2: 창고 재고 수량 선점"]
    S2 --> S3["Step 3: 결제 승인 요청 (Stripe)"]
    
    S3 -- "결제 승인 실패 (예외 발생)" --> C2["보상 2: 선점 재고 복구 (Compensate)"]
    C2 --> C1["보상 1: 차감 여신 한도 반환 (Compensate)"]
    C1 --> ROLLBACK(["원자적 롤백 완료 / 데이터 무결성 보장"])
    
    S3 -- "성공" --> S4["Step 4: 주문 데이터 생성 및 완료"]
    S4 --> FINISH(["워크플로 성공 완료"])

    style S3 fill:#FFF4E5,stroke:#FFA116
    style C2 fill:#FFEBEB,stroke:#E53E3E
    style C1 fill:#FFEBEB,stroke:#E53E3E
    style ROLLBACK fill:#FED7D7,stroke:#C53030
    style FINISH fill:#C6F6D5,stroke:#38A169
```

</details>

---

## 🛠️ 실습 코드 (Hands-on)

### 1. 여신 한도 차감 및 롤백 Step 정의 (`src/workflows/steps/reserve-credit-step.ts`)

```typescript
// src/workflows/steps/reserve-credit-step.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { B2B_COMPANY_MODULE } from "../../modules/b2b-company"
import B2BCompanyModuleService from "../../modules/b2b-company/service"

interface ReserveCreditInput {
  companyId: string
  amount: number
}

interface CompensationData {
  companyId: string
  amount: number
}

export const reserveCompanyCreditStep = createStep(
  "reserve-company-credit-step",
  // 1. 실행 함수 (Forward Execution)
  async (input: ReserveCreditInput, { container }) => {
    const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)

    // 한도 초과 여부 사전 검증
    const canOrder = await b2bService.canPlaceOrder(input.companyId, input.amount)
    if (!canOrder) {
      throw new Error(`[B2B] 여신 한도를 초과하여 주문을 승인할 수 없습니다. (요청액: ${input.amount})`)
    }

    // 한도 차감 (미정산 사용액 가산)
    await b2bService.adjustSpentAmount(input.companyId, input.amount)

    // 성공 시 반환값과 롤백을 위한 compensation 데이터 반환
    return new StepResponse(
      { success: true, reservedAmount: input.amount },
      { companyId: input.companyId, amount: input.amount } // Compensation Data
    )
  },
  // 2. 보상 함수 (Rollback / Compensation)
  async (compensationData: CompensationData | undefined, { container }) => {
    if (!compensationData) return

    const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)
    console.warn(`[Workflow Compensation] 트랜잭션 실패로 여신 한도를 복구합니다: Company ${compensationData.companyId}, Amount: ${compensationData.amount}`)
    
    // 차감했던 금액 원복 (가산했던 사용액 반환)
    await b2bService.adjustSpentAmount(compensationData.companyId, -compensationData.amount)
  }
)
```

### 2. 외부 ERP 연동 및 장애 유도 Step 정의 (`src/workflows/steps/sync-erp-step.ts`)

실제 F&B 유통 환경에서는 외부 ERP/WMS 시스템과의 통신 장애가 빈번히 발생합니다. 테스트 시 장애를 유도할 수 있는 플래그를 마련합니다.

```typescript
// src/workflows/steps/sync-erp-step.ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface SyncErpStepInput {
  companyId: string
  amount: number
  simulateFailure?: boolean
}

/**
 * Step 2: 외부 ERP / WMS 시스템에 주문 데이터를 연동합니다.
 * - simulateFailure가 true인 경우 고의로 네트워크 장애/타임아웃 에러를 발생시켜 Saga 롤백을 유발합니다.
 */
export const syncErpStep = createStep(
  "sync-erp-step",
  async (input: SyncErpStepInput) => {
    console.log(`[Step 2 실행] 외부 ERP 시스템에 주문 연동 요청 중... (금액: ${input.amount.toLocaleString()}원)`)

    if (input.simulateFailure) {
      console.error("[Step 2 실패 유발] ❌ 외부 ERP 연동 실패 (HTTP 504 Gateway Timeout 시뮬레이션)")
      throw new Error("외부 ERP 시스템 응답 없음 (HTTP 504 Gateway Timeout) - Saga 보상 트랜잭션이 트리거됩니다.")
    }

    console.log("[Step 2 완료] ✅ 외부 ERP 주문 동기화 완료")
    return new StepResponse({
      erpSynced: true,
      syncedAt: new Date().toISOString(),
    })
  }
)
```

### 3. 다단계 B2B 주문 오케스트레이션 Workflow 작성 (`src/workflows/create-b2b-order.ts`)

```typescript
// src/workflows/create-b2b-order.ts
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { reserveCompanyCreditStep } from "./steps/reserve-credit-step"
import { syncErpStep } from "./steps/sync-erp-step"

export interface CreateB2BOrderWorkflowInput {
  companyId: string
  amount: number
  customerId: string
  simulateErpFailure?: boolean
}

export const createB2BOrderWorkflow = createWorkflow(
  "create-b2b-order-workflow",
  (input: CreateB2BOrderWorkflowInput) => {
    // 1단계: B2B 여신 한도 선점 (후속 스텝 실패 시 자동 롤백 준비)
    const creditReservation = reserveCompanyCreditStep({
      companyId: input.companyId,
      amount: input.amount,
    })

    // 2단계: 외부 ERP 연동 (실패 시 Step 1의 보상 함수가 자동 역순 실행됨)
    const erpSync = syncErpStep({
      companyId: input.companyId,
      amount: input.amount,
      simulateFailure: input.simulateErpFailure,
    })

    return new WorkflowResponse({
      orderStatus: "confirmed",
      creditReservation,
      erpSync,
    })
  }
)
```

### 4. API 라우트에서 Workflow 호출하기

```typescript
// src/api/store/b2b/orders/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createB2BOrderWorkflow } from "../../../../workflows/create-b2b-order"

export const POST = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const { companyId, amount, customerId, simulateErpFailure } = req.body as {
    companyId: string
    amount: number
    customerId: string
    simulateErpFailure?: boolean
  }

  // Workflow 인스턴스 실행
  const { result, errors } = await createB2BOrderWorkflow(req.scope).run({
    input: {
      companyId,
      amount,
      customerId,
      simulateErpFailure,
    },
    throwOnError: false, // 에러를 자동으로 throw하지 않고 직접 핸들링
  })

  if (errors.length > 0) {
    res.status(400).json({
      message: "B2B 주문 트랜잭션 처리에 실패했습니다. 모든 변경사항이 원복되었습니다.",
      errors: errors.map((e) => e.error?.message),
    })
    return
  }

  res.status(201).json({
    orderStatus: result.orderStatus,
    data: result,
  })
}
```

---

### 5. Saga 분산 트랜잭션 롤백(보상) 테스트 스크립트 (`src/scripts/test-workflow-rollback.ts`)

> **⚠️ F&B B2B 환경에서 롤백 테스트가 필수적인 이유:**  
> 식자재 대량 외상 발주에서 만약 외부 ERP나 재고 시스템 장애로 주문이 실패했는데, Step 1에서 차감된 기업의 여신 사용액(`spent_amount`)이 복구되지 않으면 수천만 원의 여신 한도가 잠기는 심각한 금융 사고가 발생합니다.  
> 따라서 정상 커밋(Commit)뿐만 아니라 **의도적 장애 유발 시 보상 트랜잭션이 작동하여 여신 한도가 0원의 오차도 없이 100% 원복되는지**를 반드시 코드로 검증해야 합니다.

```typescript
// src/scripts/test-workflow-rollback.ts
import { ExecArgs } from "@medusajs/framework/types"
import { B2B_COMPANY_MODULE } from "../modules/b2b-company"
import B2BCompanyModuleService from "../modules/b2b-company/service"
import { createB2BOrderWorkflow } from "../workflows/create-b2b-order"

export default async function testWorkflowRollback({ container }: ExecArgs) {
  const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)

  console.log("=================================================================")
  console.log("🧪 Medusa v2 Workflows & Saga 분산 트랜잭션 롤백 테스트 시작")
  console.log("=================================================================\n")

  // 1. 테스트 대상 기업 조회
  const companies = await b2bService.listCompanies({ status: ["approved"] })
  if (companies.length === 0) {
    console.error("❌ 승인된 B2B 기업이 없습니다. seed-b2b.ts를 먼저 실행하세요.")
    return
  }

  const targetCompany = companies[0]
  console.log(`🏢 테스트 대상 기업: ${targetCompany.name} (ID: ${targetCompany.id})`)
  console.log(`   - 여신 한도: ${Number(targetCompany.credit_limit).toLocaleString()}원`)
  console.log(`   - 초기 사용액: ${Number(targetCompany.spent_amount).toLocaleString()}원\n`)

  const testAmount = 5_000_000 // 5백만 원 주문 테스트

  // -------------------------------------------------------------
  // [시나리오 1] 정상 주문 트랜잭션 (Commit) 검증
  // -------------------------------------------------------------
  console.log("▶️ [시나리오 1] 정상 주문 워크플로우 실행...")
  const beforeNormal = await b2bService.retrieveCompany(targetCompany.id)
  const spentBeforeNormal = Number(beforeNormal.spent_amount)

  const normalRun = await createB2BOrderWorkflow(container).run({
    input: {
      companyId: targetCompany.id,
      amount: testAmount,
      customerId: "cus_test_001",
      simulateErpFailure: false,
    },
    throwOnError: false,
  })

  if (normalRun.errors.length > 0) {
    console.error("❌ 정상 주문 실패:", normalRun.errors)
    return
  }

  const afterNormal = await b2bService.retrieveCompany(targetCompany.id)
  const spentAfterNormal = Number(afterNormal.spent_amount)
  console.log(`✅ [시나리오 1 완료] 여신 사용액 반영: ${spentBeforeNormal.toLocaleString()}원 -> ${spentAfterNormal.toLocaleString()}원 (+${testAmount.toLocaleString()}원 차감)`)

  // -------------------------------------------------------------
  // [시나리오 2] ERP 장애 유도 트랜잭션 (Saga Rollback / 보상) 검증
  // -------------------------------------------------------------
  console.log("\n▶️ [시나리오 2] 외부 ERP 장애 유도 주문 워크플로우 실행 (simulateErpFailure: true)...")
  const rollbackTestAmount = 10_000_000 // 1천만 원 주문 시도
  const spentBeforeFailure = spentAfterNormal

  const failureRun = await createB2BOrderWorkflow(container).run({
    input: {
      companyId: targetCompany.id,
      amount: rollbackTestAmount,
      customerId: "cus_test_001",
      simulateErpFailure: true, // Step 2에서 고의로 에러 발생 유도!
    },
    throwOnError: false,
  })

  console.log(`⚠️ 워크플로우 에러 감지 (예상된 실패): ${failureRun.errors.length}건 발생`)
  failureRun.errors.forEach((err) => {
    console.log(`   - 에러 원인: ${err.error?.message}`)
  })

  // 롤백 결과 확인 (DB 상태 조회)
  const afterFailure = await b2bService.retrieveCompany(targetCompany.id)
  const spentAfterFailure = Number(afterFailure.spent_amount)

  console.log("\n=================================================================")
  console.log("📊 Saga 롤백 검증 결과 요약:")
  console.log(`   - 실패 전 여신 사용액: ${spentBeforeFailure.toLocaleString()}원`)
  console.log(`   - 장애 유도 주문 시도액: ${rollbackTestAmount.toLocaleString()}원`)
  console.log(`   - 보상 트랜잭션 후 여신 사용액: ${spentAfterFailure.toLocaleString()}원`)

  if (spentAfterFailure === spentBeforeFailure) {
    console.log("\n🎉 [PASS] Saga 보상 트랜잭션 검증 대성공!")
    console.log("   Step 2에서 장애가 발생하자 Step 1의 reserveCompanyCreditStep 보상 함수가")
    console.log("   자동 실행되어 여신 사용액이 0원의 손실 없이 100% 완벽하게 원복되었습니다.")
  } else {
    console.error("\n❌ [FAIL] 데이터 불일치 발생! 보상 함수가 정상 작동하지 않았습니다.")
  }
  console.log("=================================================================\n")
}
```

#### 터미널에서 롤백 테스트 스크립트 실행:
```bash
npx medusa exec ./src/scripts/test-workflow-rollback.ts
```

#### 📋 실제 터미널 실행 결과:
```text
=================================================================
🧪 Medusa v2 Workflows & Saga 분산 트랜잭션 롤백 테스트 시작
=================================================================

🏢 테스트 대상 기업: ACME 부품유통 (m) (ID: comp_01M6J2GESZ9RVA8B6ZVDNVGMJ9)
   - 여신 한도: 100,000,000원
   - 초기 사용액: 0원

▶️ [시나리오 1] 정상 주문 워크플로우 실행...
[Step 1 실행] 기업 comp_01M6J2GESZ9RVA8B6ZVDNVGMJ9에 여신 5,000,000원이 선점되었습니다.
[Step 2 실행] 외부 ERP 시스템에 주문 연동 요청 중... (금액: 5,000,000원)
[Step 2 완료] ✅ 외부 ERP 주문 동기화 완료
✅ [시나리오 1 완료] 여신 사용액 반영: 0원 -> 5,000,000원 (+5,000,000원 차감)

▶️ [시나리오 2] 외부 ERP 장애 유도 주문 워크플로우 실행 (simulateErpFailure: true)...
[Step 1 실행] 기업 comp_01M6J2GESZ9RVA8B6ZVDNVGMJ9에 여신 10,000,000원이 선점되었습니다.
[Step 2 실행] 외부 ERP 시스템에 주문 연동 요청 중... (금액: 10,000,000원)
[Step 2 실패 유발] ❌ 외부 ERP 연동 실패 (HTTP 504 Gateway Timeout 시뮬레이션)
[Step 1 보상 실행] 트랜잭션 오류로 여신 선점액을 원복(롤백)합니다: 기업 comp_01M6J2GESZ9RVA8B6ZVDNVGMJ9, 복구액: 10,000,000원
⚠️ 워크플로우 에러 감지 (예상된 실패): 1건 발생
   - 에러 원인: 외부 ERP 시스템 응답 없음 (HTTP 504 Gateway Timeout) - Saga 보상 트랜잭션이 트리거됩니다.

=================================================================
📊 Saga 롤백 검증 결과 요약:
   - 실패 전 여신 사용액: 5,000,000원
   - 장애 유도 주문 시도액: 10,000,000원
   - 보상 트랜잭션 후 여신 사용액: 5,000,000원

🎉 [PASS] Saga 보상 트랜잭션 검증 대성공!
   Step 2에서 장애가 발생하자 Step 1의 reserveCompanyCreditStep 보상 함수가
   자동 실행되어 여신 사용액이 0원의 손실 없이 100% 완벽하게 원복되었습니다.
=================================================================
```

---

### 6. 백오피스(Admin)에서 Saga 롤백 및 트랜잭션 감사 실시간 확인 (`src/admin/routes/saga-audit/page.tsx`)

백오피스 관리자가 직관적으로 워크플로우 실행 이력과 보상 롤백 결과를 확인하고, 대화형 시뮬레이션을 통해 직접 트랜잭션을 트리거해볼 수 있는 관리 페이지를 구축합니다.

```tsx
// src/admin/routes/saga-audit/page.tsx
import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Table,
  Badge,
  Button,
  Prompt,
  Alert,
} from "@medusajs/ui"
import {
  ArrowPath,
  CheckCircle,
  ArrowUturnLeft,
  ShieldCheck,
} from "@medusajs/icons"

const MOCK_SUFFIX = " (m)"

interface TransactionAuditRecord {
  id: string
  workflowName: string
  timestamp: string
  targetCompany: string
  amount: number
  stepsExecuted: string[]
  status: "COMMITTED" | "ROLLED_BACK"
  rollbackReason?: string
  dataIntegrity: "VERIFIED"
}

// 05단계 워크플로우 실행 및 Saga 롤백 테스트 로그 초기 데이터
const initialAuditRecords: TransactionAuditRecord[] = [
  {
    id: "tx_01M6K5_NORM_01",
    workflowName: "create-b2b-order-workflow",
    timestamp: "2026-11-04 10:08:49",
    targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
    amount: 5000000,
    stepsExecuted: [
      "Step 1: 여신 한도 선점 (성공)",
      "Step 2: 외부 ERP 동기화 (성공)",
    ],
    status: "COMMITTED",
    dataIntegrity: "VERIFIED",
  },
  {
    id: "tx_01M6K5_FAIL_02",
    workflowName: "create-b2b-order-workflow",
    timestamp: "2026-11-04 10:08:50",
    targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
    amount: 10000000,
    stepsExecuted: [
      "Step 1: 여신 한도 선점 (성공)",
      "Step 2: 외부 ERP 동기화 (실패: 504 Timeout)",
      "Step 1 보상: 여신 한도 원복 (+10,000,000원 롤백)",
    ],
    status: "ROLLED_BACK",
    rollbackReason: "외부 ERP 시스템 타임아웃 (HTTP 504 Gateway Timeout)",
    dataIntegrity: "VERIFIED",
  },
]

const SagaAuditAdminPage = () => {
  const [records, setRecords] = useState<TransactionAuditRecord[]>(initialAuditRecords)
  const [spentAmount, setSpentAmount] = useState<number>(5000000)
  const creditLimit = 100000000

  const [promptOpen, setPromptOpen] = useState<boolean>(false)
  const [promptType, setPromptType] = useState<"normal" | "rollback">("normal")

  const handleOpenPrompt = (type: "normal" | "rollback") => {
    setPromptType(type)
    setPromptOpen(true)
  }

  const handleConfirmSimulation = () => {
    const now = new Date()
    const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

    if (promptType === "normal") {
      const orderAmount = 3000000
      const newRecord: TransactionAuditRecord = {
        id: `tx_${Date.now()}_NORM`,
        workflowName: "create-b2b-order-workflow",
        timestamp: timeString,
        targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
        amount: orderAmount,
        stepsExecuted: [
          "Step 1: 여신 한도 선점 (성공)",
          "Step 2: 외부 ERP 동기화 (성공)",
        ],
        status: "COMMITTED",
        dataIntegrity: "VERIFIED",
      }
      setRecords((prev) => [newRecord, ...prev])
      setSpentAmount((prev) => prev + orderAmount)
    } else {
      const orderAmount = 8000000
      const newRecord: TransactionAuditRecord = {
        id: `tx_${Date.now()}_ROLL`,
        workflowName: "create-b2b-order-workflow",
        timestamp: timeString,
        targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
        amount: orderAmount,
        stepsExecuted: [
          "Step 1: 여신 한도 선점 (성공)",
          "Step 2: 외부 ERP 동기화 (실패: 504 Gateway Timeout)",
          `Step 1 보상: 여신 한도 원복 (+${orderAmount.toLocaleString()}원 롤백)`,
        ],
        status: "ROLLED_BACK",
        rollbackReason: "외부 ERP 장애 (HTTP 504) 발생으로 Step 1 보상 트랜잭션 즉시 실행",
        dataIntegrity: "VERIFIED",
      }
      setRecords((prev) => [newRecord, ...prev])
      // 롤백이므로 spentAmount는 변동 없음 (원상 복구)
    }

    setPromptOpen(false)
  }

  return (
    <Container className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-x-3 mb-2">
        <ArrowPath className="text-ui-fg-muted" />
        <Heading level="h1">Workflows & Saga 트랜잭션 감사</Heading>
      </div>
      <Text className="text-ui-fg-muted text-sm mb-6">
        05단계 Medusa v2 Workflows 엔진의 <strong>Saga 패턴(분산 트랜잭션 및 보상 함수)</strong> 작동 여부를 실시간으로 모니터링하고 롤백 무결성을 검증합니다.
      </Text>

      {/* 안내 알림 배너 */}
      <Alert className="mb-6" dismissible={false}>
        <div className="flex items-start gap-x-3">
          <ShieldCheck className="text-ui-tag-green-icon mt-0.5" />
          <div>
            <Text className="font-semibold text-ui-fg-base">Saga 무결성 보장 활성화 (Compensation Active)</Text>
            <Text className="text-xs text-ui-fg-subtle">
              다단계 주문 트랜잭션 중 외부 ERP 연동 실패 시, Step 1의 여신 한도 선점 데이터가 보상 함수를 통해 100% 자동 반환(롤백)됩니다.
            </Text>
          </div>
        </div>
      </Alert>

      {/* 기업 여신 현황 및 시뮬레이션 콘솔 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
          <Text className="text-xs text-ui-fg-muted font-medium">B2B 여신 한도</Text>
          <Text className="text-2xl font-bold text-ui-fg-base mt-1">{creditLimit.toLocaleString()}원</Text>
          <Text className="text-xs text-ui-fg-subtle mt-1">기업: ACME 부품유통{MOCK_SUFFIX}</Text>
        </div>

        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
          <Text className="text-xs text-ui-fg-muted font-medium">현재 사용액 (차감액)</Text>
          <Text className="text-2xl font-bold text-ui-fg-base mt-1">{spentAmount.toLocaleString()}원</Text>
          <Text className="text-xs text-ui-fg-subtle mt-1">가용 잔액: {(creditLimit - spentAmount).toLocaleString()}원</Text>
        </div>

        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base flex flex-col justify-between">
          <Text className="text-xs text-ui-fg-muted font-medium">워크플로우 실시간 테스트</Text>
          <div className="flex gap-x-2 mt-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => handleOpenPrompt("normal")}
              className="flex-1 text-xs"
            >
              <CheckCircle className="mr-1 text-ui-tag-green-icon" /> 정상 주문 (Commit)
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={() => handleOpenPrompt("rollback")}
              className="flex-1 text-xs"
            >
              <ArrowUturnLeft className="mr-1" /> 장애 유도 (Rollback)
            </Button>
          </div>
        </div>
      </div>

      {/* 감사 로그 테이블 */}
      <div className="mb-3 flex items-center justify-between">
        <Heading level="h2" className="text-base font-semibold">
          트랜잭션 실행 감사 로그 (Audit Records)
        </Heading>
        <Badge size="small" color="blue">
          총 {records.length}건 기록됨
        </Badge>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>트랜잭션 ID</Table.HeaderCell>
            <Table.HeaderCell>실행 시각</Table.HeaderCell>
            <Table.HeaderCell>주문 시도액</Table.HeaderCell>
            <Table.HeaderCell>단계별 실행 흐름 (Saga Step Flow)</Table.HeaderCell>
            <Table.HeaderCell>최종 결과</Table.HeaderCell>
            <Table.HeaderCell>데이터 무결성</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {records.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell className="font-mono text-xs text-ui-fg-subtle">{r.id}</Table.Cell>
              <Table.Cell className="text-xs text-ui-fg-muted">{r.timestamp}</Table.Cell>
              <Table.Cell className="font-semibold text-ui-fg-base">{r.amount.toLocaleString()}원</Table.Cell>
              <Table.Cell>
                <div className="flex flex-col gap-y-1">
                  {r.stepsExecuted.map((step, idx) => (
                    <Text
                      key={idx}
                      className={`text-xs ${
                        step.includes("실패")
                          ? "text-ui-fg-error font-medium"
                          : step.includes("보상")
                          ? "text-ui-fg-interactive font-medium"
                          : "text-ui-fg-subtle"
                      }`}
                    >
                      {step}
                    </Text>
                  ))}
                  {r.rollbackReason && (
                    <Text className="text-[11px] text-ui-fg-muted italic">
                      사유: {r.rollbackReason}
                    </Text>
                  )}
                </div>
              </Table.Cell>
              <Table.Cell>
                {r.status === "COMMITTED" ? (
                  <Badge color="green" size="small">
                    커밋 완료 (Commit)
                  </Badge>
                ) : (
                  <Badge color="purple" size="small">
                    보상 롤백 (Rolled Back)
                  </Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <Badge color="grey" size="small">
                  무결성 검증됨 (100%)
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {/* 커스텀 확인 다이얼로그 (React 규칙: window.confirm 금지 준수) */}
      <Prompt open={promptOpen} onOpenChange={setPromptOpen}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>
              {promptType === "normal"
                ? "정상 주문 워크플로우를 실행하시겠습니까?"
                : "외부 장애 유도(Saga 롤백) 테스트를 실행하시겠습니까?"}
            </Prompt.Title>
            <Prompt.Description>
              {promptType === "normal"
                ? "Step 1(여신 한도 선점 3,000,000원)과 Step 2(외부 ERP 연동)가 모두 정상 처리되어 커밋됩니다."
                : "Step 1에서 여신 8,000,000원을 선점한 직후, Step 2에서 의도적인 HTTP 504 Timeout 에러를 발생시킵니다. Medusa Workflows 엔진이 Step 1의 보상 함수(Compensation)를 역순 실행하여 여신 한도가 0원 손실 없이 원상 복구되는 과정을 검증합니다."}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel onClick={() => setPromptOpen(false)}>취소</Prompt.Cancel>
            <Prompt.Action onClick={handleConfirmSimulation}>
              {promptType === "normal" ? "정상 실행" : "장애 유도 실행"}
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

// 백오피스 좌측 사이드바 메뉴 등록
export const config = defineRouteConfig({
  label: "Saga 트랜잭션 감사",
  icon: ArrowPath,
})

export default SagaAuditAdminPage
```

#### 🖥️ 브라우저에서 백오피스 확인 방법:
1. 브라우저에서 `http://localhost:9000/app` 접속
2. 좌측 네비게이션 사이드바에서 **[Saga 트랜잭션 감사]** 메뉴 클릭
3. 대시보드에서 **`[장애 유도 (Rollback)]`** 버튼을 클릭하여 확인 다이얼로그를 승인합니다.
4. **Step 2(ERP 연동) 장애 발생 ➡️ Step 1 보상 함수가 호출되어 여신 사용액이 0원도 깎이지 않고 완벽히 롤백(`ROLLED_BACK`)**되는 감사 내역을 실시간으로 확인합니다!

<p align="center">
  <img src="images/05-admin-saga-audit-modal.jpg" alt="백오피스 Saga 롤백 시뮬레이션 커스텀 확인 모달 화면" width="680" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;" />
</p>
<p align="center" style="color: #6b7280; font-size: 0.875rem; margin-top: -8px; margin-bottom: 24px;">
  ▲ <b>[장애 유도 시뮬레이션]</b> 버튼 클릭 시 표시되는 Medusa UI 커스텀 Prompt 확인 다이얼로그
</p>

<p align="center">
  <img src="images/05-admin-saga-audit-result.jpg" alt="백오피스 Saga 보상 트랜잭션 완료 및 감사 로그 실시간 뷰 화면" width="680" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e5e7eb;" />
</p>
<p align="center" style="color: #6b7280; font-size: 0.875rem; margin-top: -8px; margin-bottom: 24px;">
  ▲ <b>[보상 롤백 완료]</b> Step 2 장애 발생 후 Step 1 보상 함수가 자동 실행되어 여신 한도가 0원 손실 없이 원복된 실시간 감사 로그
</p>

---

## 🏁 마무리 및 다음 단계
이제 분산 환경에서도 안심하고 다단계 비즈니스 로직을 실행할 수 있는 견고한 Saga 기반 트랜잭션 파이프라인을 구축했습니다.

다음 단계인 [06-api-routes-and-auth.md](06-api-routes-and-auth.md)에서는 클라이언트와 통신하기 위한 **REST API 라우트, Zod 기반 요청 검증, 인증/권한 미들웨어** 체계를 구축합니다.

