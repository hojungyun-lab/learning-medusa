import Link from "next/link"
import { getCartAction } from "@/actions/cart"
import { CartView } from "@/components/cart-view"

export const dynamic = "force-dynamic"

export default async function CartPage() {
  const cart = await getCartAction()

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="border-b border-gray-200 pb-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            장바구니 (Cart)
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Medusa v2 세션 쿠키(`_medusa_cart_id`)에 보존된 실시간 주문 장바구니 항목입니다.
          </p>
        </div>

        <Link
          href="/products"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition self-start sm:self-auto"
        >
          ← 상품 계속 둘러보기
        </Link>
      </div>

      <CartView initialCart={cart} />
    </main>
  )
}

