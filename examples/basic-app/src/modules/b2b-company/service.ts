import { MedusaService } from "@medusajs/framework/utils"
import { Company, CompanyEmployee } from "./models/company"

export default class B2BCompanyModuleService extends MedusaService({
  Company,
  CompanyEmployee,
}) {
  async canPlaceOrder(companyId: string, orderAmount: number): Promise<boolean> {
    const company = await this.retrieveCompany(companyId)
    if (company.status !== "approved") {
      return false
    }
    const remaining = Number(company.credit_limit) - Number(company.spent_amount)
    return remaining >= orderAmount
  }

  async adjustSpentAmount(companyId: string, delta: number): Promise<void> {
    const company = await this.retrieveCompany(companyId)
    const newSpent = Number(company.spent_amount) + delta
    if (newSpent < 0) {
      throw new Error("여신 사용액은 0보다 작을 수 없습니다.")
    }
    await this.updateCompanies({
      id: companyId,
      spent_amount: newSpent,
    })
  }
}

