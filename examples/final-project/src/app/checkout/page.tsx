import Link from "next/link"
import { getCartAction } from "@/actions/cart"
import { CheckoutPaymentForm } from "@/components/checkout-payment-form"

export const dynamic = "force-dynamic"

export default async function CheckoutPage() {
  const cart = await getCartAction()

  if (!cart || cart.items.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 shadow-sm">
          <div className="text-5xl mb-4">🛒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">결제할 상품이 없습니다</h1>
          <p className="text-sm text-gray-500 mb-6">
            장바구니에 담긴 상품이 없습니다. 카탈로그에서 상품을 먼저 담아주세요.
          </p>
          <Link
            href="/products"
            className="inline-flex bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition"
          >
            카탈로그 보러 가기 →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="border-b border-gray-200 pb-5 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">주문서 작성 및 결제</h1>
          <p className="mt-1 text-sm text-gray-500">
            Stripe 글로벌 카드 결제 및 B2B 여신 한도 분기 결제 파이프라인
          </p>
        </div>
        <Link
          href="/cart"
          className="text-xs font-semibold text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
        >
          ← 장바구니로 돌아가기
        </Link>
      </div>

      <CheckoutPaymentForm cart={cart} />
    </main>
  )
}

