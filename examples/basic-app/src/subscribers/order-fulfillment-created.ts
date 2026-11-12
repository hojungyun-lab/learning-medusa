import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

interface OrderFulfillmentCreatedEventData {
  id: string
  order_id?: string
}

export default async function orderFulfillmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderFulfillmentCreatedEventData>) {
  const fulfillmentId = data.id
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info(`[Event Bus] 🚚 물류 출고 이벤트 수신 (order.fulfillment_created) - Fulfillment ID: ${fulfillmentId}`)

  try {
    logger.info(`[알림톡 트리거 (m)] 📱 고객에게 [ACME F&B 출고 완료 및 운송장 안내] 카카오 알림톡 발송 완료`)
    logger.info(`[택배사 네트워크 (m)] 🚛 CJ대한통운 물류망으로 실시간 집하 요청 전문(EDI) 전송 완료`)
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류"
    logger.error(`[Event Bus Error] order.fulfillment_created 처리 실패: ${errorMsg}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.fulfillment_created",
}

