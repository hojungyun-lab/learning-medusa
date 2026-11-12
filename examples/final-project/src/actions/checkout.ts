"use server"

import { cookies } from "next/headers"
import { sdk } from "@/lib/medusa"

const CART_COOKIE_NAME = "_medusa_cart_id"
const STRIPE_SECRET_KEY = process.env.STRIPE_API_KEY || "sk_test_acme_mock_stripe_key_2026"
const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "pk_f232b3f8847eeba9db34fb2a6656e6e8ab4d407545e072d4170490219eaf2333"

export interface OrderCompleteResult {
  success: boolean
  orderId?: string
  displayId?: string | number
  error?: string
}

export interface ShippingAddressInput {
  name: string
  phone: string
  address: string
  companyName: string
}

/**
 * 카트 배송지 정보 업데이트 및 실제 Stripe 결제 승인 / 주문 완료 통합 액션
 * (가상 목 폴백 없이 실제 Stripe PG 및 Medusa 코어 엔진을 통해 결제 승인)
 */
export async function processStripeCheckoutAction(
  cartId: string,
  paymentMethod: "stripe" | "b2b_credit",
  shippingInfo?: ShippingAddressInput
): Promise<OrderCompleteResult> {
  const cookieStore = cookies()

  try {
    // 1. 카트 기본 이메일 및 배송지 정보 등록
    const nameParts = (shippingInfo?.name || "홍길동 MD").split(" ")
    const firstName = nameParts[0] || "홍길동"
    const lastName = nameParts.slice(1).join(" ") || "MD"

    await fetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        email: "buyer@acme.com",
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          address_1: shippingInfo?.address || "서울특별시 강남구 테헤란로 123 ACME 빌딩 4층",
          city: "서울",
          country_code: "kr",
          postal_code: "06234",
          phone: shippingInfo?.phone || "010-1234-5678",
          company: shippingInfo?.companyName || "(주)대한글로벌",
        },
      }),
    })

    // 2. Stripe 신용카드 결제 선택 시 실제 Stripe PaymentIntent 생성 및 승인 파이프라인
    if (paymentMethod === "stripe") {
      // 2-1. Payment Collection 생성
      const colRes = await fetch(`${MEDUSA_BACKEND_URL}/store/payment-collections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ cart_id: cartId }),
      })

      if (!colRes.ok) {
        const errorData = (await colRes.json()) as { message?: string }
        throw new Error(`결제 컬렉션 생성 실패: ${errorData.message || colRes.statusText}`)
      }

      const colJson = (await colRes.json()) as { payment_collection: { id: string } }
      const collectionId = colJson.payment_collection.id

      // 2-2. Payment Session 초기화 (Medusa Stripe Provider -> Stripe PaymentIntent 생성)
      const sesRes = await fetch(`${MEDUSA_BACKEND_URL}/store/payment-collections/${collectionId}/payment-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ provider_id: "pp_stripe_stripe" }),
      })

      if (!sesRes.ok) {
        const errorData = (await sesRes.json()) as { message?: string }
        throw new Error(`Stripe 결제 세션 초기화 실패: ${errorData.message || sesRes.statusText}`)
      }

      const sesJson = (await sesRes.json()) as {
        payment_collection: {
          payment_sessions: Array<{
            id: string
            data?: { id?: string; client_secret?: string }
          }>
        }
      }

      const paymentIntentId = sesJson.payment_collection.payment_sessions?.[0]?.data?.id
      if (!paymentIntentId) {
        throw new Error("Stripe PaymentIntent ID가 반환되지 않았습니다.")
      }

      // 2-3. 실제 Stripe API 호출: 테스트 카드(pm_card_visa)로 카드 승인(confirm)
      const stripeConfirmRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          payment_method: "pm_card_visa",
          return_url: "http://localhost:3000/checkout/success",
        }),
      })

      const stripeConfirmJson = (await stripeConfirmRes.json()) as {
        error?: { message?: string }
        status?: string
        id?: string
      }

      if (stripeConfirmJson.error) {
        throw new Error(`Stripe 카드 승인 오류: ${stripeConfirmJson.error.message || "승인 거부"}`)
      }
    }

    // 3. Medusa 코어 엔진에 카트 완료(Order 생성) 요청
    const completeRes = await fetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
    })

    const completeJson = (await completeRes.json()) as {
      type?: string
      order?: { id: string; display_id?: number }
      message?: string
    }

    if (completeRes.ok && completeJson.type === "order" && completeJson.order) {
      // 카트 쿠키 삭제 (세션 정상 완료)
      cookieStore.delete(CART_COOKIE_NAME)

      return {
        success: true,
        orderId: completeJson.order.id,
        displayId: completeJson.order.display_id ?? completeJson.order.id.slice(-8),
      }
    }

    // 카트 완료에 실패한 경우: 가상 주문을 생성하지 않고 실제 에러를 반환
    throw new Error(completeJson.message || "Medusa 코어 엔진 주문 완료 처리에 실패했습니다.")
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "결제 처리 중 알 수 없는 오류가 발생했습니다."
    console.error("[Checkout Action Error]:", errorMessage)

    // ⚠️ Mock 가상 주문으로 폴백하지 않고 실제 에러 반환!
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * 기존 completeOrderAction 호환 유지 (Mock Fallback 제거 버전)
 */
export async function completeOrderAction(cartId: string): Promise<OrderCompleteResult> {
  return processStripeCheckoutAction(cartId, "stripe")
}
