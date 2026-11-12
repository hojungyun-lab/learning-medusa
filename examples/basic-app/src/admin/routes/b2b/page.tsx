import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Button, Prompt, Text } from "@medusajs/ui"
import { Buildings } from "@medusajs/icons"
import { useState } from "react"

interface B2BCompanyRecord {
  id: string
  name: string
  business_number: string
  credit_limit: number
  status: "pending" | "approved" | "suspended"
}

// 초기 목 데이터 (운영 규칙에 따른 (m) 표기 적용)
const MOCK_SUFFIX = " (m)"

const initialCompanies: B2BCompanyRecord[] = [
  {
    id: "comp_01",
    name: `(주)대한글로벌${MOCK_SUFFIX}`,
    business_number: "123-45-67890",
    credit_limit: 50000000,
    status: "pending",
  },
  {
    id: "comp_02",
    name: `ACME 부품유통${MOCK_SUFFIX}`,
    business_number: "987-65-43210",
    credit_limit: 100000000,
    status: "approved",
  },
]

const B2BCompanyAdminPage = () => {
  const [companies, setCompanies] = useState<B2BCompanyRecord[]>(initialCompanies)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(false)

  // 승인 다이얼로그 열기
  const handleOpenApprovePrompt = (id: string) => {
    setSelectedCompanyId(id)
    setIsPromptOpen(true)
  }

  // 승인 확정 액션
  const handleConfirmApproval = () => {
    if (!selectedCompanyId) return

    setCompanies((prev) =>
      prev.map((c) =>
        c.id === selectedCompanyId ? { ...c, status: "approved" as const } : c
      )
    )
    setIsPromptOpen(false)
    setSelectedCompanyId(null)
  }

  return (
    <Container className="p-8">
      <div className="flex items-center gap-x-3 mb-2">
        <Buildings className="text-ui-fg-muted" />
        <Heading level="h1">B2B 기업 및 여신 한도 승인 관리</Heading>
      </div>
      <Text className="text-ui-fg-muted text-sm mb-6">
        07단계 Medusa Admin UI 확장을 통해 구축된 B2B 전용 백오피스 라우트입니다. 승인 대기 상태의 기업을 커스텀 Prompt 다이얼로그를 통해 안전하게 승인 처리할 수 있습니다.
      </Text>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>기업명</Table.HeaderCell>
            <Table.HeaderCell>사업자번호</Table.HeaderCell>
            <Table.HeaderCell>여신 한도</Table.HeaderCell>
            <Table.HeaderCell>상태</Table.HeaderCell>
            <Table.HeaderCell className="text-right">관리</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {companies.map((company) => (
            <Table.Row key={company.id}>
              <Table.Cell className="font-semibold text-ui-fg-base">{company.name}</Table.Cell>
              <Table.Cell>{company.business_number}</Table.Cell>
              <Table.Cell>{company.credit_limit.toLocaleString()}원</Table.Cell>
              <Table.Cell>
                <Badge color={company.status === "approved" ? "green" : "orange"} size="small">
                  {company.status === "approved" ? "승인 완료" : "승인 대기"}
                </Badge>
              </Table.Cell>
              <Table.Cell className="text-right">
                {company.status === "pending" && (
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => handleOpenApprovePrompt(company.id)}
                  >
                    기업 승인
                  </Button>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {/* 브라우저 기본 confirm을 대체하는 커스텀 확인 다이얼로그 (React 규칙 준수) */}
      <Prompt open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>B2B 기업 여신 승인 확인</Prompt.Title>
            <Prompt.Description>
              해당 기업의 B2B 거래 및 여신 한도를 승인하시겠습니까? 승인 즉시 플랫폼 내에서 외상 주문이 활성화됩니다.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel onClick={() => setIsPromptOpen(false)}>
              취소
            </Prompt.Cancel>
            <Prompt.Action onClick={handleConfirmApproval}>
              승인 확정
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

// 사이드바 메뉴 등록
export const config = defineRouteConfig({
  label: "B2B 기업 승인 관리",
  icon: Buildings,
})

export default B2BCompanyAdminPage

