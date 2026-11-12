import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { B2B_COMPANY_MODULE } from "../modules/b2b-company"
import B2BCompanyModuleService from "../modules/b2b-company/service"

export default async function seedCustomerLinks({ container }: ExecArgs) {
  const customerModule = container.resolve(Modules.CUSTOMER)
  const b2bService: B2BCompanyModuleService = container.resolve(B2B_COMPANY_MODULE)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  console.log("🔗 Customer <-> Company 모듈 링크 데이터 시딩 시작...")

  // 1. 기업 목록 조회
  const companies = await b2bService.listCompanies()
  if (companies.length === 0) {
    console.log("❌ B2B 기업이 존재하지 않습니다.")
    return
  }

  // 2. 고객 계정 조회 또는 생성
  const existingCustomers = await customerModule.listCustomers({
    email: ["buyer.daehan@acme.com", "buyer.parts@acme.com"],
  })

  let cust1 = existingCustomers.find((c: { email: string }) => c.email === "buyer.daehan@acme.com")
  let cust2 = existingCustomers.find((c: { email: string }) => c.email === "buyer.parts@acme.com")

  if (!cust1) {
    const created = await customerModule.createCustomers([
      {
        email: "buyer.daehan@acme.com",
        first_name: "철수",
        last_name: "김",
        phone: "010-1111-2222",
      },
    ])
    cust1 = created[0]
  }

  if (!cust2) {
    const created = await customerModule.createCustomers([
      {
        email: "buyer.parts@acme.com",
        first_name: "영희",
        last_name: "박",
        phone: "010-3333-4444",
      },
    ])
    cust2 = created[0]
  }

  // 3. Module Link 연결
  await link.create([
    {
      [Modules.CUSTOMER]: {
        customer_id: cust1.id,
      },
      [B2B_COMPANY_MODULE]: {
        b2b_company_id: companies[0].id,
      },
    },
    {
      [Modules.CUSTOMER]: {
        customer_id: cust2.id,
      },
      [B2B_COMPANY_MODULE]: {
        b2b_company_id: companies[1]?.id || companies[0].id,
      },
    },
  ])

  console.log("✅ Customer <-> Company 모듈 링크 생성 완료:")
  console.log(`   - 고객: ${cust1.last_name}${cust1.first_name} (${cust1.email}) <-> 기업: ${companies[0].name}`)
  if (companies[1]) {
    console.log(`   - 고객: ${cust2.last_name}${cust2.first_name} (${cust2.email}) <-> 기업: ${companies[1].name}`)
  }
}

