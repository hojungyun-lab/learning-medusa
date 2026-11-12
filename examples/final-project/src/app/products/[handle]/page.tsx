import Link from "next/link"
import { notFound } from "next/navigation"
import { sdk } from "@/lib/medusa"
import { AddToCartButton } from "@/components/add-to-cart-button"

const MOCK_SUFFIX = " (m)"

interface ProductPageProps {
  params: {
    handle: string
  }
}

interface ProductVariant {
  id: string
  title: string
  calculated_price?: {
    calculated_amount?: number
    currency_code?: string
  }
}

interface ProductDetail {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  variants: ProductVariant[]
}

async function getProduct(rawHandle: string): Promise<ProductDetail | null> {
  const handle = decodeURIComponent(rawHandle)

  try {
    const { products } = await sdk.store.product.list({
      handle,
      fields: "+variants.*",
    })

    if (products && products.length > 0) {
      const p = products[0] as unknown as ProductDetail
      return {
        id: p.id,
        title: p.title,
        handle: p.handle,
        description: p.description,
        thumbnail: p.thumbnail,
        variants: p.variants || [],
      }
    }
  } catch {
    // 오프라인 폴백 모드
  }

  // 폴백 목 데이터 (F&B / 산업용 원두 및 부품)
  if (handle === "acme-industrial-high-pressure-pump") {
    return {
      id: "prod_mock_02",
      title: `ACME 산업용 고압 추출 펌프 모듈${MOCK_SUFFIX}`,
      handle: "acme-industrial-high-pressure-pump",
      description: "커피 머신 및 음료 제조 설비용 고내구성 산업 부품입니다. 일정한 고압(15 bar)을 안정적으로 유지합니다.",
      thumbnail: null,
      variants: [{ id: "var_mock_02", title: "220V 표준 규격" }],
    }
  }

  return {
    id: "prod_01M6J7F4DW7QQQPAAP4RAS1GGX",
    title: `ACME 프리미엄 원두 1kg${MOCK_SUFFIX}`,
    handle: handle || "acme-프리미엄-원두-1kg-m",
    description: "F&B 카페 프랜차이즈 전용 고품질 에스프레소 블렌드입니다. 브라질 및 콜롬비아 스페셜티 아라비카 원두를 최적의 비율로 블렌딩하였습니다.",
    thumbnail: null,
    variants: [{ id: "variant_01M6JET17Q2FQ750414XSGE1T4", title: "홀빈 (원두 그대로)" }],
  }
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const product = await getProduct(params.handle)

  if (!product) {
    notFound()
  }

  const primaryVariant = product.variants?.[0]

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 네비게이션 */}
      <nav className="mb-6">
        <Link
          href="/products"
          className="text-sm font-medium text-gray-500 hover:text-blue-600 transition flex items-center gap-1"
        >
          ← 상품 카탈로그로 돌아가기
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        {/* 상품 대표 이미지 영역 */}
        <div className="w-full aspect-square rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <span className="text-6xl mb-2">☕</span>
              <span className="text-sm">상품 고해상도 이미지 준비 중</span>
            </div>
          )}
        </div>

        {/* 상품 정보 및 구매 인터랙션 */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-md mb-3">
              B2B & 리테일 인증 품목
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {product.title}
            </h1>
            <p className="mt-2 text-xs font-mono text-gray-400">
              Product ID: {product.id}
            </p>

            <div className="mt-6 border-t border-b border-gray-100 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-gray-900">35,000원</span>
                <span className="text-xs text-gray-500 font-medium">(VAT 별도, B2B 도매 기준가)</span>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900">상품 상세 설명</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {product.description || "등록된 상세 설명이 없습니다."}
              </p>
            </div>

            {/* 규격 및 옵션 정보 */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2">선택된 규격(옵션)</h3>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 flex justify-between items-center">
                <span className="font-semibold">{primaryVariant?.title ?? "기본 단일 규격"}</span>
                <span className="text-gray-400 font-mono text-[11px]">{primaryVariant?.id ?? "기본 SKU"}</span>
              </div>
            </div>
          </div>

          {/* 장바구니 담기 섹션 */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <AddToCartButton variantId={primaryVariant?.id} />
          </div>
        </div>
      </div>
    </main>
  )
}

