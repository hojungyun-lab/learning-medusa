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

/**
 * ACME B2B 주문 오케스트레이션 워크플로우 (Saga 패턴 적용)
 *
 * 1. reserveCompanyCreditStep: B2B 여신 한도 선점 (실패 시 차감액 자동 복구 보상 함수 탑재)
 * 2. syncErpStep: 외부 ERP/WMS 시스템 연동 (실패 시 앞선 Step 1의 보상 함수가 자동 역순 실행됨)
 */
export const createB2BOrderWorkflow = createWorkflow(
  "create-b2b-order-workflow",
  (input: CreateB2BOrderWorkflowInput) => {
    // 1단계: 여신 한도 선점
    const creditReservation = reserveCompanyCreditStep({
      companyId: input.companyId,
      amount: input.amount,
    })

    // 2단계: 외부 ERP 연동 (simulateErpFailure 전달)
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

