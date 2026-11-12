import { ExecArgs } from "@medusajs/framework/types"
import { B2B_COMPANY_MODULE } from "../modules/b2b-company"
import B2BCompanyModuleService from "../modules/b2b-company/service"

export default async function seedB2BCompanies({ container }: ExecArgs) {
  const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)

  console.log("🏢 ACME B2B 테스트 기업 데이터 시딩 시작...")

  const existing = await b2bService.listCompanies({
    business_number: ["123-45-67890", "987-65-43210"],
  })

  if (existing.length > 0) {
    console.log("ℹ️ 이미 시드 데이터가 존재합니다. 건너뜁니다.")
    return
  }

  const companies = await b2bService.createCompanies([
    {
      name: "(주)대한글로벌 (m)",
      business_number: "123-45-67890",
      credit_limit: 50000000,
      status: "pending",
      phone: "02-1234-5678",
    },
    {
      name: "ACME 부품유통 (m)",
      business_number: "987-65-43210",
      credit_limit: 100000000,
      status: "approved",
      phone: "031-987-6543",
    },
  ])

  console.log(`✅ ${companies.length}개 B2B 기업 데이터 생성 완료:`)
  companies.forEach((c: { id: string; name: string; status: string }) => {
    console.log(`   - [${c.id}] ${c.name} (${c.status})`)
  })
}
