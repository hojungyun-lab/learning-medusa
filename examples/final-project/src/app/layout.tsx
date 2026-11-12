import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: "ACME B2B & Retail Storefront",
  description: "Next.js 14 App Router와 Medusa v2로 구동되는 엔터프라이즈 B2B 커머스 스토어프론트",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="flex flex-col min-h-screen">
        <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-x-8">
              <Link href="/" className="flex items-center gap-x-2">
                <span className="font-black text-xl tracking-wider text-blue-600">ACME</span>
                <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">B2B Core</span>
              </Link>
              <nav className="hidden md:flex gap-x-6 text-sm font-medium text-gray-700">
                <Link href="/" className="hover:text-blue-600 transition">홈</Link>
                <Link href="/products" className="hover:text-blue-600 transition">상품 카탈로그</Link>
                <Link href="/cart" className="hover:text-blue-600 transition flex items-center gap-1 font-semibold text-blue-700">
                  <span>🛒</span>
                  <span>장바구니</span>
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-x-4">
              <span className="text-xs text-gray-500 hidden sm:inline-block">Medusa v2 연결됨</span>
              <a
                href="http://localhost:9000/app"
                target="_blank"
                rel="noreferrer"
                className="text-xs border border-gray-300 rounded px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                관리자 백오피스 ↗
              </a>
            </div>
          </div>
        </header>

        <div className="flex-1">
          {children}
        </div>

        <footer className="border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-500">
          <p>© 2026 ACME B2B Commerce. Powered by Next.js 14 App Router & Medusa.js v2</p>
        </footer>
      </body>
    </html>
  )
}

