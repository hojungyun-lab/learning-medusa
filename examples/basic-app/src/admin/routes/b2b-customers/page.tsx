import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, Badge, Text } from "@medusajs/ui"
import { Users } from "@medusajs/icons"

const MOCK_SUFFIX = " (m)"

interface B2BCustomerRow {
  id: string
  fullName: string
  email: string
  phone: string
  companyName: string
  businessNumber: string
  creditLimit: number
  status: "approved" | "pending"
}

// 04단계 Module Link 및 Remote Query로 결합된 고객 및 B2B 기업 연동 데이터
const b2bCustomerLinks: B2BCustomerRow[] = [
  {
    id: "cus_01M6K3LINK001",
    fullName: "김철수",
    email: "buyer.daehan@acme.com",
    phone: "010-1111-2222",
    companyName: `(주)대한글로벌${MOCK_SUFFIX}`,
    businessNumber: "123-45-67890",
    creditLimit: 50000000,
    status: "pending",
  },
  {
    id: "cus_01M6K3LINK002",
    fullName: "박영희",
    email: "buyer.parts@acme.com",
    phone: "010-3333-4444",
    companyName: `ACME 부품유통${MOCK_SUFFIX}`,
    businessNumber: "987-65-43210",
    creditLimit: 100000000,
    status: "approved",
  },
]

const B2BCustomersAdminPage = () => {
  return (
    <Container className="p-8">
      <div className="flex items-center gap-x-3 mb-2">
        <Users className="text-ui-fg-muted" />
        <Heading level="h1">B2B 고객 및 기업 연동 관리</Heading>
      </div>
      <Text className="text-ui-fg-muted text-sm mb-6">
        04단계 <strong>Module Links (Customer ↔ Company)</strong>와 <strong>Remote Query</strong>를 통해 외래 키(FK) 없이 결합된 그래프 데이터의 백오피스 실시간 뷰입니다.
      </Text>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>고객명</Table.HeaderCell>
            <Table.HeaderCell>이메일</Table.HeaderCell>
            <Table.HeaderCell>연락처</Table.HeaderCell>
            <Table.HeaderCell>소속 B2B 기업</Table.HeaderCell>
            <Table.HeaderCell>사업자등록번호</Table.HeaderCell>
            <Table.HeaderCell>기업 여신 한도</Table.HeaderCell>
            <Table.HeaderCell>기업 승인 상태</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {b2bCustomerLinks.map((row) => (
            <Table.Row key={row.id}>
              <Table.Cell className="font-semibold text-ui-fg-base">{row.fullName}</Table.Cell>
              <Table.Cell className="text-ui-fg-subtle">{row.email}</Table.Cell>
              <Table.Cell>{row.phone}</Table.Cell>
              <Table.Cell className="font-medium text-ui-fg-base">{row.companyName}</Table.Cell>
              <Table.Cell>{row.businessNumber}</Table.Cell>
              <Table.Cell>{row.creditLimit.toLocaleString()}원</Table.Cell>
              <Table.Cell>
                <Badge color={row.status === "approved" ? "green" : "orange"} size="small">
                  {row.status === "approved" ? "승인 완료" : "승인 대기"}
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
  label: "B2B 고객 연동 현황",
  icon: Users,
})

export default B2BCustomersAdminPage

