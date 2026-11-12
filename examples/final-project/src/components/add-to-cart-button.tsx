"use client"

import { useState } from "react"
import Link from "next/link"
import { addToCartAction } from "@/actions/cart"

interface AddToCartButtonProps {
  variantId?: string
  disabled?: boolean
}

export function AddToCartButton({ variantId, disabled = false }: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState<number>(1)
  const [isPending, setIsPending] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1)
      setFeedback(null)
    }
  }

  const handleIncrease = () => {
    setQuantity((prev) => prev + 1)
    setFeedback(null)
  }

  const handleAddToCart = async () => {
    if (!variantId) {
      setFeedback({ type: "error", message: "선택 가능한 상품 옵션(Variant)이 없습니다." })
      return
    }

    setIsPending(true)
    setFeedback(null)

    const result = await addToCartAction(variantId, quantity)

    if (result.success) {
      setFeedback({
        type: "success",
        message: `장바구니에 ${quantity}개 품목을 추가했습니다.`,
      })
    } else {
      setFeedback({
        type: "error",
        message: result.error || "장바구니 담기에 실패했습니다.",
      })
    }

    setIsPending(false)
  }

  return (
    <div className="space-y-4">
      {/* 수량 선택기 */}
      <div className="flex items-center gap-x-4">
        <label className="text-sm font-semibold text-gray-700">주문 수량</label>
        <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
          <button
            type="button"
            onClick={handleDecrease}
            disabled={quantity <= 1 || isPending}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
          >
            -
          </button>
          <span className="px-4 py-1.5 text-sm font-bold text-gray-900 min-w-[2.5rem] text-center">
            {quantity}
          </span>
          <button
            type="button"
            onClick={handleIncrease}
            disabled={isPending}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* 장바구니 담기 메인 버튼 */}
      <button
        type="button"
        disabled={disabled || isPending || !variantId}
        onClick={handleAddToCart}
        className="w-full bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>장바구니 담는 중...</span>
          </>
        ) : (
          <span>🛒 장바구니 담기</span>
        )}
      </button>

      {/* 실시간 피드백 토스트 안내 */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center justify-between transition-all ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{feedback.message}</span>
          {feedback.type === "success" && (
            <Link
              href="/cart"
              className="text-xs font-bold text-green-700 underline hover:text-green-900 ml-3"
            >
              장바구니 보기 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

