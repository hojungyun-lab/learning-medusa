import {
  defineMiddlewares,
  validateAndTransformBody,
  authenticate,
} from "@medusajs/framework/http"
import { CreateCompanySchema } from "./admin/b2b/companies/route"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/b2b/*",
      // admin 네임스페이스의 모든 엔드포인트에 관리자 인증 강제 (Bearer 토큰 또는 Session 쿠키)
      middlewares: [
        authenticate("user", ["session", "bearer"]),
      ],
    },
    {
      matcher: "/admin/b2b/companies",
      method: "POST",
      middlewares: [
        // Zod 스키마로 Request Body 유효성 검사 및 파싱
        validateAndTransformBody(
          CreateCompanySchema as unknown as Parameters<typeof validateAndTransformBody>[0]
        ),
      ],
    },
  ],
})

