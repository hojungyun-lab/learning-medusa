import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { B2B_COMPANY_MODULE } from "../../../../modules/b2b-company"
import B2BCompanyModuleService from "../../../../modules/b2b-company/service"

// 1. 요청 페이로드 검증 스키마 정의
export const CreateCompanySchema = z.object({
  name: z.string().min(2, "회사명은 최소 2글자 이상이어야 합니다."),
  business_number: z
    .string()
    .regex(/^\d{3}-\d{2}-\d{5}$/, "올바른 사업자등록번호 형식(XXX-XX-XXXXX)이 아닙니다."),
  credit_limit: z.number().int().positive().optional(),
  phone: z.string().min(8, "전화번호는 최소 8자리 이상이어야 합니다."),
})

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>

// 2. GET: B2B 기업 목록 조회
export const GET = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const b2bService: B2BCompanyModuleService = req.scope.resolve(B2B_COMPANY_MODULE)

  // 쿼리 파라미터 파싱
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Math.max(Number(req.query.offset) || 0, 0)

  const [companies, count] = await b2bService.listAndCountCompanies(
    {},
    {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    }
  )

  res.status(200).json({
    companies,
    count,
    limit,
    offset,
  })
}

// 3. POST: 신규 B2B 기업 등록 (Zod 미들웨어에서 검증 완료된 바디 사용)
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

