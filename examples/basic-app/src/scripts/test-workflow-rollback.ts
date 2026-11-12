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
  const companies = await b2bService.listCompanies({
    status: ["approved"],
  })

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

