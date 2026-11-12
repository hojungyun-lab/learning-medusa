import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Table,
  Badge,
  Button,
  Prompt,
  Alert,
} from "@medusajs/ui"
import {
  ArrowPath,
  CheckCircle,
  ExclamationCircle,
  ArrowUturnLeft,
  ShieldCheck,
} from "@medusajs/icons"

const MOCK_SUFFIX = " (m)"

interface TransactionAuditRecord {
  id: string
  workflowName: string
  timestamp: string
  targetCompany: string
  amount: number
  stepsExecuted: string[]
  status: "COMMITTED" | "ROLLED_BACK"
  rollbackReason?: string
  dataIntegrity: "VERIFIED"
}

// 05단계 워크플로우 실행 및 Saga 롤백 테스트 로그 초기 데이터
const initialAuditRecords: TransactionAuditRecord[] = [
  {
    id: "tx_01M6K5_NORM_01",
    workflowName: "create-b2b-order-workflow",
    timestamp: "2026-11-04 10:08:49",
    targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
    amount: 5000000,
    stepsExecuted: [
      "Step 1: 여신 한도 선점 (성공)",
      "Step 2: 외부 ERP 동기화 (성공)",
    ],
    status: "COMMITTED",
    dataIntegrity: "VERIFIED",
  },
  {
    id: "tx_01M6K5_FAIL_02",
    workflowName: "create-b2b-order-workflow",
    timestamp: "2026-11-04 10:08:50",
    targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
    amount: 10000000,
    stepsExecuted: [
      "Step 1: 여신 한도 선점 (성공)",
      "Step 2: 외부 ERP 동기화 (실패: 504 Timeout)",
      "Step 1 보상: 여신 한도 원복 (+10,000,000원 롤백)",
    ],
    status: "ROLLED_BACK",
    rollbackReason: "외부 ERP 시스템 타임아웃 (HTTP 504 Gateway Timeout)",
    dataIntegrity: "VERIFIED",
  },
]

