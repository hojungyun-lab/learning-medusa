import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text } from "@medusajs/ui"
import { Buildings } from "@medusajs/icons"

const MOCK_SUFFIX = " (m)"

interface CompanyItem {
  id: string
  name: string
  business_number: string
  credit_limit: number
  spent_amount: number
  status: "pending" | "approved" | "suspended"
}

// 03단계 DML 모델링으로 생성된 ACME B2B 기업 데이터
const companiesData: CompanyItem[] = [
  {
    id: "comp_01M6J2GESZ3B5WX1F425CEKG5Y",
    name: `(주)대한글로벌${MOCK_SUFFIX}`,
    business_number: "123-45-67890",
    credit_limit: 50000000,
    spent_amount: 0,
    status: "pending",
  },
  {
    id: "comp_01M6J2GESZ9RVA8B6ZVDNVGMJ9",
    name: `ACME 부품유통${MOCK_SUFFIX}`,
    business_number: "987-65-43210",
    credit_limit: 100000000,
    spent_amount: 15400000,
    status: "approved",
  },
]

const CompaniesAdminPage = () => {
  return (
    <Container className="p-8">
      <div className="flex items-center gap-x-3 mb-2">
        <Buildings className="text-ui-fg-muted" />
        <Heading level="h1">ACME B2B 기업 카탈로그</Heading>
      </div>
      <Text className="text-ui-fg-muted text-sm mb-6">
        03단계 DML(Data Modeling Language)을 통해 구축된 Company 데이터 모델의 백오피스 실시간 뷰입니다.
      </Text>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>기업명</Table.HeaderCell>
            <Table.HeaderCell>사업자등록번호</Table.HeaderCell>
            <Table.HeaderCell>여신 한도</Table.HeaderCell>
            <Table.HeaderCell>현재 사용액</Table.HeaderCell>
            <Table.HeaderCell>승인 상태</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {companiesData.map((company) => (
            <Table.Row key={company.id}>
              <Table.Cell className="font-semibold text-ui-fg-base">{company.name}</Table.Cell>
              <Table.Cell>{company.business_number}</Table.Cell>
              <Table.Cell>{company.credit_limit.toLocaleString()}원</Table.Cell>
              <Table.Cell className="text-ui-fg-muted">{company.spent_amount.toLocaleString()}원</Table.Cell>
              <Table.Cell>
                <Badge color={company.status === "approved" ? "green" : "orange"} size="small">
                  {company.status === "approved" ? "승인 완료" : "승인 대기"}
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  )
}

// 백오피스 좌측 사이드바 메뉴 등록
export const config = defineRouteConfig({
  label: "B2B 기업 목록",
  icon: Buildings,
})

export default CompaniesAdminPage

