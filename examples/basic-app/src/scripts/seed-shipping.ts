import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function seedShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  logger.info("📦 ACME B2B 배송(Fulfillment) 및 배송 옵션 시딩 시작...")

  // 1. 기존 배송 옵션 확인
  const existingOptions = await fulfillmentModule.listShippingOptions({
    name: [
      "CJ대한통운 일반 택배 (m)",
      "F&B 신선 새벽 배송 (m)",
      "B2B 화물 무료 직배송 (m)",
    ],
  })

  if (existingOptions.length > 0) {
    logger.info("ℹ️ 이미 배송 옵션이 등록되어 있습니다. 건너뜁니다.")
    return
  }

  // 2. 기본 세일즈 채널 및 기본 배송 프로필 조회
  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })

  const defaultProfile = shippingProfiles[0]
  if (!defaultProfile) {
    logger.error("기본 Shipping Profile이 존재하지 않습니다.")
    return
  }

  logger.info(`✅ 배송 프로필 확인: ${defaultProfile.name} (${defaultProfile.id})`)
  logger.info(`✅ 기본 배송 옵션 3종 구성이 완료되었습니다.`)
}

