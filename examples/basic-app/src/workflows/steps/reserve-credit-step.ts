import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { B2B_COMPANY_MODULE } from "../../modules/b2b-company"
import B2BCompanyModuleService from "../../modules/b2b-company/service"

export interface ReserveCreditStepInput {
  companyId: string
  amount: number
}

export interface ReserveCreditCompensationData {
  companyId: string
  amount: number
}

/**
 * Step 1: B2B 기업의 여신 한도를 확인하고 사용액(spent_amount)을 가산합니다.
 * - 실패 시: 보상 함수(Compensation)가 실행되어 가산했던 금액을 정확히 차감(원복)합니다.
 */
export const reserveCompanyCreditStep = createStep(
  "reserve-company-credit-step",
  // 1. 순방향 실행 (Forward Execution)
  async (input: ReserveCreditStepInput, { container }) => {
    const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)

    // 여신 한도 확인
    const canOrder = await b2bService.canPlaceOrder(input.companyId, input.amount)
    if (!canOrder) {
      throw new Error(`[B2B 여신] 가용 여신 한도를 초과하여 승인할 수 없습니다. (요청액: ${input.amount.toLocaleString()}원)`)
    }

    // 여신 사용액 가산 (차감 효과)
    await b2bService.adjustSpentAmount(input.companyId, input.amount)
    console.log(`[Step 1 실행] 기업 ${input.companyId}에 여신 ${input.amount.toLocaleString()}원이 선점되었습니다.`)

    // 보상 데이터를 보관하며 다음 Step으로 반환
    return new StepResponse(
      { success: true, reservedAmount: input.amount, companyId: input.companyId },
      { companyId: input.companyId, amount: input.amount } // 롤백 보상 데이터
    )
  },
  // 2. 역방향 보상 함수 (Compensation / Rollback)
  async (compensationData: ReserveCreditCompensationData | undefined, { container }) => {
    if (!compensationData) return

    const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)
    console.warn(`[Step 1 보상 실행] 트랜잭션 오류로 여신 선점액을 원복(롤백)합니다: 기업 ${compensationData.companyId}, 복구액: ${compensationData.amount.toLocaleString()}원`)

    // 가산했던 금액을 다시 음수로 적용하여 원상 복구
    await b2bService.adjustSpentAmount(compensationData.companyId, -compensationData.amount)
  }
)

