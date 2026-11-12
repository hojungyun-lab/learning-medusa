import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * 루트 경로(/) 접속 시 관리자 대시보드(/app)로 자동 리다이렉트
 */
export const GET = (req: MedusaRequest, res: MedusaResponse) => {
  res.redirect(302, "/app")
}