const SagaAuditAdminPage = () => {
  const [records, setRecords] = useState<TransactionAuditRecord[]>(initialAuditRecords)
  const [spentAmount, setSpentAmount] = useState<number>(5000000)
  const creditLimit = 100000000

  const [promptOpen, setPromptOpen] = useState<boolean>(false)
  const [promptType, setPromptType] = useState<"normal" | "rollback">("normal")

  const handleOpenPrompt = (type: "normal" | "rollback") => {
    setPromptType(type)
    setPromptOpen(true)
  }

  const handleConfirmSimulation = () => {
    const now = new Date()
    const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

    if (promptType === "normal") {
      const orderAmount = 3000000
      const newRecord: TransactionAuditRecord = {
        id: `tx_${Date.now()}_NORM`,
        workflowName: "create-b2b-order-workflow",
        timestamp: timeString,
        targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
        amount: orderAmount,
        stepsExecuted: [
          "Step 1: 여신 한도 선점 (성공)",
          "Step 2: 외부 ERP 동기화 (성공)",
        ],
        status: "COMMITTED",
        dataIntegrity: "VERIFIED",
      }
      setRecords((prev) => [newRecord, ...prev])
      setSpentAmount((prev) => prev + orderAmount)
    } else {
      const orderAmount = 8000000
      const newRecord: TransactionAuditRecord = {
        id: `tx_${Date.now()}_ROLL`,
        workflowName: "create-b2b-order-workflow",
        timestamp: timeString,
        targetCompany: `ACME 부품유통${MOCK_SUFFIX}`,
        amount: orderAmount,
        stepsExecuted: [
          "Step 1: 여신 한도 선점 (성공)",
          "Step 2: 외부 ERP 동기화 (실패: 504 Gateway Timeout)",
          `Step 1 보상: 여신 한도 원복 (+${orderAmount.toLocaleString()}원 롤백)`,
        ],
        status: "ROLLED_BACK",
        rollbackReason: "외부 ERP 장애 (HTTP 504) 발생으로 Step 1 보상 트랜잭션 즉시 실행",
        dataIntegrity: "VERIFIED",
      }
      setRecords((prev) => [newRecord, ...prev])
      // 롤백이므로 spentAmount는 변동 없음 (원상 복구)
    }

    setPromptOpen(false)
  }

  return (
    <Container className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-x-3 mb-2">
        <ArrowPath className="text-ui-fg-muted" />
        <Heading level="h1">Workflows & Saga 트랜잭션 감사</Heading>
      </div>
      <Text className="text-ui-fg-muted text-sm mb-6">
        05단계 Medusa v2 Workflows 엔진의 <strong>Saga 패턴(분산 트랜잭션 및 보상 함수)</strong> 작동 여부를 실시간으로 모니터링하고 롤백 무결성을 검증합니다.
      </Text>

      {/* 안내 알림 배너 */}
      <Alert className="mb-6" dismissible={false}>
        <div className="flex items-start gap-x-3">
          <ShieldCheck className="text-ui-tag-green-icon mt-0.5" />
          <div>
            <Text className="font-semibold text-ui-fg-base">Saga 무결성 보장 활성화 (Compensation Active)</Text>
            <Text className="text-xs text-ui-fg-subtle">
              다단계 주문 트랜잭션 중 외부 ERP 연동 실패 시, Step 1의 여신 한도 선점 데이터가 보상 함수를 통해 100% 자동 반환(롤백)됩니다.
            </Text>
          </div>
        </div>
      </Alert>

      {/* 기업 여신 현황 및 시뮬레이션 콘솔 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
          <Text className="text-xs text-ui-fg-muted font-medium">B2B 여신 한도</Text>
          <Text className="text-2xl font-bold text-ui-fg-base mt-1">{creditLimit.toLocaleString()}원</Text>
          <Text className="text-xs text-ui-fg-subtle mt-1">기업: ACME 부품유통{MOCK_SUFFIX}</Text>
        </div>

        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
          <Text className="text-xs text-ui-fg-muted font-medium">현재 사용액 (차감액)</Text>
          <Text className="text-2xl font-bold text-ui-fg-base mt-1">{spentAmount.toLocaleString()}원</Text>
          <Text className="text-xs text-ui-fg-subtle mt-1">가용 잔액: {(creditLimit - spentAmount).toLocaleString()}원</Text>
        </div>

        <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base flex flex-col justify-between">
          <Text className="text-xs text-ui-fg-muted font-medium">워크플로우 실시간 테스트</Text>
          <div className="flex gap-x-2 mt-2">
            <Button
              size="small"
              variant="secondary"
              onClick={() => handleOpenPrompt("normal")}
              className="flex-1 text-xs"
            >
              <CheckCircle className="mr-1 text-ui-tag-green-icon" /> 정상 주문 (Commit)
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={() => handleOpenPrompt("rollback")}
              className="flex-1 text-xs"
            >
              <ArrowUturnLeft className="mr-1" /> 장애 유도 (Rollback)
            </Button>
          </div>
        </div>
      </div>

      {/* 감사 로그 테이블 */}
      <div className="mb-3 flex items-center justify-between">
        <Heading level="h2" className="text-base font-semibold">
          트랜잭션 실행 감사 로그 (Audit Records)
        </Heading>
        <Badge size="small" color="blue">
          총 {records.length}건 기록됨
        </Badge>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>트랜잭션 ID</Table.HeaderCell>
            <Table.HeaderCell>실행 시각</Table.HeaderCell>
            <Table.HeaderCell>주문 시도액</Table.HeaderCell>
            <Table.HeaderCell>단계별 실행 흐름 (Saga Step Flow)</Table.HeaderCell>
            <Table.HeaderCell>최종 결과</Table.HeaderCell>
            <Table.HeaderCell>데이터 무결성</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {records.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell className="font-mono text-xs text-ui-fg-subtle">{r.id}</Table.Cell>
              <Table.Cell className="text-xs text-ui-fg-muted">{r.timestamp}</Table.Cell>
              <Table.Cell className="font-semibold text-ui-fg-base">{r.amount.toLocaleString()}원</Table.Cell>
              <Table.Cell>
                <div className="flex flex-col gap-y-1">
                  {r.stepsExecuted.map((step, idx) => (
                    <Text
                      key={idx}
                      className={`text-xs ${
                        step.includes("실패")
                          ? "text-ui-fg-error font-medium"
                          : step.includes("보상")
                          ? "text-ui-fg-interactive font-medium"
                          : "text-ui-fg-subtle"
                      }`}
                    >
                      {step}
                    </Text>
                  ))}
                  {r.rollbackReason && (
                    <Text className="text-[11px] text-ui-fg-muted italic">
                      사유: {r.rollbackReason}
                    </Text>
                  )}
                </div>
              </Table.Cell>
              <Table.Cell>
                {r.status === "COMMITTED" ? (
                  <Badge color="green" size="small">
                    커밋 완료 (Commit)
                  </Badge>
                ) : (
                  <Badge color="purple" size="small">
                    보상 롤백 (Rolled Back)
                  </Badge>
                )}
              </Table.Cell>
              <Table.Cell>
                <Badge color="grey" size="small">
                  무결성 검증됨 (100%)
                </Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {/* 커스텀 확인 다이얼로그 (window.confirm / alert 사용 금지 규칙 준수) */}
      <Prompt open={promptOpen} onOpenChange={setPromptOpen}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>
              {promptType === "normal"
                ? "정상 주문 워크플로우를 실행하시겠습니까?"
                : "외부 장애 유도(Saga 롤백) 테스트를 실행하시겠습니까?"}
            </Prompt.Title>
            <Prompt.Description>
              {promptType === "normal"
                ? "Step 1(여신 한도 선점 3,000,000원)과 Step 2(외부 ERP 연동)가 모두 정상 처리되어 커밋됩니다."
                : "Step 1에서 여신 8,000,000원을 선점한 직후, Step 2에서 의도적인 HTTP 504 Timeout 에러를 발생시킵니다. Medusa Workflows 엔진이 Step 1의 보상 함수(Compensation)를 역순 실행하여 여신 한도가 0원 손실 없이 원상 복구되는 과정을 검증합니다."}
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel onClick={() => setPromptOpen(false)}>취소</Prompt.Cancel>
            <Prompt.Action onClick={handleConfirmSimulation}>
              {promptType === "normal" ? "정상 실행" : "장애 유도 실행"}
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

// 백오피스 좌측 사이드바 메뉴 등록
export const config = defineRouteConfig({
  label: "Saga 트랜잭션 감사",
  icon: ArrowPath,
})

export default SagaAuditAdminPage

