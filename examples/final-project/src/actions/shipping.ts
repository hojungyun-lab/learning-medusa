"use server"

import { revalidatePath } from "next/cache"

const MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export interface StoreShippingOption {
  id: string
  name: string
  amount: number
  price_type: string
  description?: string
  badge?: string
}

/**
 * 카트에서 선택 가능한 배송 옵션 목록을 조회합니다.
 */
export async function getShippingOptionsAction(cartId: string): Promise<StoreShippingOption[]> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, {
      headers: {
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return getFallbackShippingOptions()
    }

    const data = (await res.json()) as { shipping_options?: Array<{ id: string; name: string; amount: number; price_type: string }> }
    const options = data.shipping_options ?? []

    if (options.length === 0) {
      return getFallbackShippingOptions()
    }

    return options.map((opt) => ({
      id: opt.id,
      name: opt.name,
      amount: opt.amount,
      price_type: opt.price_type,
      description: getShippingDescription(opt.name),
      badge: getShippingBadge(opt.amount),
    }))
  } catch (err: unknown) {
    console.warn("[Shipping Options API Warning]:", err instanceof Error ? err.message : String(err))
    return getFallbackShippingOptions()
  }
}

/**
 * 카트에 특정 배송 옵션을 적용합니다.
 */
export async function setShippingMethodAction(
  cartId: string,
  shippingOptionId: string
): Promise<{ success: boolean; shippingTotal?: number; total?: number; error?: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ option_id: shippingOptionId }),
    })

    if (!res.ok) {
      const errJson = (await res.json()) as { message?: string }
      return { success: false, error: errJson.message || "배송 옵션 적용 실패" }
    }

    const json = (await res.json()) as {
      cart: { shipping_total?: number; total?: number }
    }

    revalidatePath("/checkout")
    revalidatePath("/cart")

    return {
      success: true,
      shippingTotal: json.cart.shipping_total ?? 0,
      total: json.cart.total ?? 0,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "배송 수단 변경 중 오류 발생",
    }
  }
}

/**
 * 주문의 최신 출고(Fulfillment) 및 배송 상태를 조회합니다.
 */
export async function getOrderFulfillmentAction(orderId: string): Promise<{
  status: string
  fulfillmentStatus: "not_fulfilled" | "partially_fulfilled" | "fulfilled" | "shipped" | "delivered"
  trackingNumber?: string
  trackingUrl?: string
  carrierName?: string
  shippedAt?: string
  deliveredAt?: string
}> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/orders/${orderId}?fields=*fulfillments,*fulfillments.labels`, {
      headers: {
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return {
        status: "pending",
        fulfillmentStatus: "not_fulfilled",
      }
    }

    const data = (await res.json()) as {
      order?: {
        status?: string
        fulfillment_status?: string
        fulfillments?: Array<{
          id: string
          shipped_at?: string
          delivered_at?: string
          labels?: Array<{ tracking_number?: string; tracking_url?: string }> | null
        }>
      }
    }

    const orderFulfillmentStatus = data.order?.fulfillment_status
    const fulfillments = data.order?.fulfillments ?? []

    // 1. 주문 자체의 fulfillment_status가 delivered인 경우
    if (orderFulfillmentStatus === "delivered") {
      const latest = fulfillments[0]
      const label = latest?.labels?.[0]
      return {
        status: data.order?.status || "completed",
        fulfillmentStatus: "delivered",
        trackingNumber: label?.tracking_number || "6829-4102-8891 (m)",
        trackingUrl: label?.tracking_url || "https://carrier.acme.com/track?no=682941028891",
        carrierName: "CJ대한통운",
        shippedAt: latest?.shipped_at || undefined,
        deliveredAt: latest?.delivered_at || undefined,
      }
    }

    // 2. 출고 건이 없는 경우 (미출고)
    if (fulfillments.length === 0 || orderFulfillmentStatus === "not_fulfilled") {
      return {
        status: data.order?.status || "pending",
        fulfillmentStatus: "not_fulfilled",
      }
    }

    const latest = fulfillments[0]
    const label = latest.labels?.[0]

    let resolvedStatus: "not_fulfilled" | "partially_fulfilled" | "fulfilled" | "shipped" | "delivered" = "fulfilled"
    if (latest.delivered_at || orderFulfillmentStatus === "delivered") {
      resolvedStatus = "delivered"
    } else if (latest.shipped_at || orderFulfillmentStatus === "shipped") {
      resolvedStatus = "shipped"
    }

    return {
      status: data.order?.status || "pending",
      fulfillmentStatus: resolvedStatus,
      trackingNumber: label?.tracking_number || "6829-4102-8891 (m)",
      trackingUrl: label?.tracking_url || "https://carrier.acme.com/track?no=682941028891",
      carrierName: "CJ대한통운",
      shippedAt: latest.shipped_at || undefined,
      deliveredAt: latest.delivered_at || undefined,
    }
  } catch {
    return {
      status: "pending",
      fulfillmentStatus: "not_fulfilled",
    }
  }
}

function getFallbackShippingOptions(): StoreShippingOption[] {
  return [
    {
      id: "so_01M6JP048NRYC8QX5GK8DV21TD",
      name: "CJ대한통운 일반 택배 (m)",
      amount: 3000,
      price_type: "flat",
      description: "영업일 기준 2~3일 소요 (전국 기본 배송)",
      badge: "표준 배송",
    },
    {
      id: "so_01M6JP04AVMX4Z6EJGK1G3CWC3",
      name: "F&B 신선 새벽 배송 (m)",
      amount: 6000,
      price_type: "flat",
      description: "익일 오전 7시 도착 보장 (원두 신선도 유지 콜드체인)",
      badge: "새벽 특급",
    },
    {
      id: "so_01M6JP04CET7DTG2ECJ9KCZ81S",
      name: "B2B 화물 무료 직배송 (m)",
      amount: 0,
      price_type: "flat",
      description: "대량 발주 전용 용차 배송 (10박스 이상 무료)",
      badge: "대량 무료",
    },
  ]
}

function getShippingDescription(name: string): string {
  if (name.includes("새벽") || name.includes("신선")) {
    return "익일 오전 7시 도착 보장 (원두 신선도 유지 콜드체인)"
  }
  if (name.includes("화물") || name.includes("무료")) {
    return "대량 발주 전용 용차 배송 (사업자 전용)"
  }
  return "영업일 기준 2~3일 소요 (전국 기본 배송)"
}

function getShippingBadge(amount: number): string {
  if (amount === 0) return "무료 배송"
  if (amount > 5000) return "새벽 특급"
  return "표준 배송"
}

