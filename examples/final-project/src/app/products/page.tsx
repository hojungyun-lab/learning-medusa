import { sdk } from "@/lib/medusa"
import Link from "next/link"

const MOCK_SUFFIX = " (m)"

interface ProductVariant {
  id: string
  title: string
}

interface ProductListItem {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  description?: string | null
  variants?: ProductVariant[]
}

// React Server Component (서버에서 직접 Medusa 백엔드 API 호출)
export default async function ProductsCatalogPage() {
  let products: ProductListItem[] = []
  let isLiveBackend = false

  try {
    const response = await sdk.store.product.list({
      limit: 20,
      fields: "id,title,handle,thumbnail,description,variants.id,variants.title",
    })

    if (response.products && response.products.length > 0) {
      products = response.products as ProductListItem[]
      isLiveBackend = true
    }
  } catch (err) {
    console.warn("[Storefront] 백엔드 연동 대기 중 - 폴백 목 데이터를 사용합니다.", err)
  }

  // 백엔드에 상품이 아직 없거나 통신 실패 시 폴백 목 데이터 표시 (규칙 (m) 표기 준수)
  if (products.length === 0) {
    products = [
      {
        id: "prod_mock_01",
        title: `ACME 프리미엄 에스프레소 원두 1kg${MOCK_SUFFIX}`,
        handle: "acme-premium-espresso-beans",
        thumbnail: null,
        description: "F&B 카페 프랜차이즈 전용 고품질 다크 로스트 원두",
        variants: [{ id: "var_01", title: "1kg 기본팩" }],
      },
      {
        id: "prod_mock_02",
        title: `ACME 산업용 고압 추출 펌프 모듈${MOCK_SUFFIX}`,
        handle: "acme-industrial-high-pressure-pump",
        thumbnail: null,
        description: "커피 머신 및 음료 제조 설비용 고내구성 산업 부품",
        variants: [{ id: "var_02", title: "220V 표준 규격" }],
      },
    ]
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 카탈로그 헤더 */}
      <div className="border-b border-gray-200 pb-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            ACME B2B & 리테일 카탈로그
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Next.js 14 Server Component를 통해 Medusa v2 코어 엔진에서 실시간으로 스트리밍된 상품 목록입니다.
          </p>
        </div>

        <div className="flex items-center gap-x-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              isLiveBackend
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-amber-100 text-amber-800 border border-amber-200"
            }`}
          >
            {isLiveBackend ? "● Medusa v2 실시간 연동" : "○ 오프라인 폴백 모드"}
          </span>
          <span className="text-xs text-gray-400">총 {products.length}개 품목</span>
        </div>
      </div>

      {/* 상품 그리드 카드 리스트 */}
      <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
        {products.map((product) => (
          <div
            key={product.id}
            className="group relative border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* 썸네일 영역 */}
              <div className="w-full h-48 overflow-hidden rounded-lg bg-gray-100 relative flex items-center justify-center border border-gray-100">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 text-xs">
                    <span className="text-2xl mb-1">📦</span>
                    <span>이미지 준비 중</span>
                  </div>
                )}
              </div>

              {/* 상품 메타데이터 */}
              <div className="mt-4">
                <span className="text-[11px] font-mono text-gray-400 block mb-1">
                  ID: {product.id}
                </span>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition">
                  {product.title}
                </h3>
                {product.description && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                    {product.description}
                  </p>
                )}
              </div>
            </div>

            {/* 카드 푸터: 옵션 정보 및 상세 버튼 */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                옵션 {product.variants?.length ?? 1}개 제공
              </span>
              <Link
                href={`/products/${product.handle}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                상세 보기 →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
