import Link from "next/link"

const MOCK_SUFFIX = " (m)"

export default function HomePage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full mb-4">
          Next.js 14 App Router + Medusa v2 SDK
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
          ACME 엔터프라이즈 B2B<br />디지털 커머스 포털
        </h1>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          헤드리스 아키텍처를 기반으로 초고속 서버 사이드 렌더링(RSC)과 Medusa Core API를 연동하여
          B2B 여신 거래, 견적서 발주, 그리고 실시간 재고 조회를 완벽하게 지원합니다.
        </p>

        <div className="flex justify-center gap-x-4">
          <Link
            href="/products"
            className="bg-blue-600 text-white font-medium px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition"
          >
            실시간 상품 카탈로그 보기 →
          </Link>
          <a
            href="http://localhost:9000/app"
            target="_blank"
            rel="noreferrer"
            className="border border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-lg hover:bg-gray-50 transition"
          >
            Medusa 관리자 페이지 열기
          </a>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">⚡ 0.5초 초고속 SSR</h3>
          <p className="text-sm text-gray-500">
            React Server Component가 서버에서 직접 백엔드 API를 호출하여 완성된 HTML을 즉시 렌더링합니다.
          </p>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🛡️ B2B 기업 여신 연동</h3>
          <p className="text-sm text-gray-500">
            기업별 승인 여신 한도 내에서 외상 거래 주문 및 실시간 분산 트랜잭션 롤백을 보장합니다.
          </p>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🔒 Publishable Key 보안</h3>
          <p className="text-sm text-gray-500">
            판매 채널(Sales Channel) 전용 공개 API 키를 통해 안전하게 허용된 카탈로그 데이터만 노출합니다.
          </p>
        </div>
      </div>
    </main>
  )
}

