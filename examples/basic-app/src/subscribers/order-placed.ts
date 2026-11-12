import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

interface OrderPlacedEventData {
  id: string
}

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedEventData>) {
  const orderId = data.id
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info(`[Event Bus] 🔔 신규 주문 이벤트 수신 (order.placed) - ID: ${orderId}`)

  try {
    // Remote Query를 통한 주문 상세 및 연결 데이터 조회
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "total",
        "currency_code",
        "email",
        "items.*",
        "shipping_address.*",
      ],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    const displayId = order?.display_id ?? "N/A"
    const totalAmount = order?.total?.toLocaleString() ?? "0"
    const itemCount = order?.items?.length ?? 0
    const customerEmail = order?.email ?? "buyer@acme.com"

    logger.info(`[ERP 연동 (m)] 🏢 ACME 중앙 ERP로 주문 전송 성공 (주문번호 #${displayId}, 품목 ${itemCount}건, 결제금액: ${totalAmount} KRW)`)
    logger.info(`[F&B 물류 WMS (m)] 📦 ACME 서울 중앙물류센터로 피킹/패킹 지시서 전송 완료`)
    logger.info(`[알림톡/메일 (m)] 💬 구매 담당자(${customerEmail})에게 결제 완료 및 배송 준비 알림 발송 완료`)
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "알 수 없는 오류"
    logger.error(`[Event Bus Error] order.placed 후속 처리 중 오류 발생 (Order: ${orderId}): ${errorMsg}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}

