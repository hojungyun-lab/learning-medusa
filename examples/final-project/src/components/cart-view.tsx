"use client"

import { useState } from "react"
import Link from "next/link"
import { updateCartItemAction, deleteCartItemAction, StoreCart } from "@/actions/cart"

interface CartViewProps {
  initialCart: StoreCart | null
}

export function CartView({ initialCart }: CartViewProps) {
  const [cart, setCart] = useState<StoreCart | null>(initialCart)
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleUpdateQuantity = async (lineItemId: string, newQty: number) => {
    setLoadingItemId(lineItemId)
    setActionError(null)

    const res = await updateCartItemAction(lineItemId, newQty)
    if (res.success) {
      if (cart) {
        if (newQty <= 0) {
          const updatedItems = cart.items.filter((i) => i.id !== lineItemId)
          const newTotal = updatedItems.reduce((acc, cur) => acc + cur.unit_price * cur.quantity, 0)
          setCart({ ...cart, items: updatedItems, total: newTotal, subtotal: newTotal })
        } else {
          const updatedItems = cart.items.map((i) =>
            i.id === lineItemId ? { ...i, quantity: newQty } : i
          )
          const newTotal = updatedItems.reduce((acc, cur) => acc + cur.unit_price * cur.quantity, 0)
          setCart({ ...cart, items: updatedItems, total: newTotal, subtotal: newTotal })
        }
      }
    } else {
      setActionError(res.error || "수량 변경에 실패했습니다.")
    }

    setLoadingItemId(null)
  }

  const handleDeleteItem = async (lineItemId: string) => {
    await handleUpdateQuantity(lineItemId, 0)
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm max-w-2xl mx-auto my-8">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">장바구니가 비어 있습니다</h2>
        <p className="text-sm text-gray-500 mb-8">
          원하는 원두와 부품을 카탈로그에서 찾아 장바구니에 담아보세요.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center justify-center bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition"
        >
          상품 카탈로그 둘러보기 →
        </Link>
      </div>
    )
  }

  const formatPrice = (amount: number) => {
    return `${amount.toLocaleString()}원`
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 장바구니 품목 목록 (2열) */}
      <div className="lg:col-span-2 space-y-4">
        {actionError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {actionError}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm overflow-hidden">
          {cart.items.map((item) => (
            <div key={item.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-200">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{item.title}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">단가: {formatPrice(item.unit_price || 35000)}</p>
                </div>
              </div>

              {/* 수량 조절 및 삭제 액션 */}
              <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                <div className="inline-flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={loadingItemId === item.id || item.quantity <= 1}
                    className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition font-bold"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 text-sm font-semibold text-gray-800 min-w-[2rem] text-center">
                    {loadingItemId === item.id ? "..." : item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={loadingItemId === item.id}
                    className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="text-right min-w-[5rem]">
                  <span className="font-bold text-gray-900 text-sm">
                    {formatPrice((item.unit_price || 35000) * item.quantity)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={loadingItemId === item.id}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline transition"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
          <span>ℹ️</span>
          <span>
            <b>F&B 대량 발주 혜택</b>: 10개 이상 대량 구매 시 사업자 전용 추가 5% 할인이 결제 단계에서 자동 적용됩니다.
          </span>
        </div>
      </div>

      {/* 주문 요약 결제 사이드바 (1열) */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-24">
          <h2 className="text-lg font-bold text-gray-900 pb-4 border-b border-gray-100">
            주문 합계
          </h2>

          <div className="space-y-3 py-4 border-b border-gray-100 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>상품 소계</span>
              <span className="font-medium text-gray-900">{formatPrice(cart.subtotal || cart.total || 35000)}</span>
            </div>
            <div className="flex justify-between">
              <span>예상 배송비</span>
              <span className="text-green-600 font-medium">무료 배송 (B2B 프로모션)</span>
            </div>
            <div className="flex justify-between">
              <span>부가세 (VAT 10%)</span>
              <span className="font-medium text-gray-900">
                {formatPrice(Math.round((cart.total || 35000) * 0.1))}
              </span>
            </div>
          </div>

          <div className="pt-4 pb-6 flex justify-between items-baseline">
            <span className="text-base font-bold text-gray-900">총 결제 예정 금액</span>
            <span className="text-2xl font-black text-blue-600">
              {formatPrice(Math.round((cart.total || 35000) * 1.1))}
            </span>
          </div>

          <Link
            href="/checkout"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl text-center block transition shadow-sm"
          >
            주문서 작성 및 결제 진행 →
          </Link>

          <p className="mt-3 text-center text-[11px] text-gray-400">
            다음 10단계(Stripe / B2B 여신 결제 파이프라인)로 연결됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

