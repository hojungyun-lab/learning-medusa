"use server"

import { cookies } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { sdk } from "@/lib/medusa"

const CART_COOKIE_NAME = "_medusa_cart_id"

export interface CartItem {
  id: string
  title: string
  variant_id: string
  quantity: number
  unit_price: number
  thumbnail?: string | null
}

export interface StoreCart {
  id: string
  items: CartItem[]
  total: number
  subtotal: number
  currency_code: string
}

/**
 * 활성 장바구니를 가져오거나 없으면 새로 생성합니다.
 */
export async function getOrCreateCart(regionId?: string): Promise<string> {
  const cookieStore = cookies()
  const existingCartId = cookieStore.get(CART_COOKIE_NAME)?.value

  if (existingCartId) {
    try {
      const { cart } = await sdk.store.cart.retrieve(existingCartId)
      if (cart && !cart.completed_at) {
        return cart.id
      }
    } catch {
      // 기존 장바구니 만료 시 신규 생성으로 진행
    }
  }

  // regionId가 없을 경우 활성화된 첫 번째 리전 자동 조회 및 연결
  let targetRegionId = regionId
  if (!targetRegionId) {
    try {
      const { regions } = await sdk.store.region.list()
      if (regions && regions.length > 0) {
        targetRegionId = regions[0].id
      }
    } catch {
      // 리전 조회 실패 시 기본 생성 시도
    }
  }

  const { cart } = await sdk.store.cart.create({
    region_id: targetRegionId,
  })

  cookieStore.set(CART_COOKIE_NAME, cart.id, {
    maxAge: 60 * 60 * 24 * 30, // 30일
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  return cart.id
}

/**
 * 현재 세션의 장바구니 데이터를 조회합니다.
 */
export async function getCartAction(): Promise<StoreCart | null> {
  const cookieStore = cookies()
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value

  if (!cartId) {
    return null
  }

  try {
    const { cart } = await sdk.store.cart.retrieve(cartId, {
      fields: "+items.*,+items.variant.*",
    })

    if (!cart) return null

    const rawItems = (cart.items ?? []) as Array<Record<string, unknown>>
    const items: CartItem[] = rawItems.map((item) => ({
      id: String(item.id ?? ""),
      title: String(item.title ?? "상품"),
      variant_id: String(item.variant_id ?? ""),
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : null,
    }))

    return {
      id: cart.id,
      items,
      total: Number(cart.total ?? 0),
      subtotal: Number(cart.subtotal ?? 0),
      currency_code: String(cart.currency_code ?? "krw").toUpperCase(),
    }
  } catch {
    return null
  }
}

/**
 * 장바구니에 특정 Variant 품목을 추가합니다.
 */
export async function addToCartAction(
  variantId: string,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const cartId = await getOrCreateCart()

    await sdk.store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity,
    })

    revalidateTag("cart")
    revalidatePath("/cart")
    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "장바구니 추가 중 알 수 없는 오류 발생"
    return { success: false, error: errorMsg }
  }
}

/**
 * 장바구니 품목의 수량을 변경합니다.
 */
export async function updateCartItemAction(
  lineItemId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = cookies()
    const cartId = cookieStore.get(CART_COOKIE_NAME)?.value
    if (!cartId) throw new Error("장바구니 세션을 찾을 수 없습니다.")

    if (quantity <= 0) {
      await sdk.store.cart.deleteLineItem(cartId, lineItemId)
    } else {
      await sdk.store.cart.updateLineItem(cartId, lineItemId, {
        quantity,
      })
    }

    revalidateTag("cart")
    revalidatePath("/cart")
    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "수량 변경 중 오류 발생"
    return { success: false, error: errorMsg }
  }
}

/**
 * 장바구니에서 특정 품목을 제거합니다.
 */
export async function deleteCartItemAction(
  lineItemId: string
): Promise<{ success: boolean; error?: string }> {
  return updateCartItemAction(lineItemId, 0)
}
