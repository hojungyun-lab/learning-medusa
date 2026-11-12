import Link from "next/link"
import { getOrderFulfillmentAction } from "@/actions/shipping"

interface SuccessPageProps {
  searchParams: {
    orderId?: string
    displayId?: string
    amount?: string
    method?: string
    shipping?: string
  }
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const displayId = searchParams.displayId || "ACME-2026-9872"
  const orderId = searchParams.orderId || "order_01M6JMQ4ZZFY323A9T384ENVPT"
  const amount = searchParams.amount ? Number(searchParams.amount).toLocaleString() : "115,500"
  const isB2bCredit = searchParams.method === "b2b_credit"
  const shippingName = searchParams.shipping
    ? decodeURIComponent(searchParams.shipping)
    : "CJ대한통운 일반 택배 (m)"

  // Medusa v2 주문 출고(Fulfillment) 상태 실시간 조회
  const fulfillment = await getOrderFulfillmentAction(orderId)

  const isDelivered = fulfillment.fulfillmentStatus === "delivered"
  const isShipped = fulfillment.fulfillmentStatus === "shipped"
  const isFulfilled = fulfillment.fulfillmentStatus === "fulfilled"
  const hasFulfillment = isDelivered || isShipped || isFulfilled

  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 shadow-sm text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
          ✓
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
          결제 및 주문 완료
        </span>

        <h1 className="text-3xl font-extrabold text-gray-900 mt-4 mb-2">
          주문이 성공적으로 접수되었습니다!
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Medusa v2 코어 엔진에 주문이 안전하게 등록되었으며 물류 출고 파이프라인(Fulfillment)으로 이관되었습니다.
        </p>

        {/* 주문 세부 정보 카드 */}
        <div className="bg-gray-50 rounded-xl p-6 text-left border border-gray-200 mb-6 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">주문 번호</span>
            <span className="font-mono font-bold text-gray-900 text-base">#{displayId}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">결제 수단</span>
            <span className="font-medium text-gray-900">
              {isB2bCredit ? "B2B 외상 여신 한도 정산" : "신용카드 (Stripe PG)"}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">선택된 배송 방법</span>
            <span className="font-semibold text-blue-700">{shippingName}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">결제 승인 금액</span>
            <span className="font-bold text-blue-600 text-base">{amount}원</span>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-200">
            <span>내부 주문 ID:</span>
            <span className="font-mono">{orderId}</span>
          </div>
        </div>

        {/* 11단계: 실시간 배송 및 출고(Fulfillment) 상태 카드 */}
        <div className="bg-white rounded-xl p-6 text-left border-2 border-blue-100 shadow-sm mb-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚚</span>
              <h3 className="font-bold text-gray-900 text-base">물류 배송 및 출고 현황 (Fulfillment)</h3>
            </div>
            {isDelivered && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                ● 배송 완료 (Delivered)
              </span>
            )}
            {isShipped && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                ● 출고/배송중 (Shipped)
              </span>
            )}
            {isFulfilled && !isShipped && !isDelivered && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                ● 출고 준비 (Fulfilled)
              </span>
            )}
            {!hasFulfillment && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                ● 물류 준비중 (Pending)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">출고 거점 / 물류센터</span>
              <span className="font-semibold text-gray-800">
                ACME 서울 중앙물류센터 (m)
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">운송장 번호 (Tracking)</span>
              {hasFulfillment ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-700">
                    {fulfillment.trackingNumber || "6829-4102-8891 (m)"}
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded">
                    CJ대한통운
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 italic">출고 등록 후 실시간 자동 생성</span>
              )}
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-lg p-3.5 text-xs text-blue-900 border border-blue-100 flex items-start gap-2">
            <span>ℹ️</span>
            <div>
              <b>Medusa v2 물류 파이프라인 연동 상태</b>:
              {isDelivered && (
                <p className="mt-0.5 text-purple-900 font-medium">
                  수령인에게 배송이 완료되었습니다 (`Mark as delivered`). F&B 신선도 검수 및 검수가 완료되어 최종 수령 처리되었습니다.
                </p>
              )}
              {isShipped && (
                <p className="mt-0.5 text-blue-800">
                  관리자 백오피스에서 출고(`Create Fulfillment`) 및 운송장 번호 등록이 완료되었습니다. 택배사 연동 네트워크를 통해 실시간 이동 경로가 추적됩니다.
                </p>
              )}
              {isFulfilled && !isShipped && !isDelivered && (
                <p className="mt-0.5 text-blue-800">
                  물류 거점에서 상품 패킹이 완료되었습니다. 운송장 출력 및 택배사 인계를 대기 중입니다.
                </p>
              )}
              {!hasFulfillment && (
                <p className="mt-0.5 text-blue-800">
                  주문 접수 및 가승인 상태입니다. 백오피스 관리자 페이지에서 주문 상세 조회 후 `Create Fulfillment`를 실행하면 운송장이 즉시 발급됩니다.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/products"
            className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-sm"
          >
            카탈로그 더 둘러보기
          </Link>
          <a
            href="http://localhost:9000/app/orders"
            target="_blank"
            rel="noreferrer"
            className="border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition"
          >
            관리자 콘솔에서 주문 확인 ↗
          </a>
        </div>
      </div>
    </main>
  )
}
