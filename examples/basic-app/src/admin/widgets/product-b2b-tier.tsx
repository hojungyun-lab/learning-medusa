import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Text, Button } from "@medusajs/ui"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useState } from "react"

// 목(Mock) 데이터 식별 상수 (운영 규칙 준수)
const MOCK_SUFFIX = " (m)"

const ProductB2BWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [tierName, setTierName] = useState<string>(`엔터프라이즈 골드 등급${MOCK_SUFFIX}`)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  const handleTierRefresh = () => {
    setIsUpdating(true)
    // 비즈니스 로직 시뮬레이션
    setTimeout(() => {
      setTierName(`엔터프라이즈 플래티넘 등급${MOCK_SUFFIX}`)
      setIsUpdating(false)
    }, 600)
  }

  return (
    <Container className="p-6 bg-ui-bg-subtle border border-ui-border-base rounded-lg mb-4">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-ui-fg-base text-base font-semibold">
            ACME B2B 공급 등급 설정
          </Heading>
          <Text className="text-ui-fg-muted text-sm mt-1">
            상품 ID: {data.id} | 등록일: {data.created_at ? new Date(data.created_at).toLocaleDateString("ko-KR") : "-"}
          </Text>
        </div>
        <Badge color="blue" size="base">
          {tierName}
        </Badge>
      </div>

      <div className="mt-4 pt-4 border-t border-ui-border-base flex justify-end">
        <Button
          variant="secondary"
          size="small"
          isLoading={isUpdating}
          onClick={handleTierRefresh}
        >
          등급 갱신
        </Button>
      </div>
    </Container>
  )
}

// 위젯이 주입될 위치: 상품 상세 페이지 메인 콘텐츠 상단
export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductB2BWidget
