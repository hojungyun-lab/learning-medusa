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

