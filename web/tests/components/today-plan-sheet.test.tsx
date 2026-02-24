import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TodayPlanSheet } from '@/components/today-plan-sheet'

// Mock API
const mockGet = vi.fn()
const mockGenerate = vi.fn()
const mockUpdateItem = vi.fn()

vi.mock('@/lib/api-client', () => ({
  API: {
    coach: {
      plan: {
        get: (...args: any[]) => mockGet(...args),
        generate: (...args: any[]) => mockGenerate(...args),
        updateItem: (...args: any[]) => mockUpdateItem(...args),
      },
    },
  },
}))

// ============================================================================
// Test Data
// ============================================================================

const mockPlanItem = (overrides = {}) => ({
  id: 'item-1',
  plan_id: 'plan-1',
  task_id: 'task-1',
  sub_task_id: null,
  item_type: 'SUB_TASK',
  content: '完成首頁設計稿',
  area_name: '產品開發',
  product_name: 'Zentropy',
  estimated_minutes: 60,
  actual_minutes: null,
  due_date: '2026-02-14',
  order: 1,
  reasoning: null,
  completed: false,
  completed_at: null,
  pinned: false,
  deferred: false,
  status: 'today',
  user_adjusted: false,
  ...overrides,
})

const mockPlan = (overrides = {}) => ({
  id: 'plan-1',
  user_id: 'user-1',
  plan_date: '2026-02-14',
  coach_message: '今天專注在產品開發，加油！',
  capacity_note: '可用時間 6 小時',
  available_minutes: 360,
  meeting_minutes: 60,
  planned_minutes: 180,
  items: [
    mockPlanItem(),
    mockPlanItem({
      id: 'item-2',
      task_id: 'task-2',
      content: '修復登入 bug',
      area_name: '技術',
      order: 2,
      estimated_minutes: 30,
    }),
    mockPlanItem({
      id: 'item-3',
      task_id: 'task-3',
      content: '已完成的任務',
      order: 3,
      completed: true,
    }),
  ],
  created_at: '2026-02-14T08:00:00Z',
  updated_at: '2026-02-14T08:00:00Z',
  ...overrides,
})

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  completedTodayTasks: [],
  onCompleteTask: vi.fn(),
}

// ============================================================================
// Tests
// ============================================================================

describe('TodayPlanSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('載入行為', () => {
    it('open=false 時不渲染', () => {
      mockGet.mockResolvedValue({ plan: null })
      const { container } = render(
        <TodayPlanSheet {...defaultProps} open={false} />
      )
      expect(container.innerHTML).toBe('')
    })

    it('open 時自動載入計畫', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1)
      })
    })

    it('載入中顯示 spinner', () => {
      // Never resolve to keep loading state
      mockGet.mockReturnValue(new Promise(() => {}))
      render(<TodayPlanSheet {...defaultProps} />)

      // Loading spinner should be present (Loader2 is rendered as svg)
      const spinners = document.querySelectorAll('.animate-spin')
      expect(spinners.length).toBeGreaterThan(0)
    })
  })

  describe('無計畫狀態', () => {
    it('API 回傳 plan=null 時顯示「尚未生成」', async () => {
      mockGet.mockResolvedValue({ plan: null })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('尚未生成今日計畫')).toBeInTheDocument()
      })
    })

    it('API 錯誤時顯示「尚未生成」', async () => {
      mockGet.mockRejectedValue(new Error('Network error'))
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('尚未生成今日計畫')).toBeInTheDocument()
      })
    })

    it('顯示「生成今日計畫」按鈕', async () => {
      mockGet.mockResolvedValue({ plan: null })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('生成今日計畫')).toBeInTheDocument()
      })
    })
  })

  describe('生成計畫', () => {
    it('點擊生成按鈕呼叫 API 並傳遞 timezone', async () => {
      mockGet.mockResolvedValue({ plan: null })
      mockGenerate.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('生成今日計畫')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('生成今日計畫'))

      await waitFor(() => {
        expect(mockGenerate).toHaveBeenCalledWith({
          timezone: expect.any(String),
        })
      })
    })

    it('生成成功後顯示計畫內容', async () => {
      mockGet.mockResolvedValue({ plan: null })
      mockGenerate.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('生成今日計畫')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('生成今日計畫'))

      await waitFor(() => {
        expect(screen.getByText('完成首頁設計稿')).toBeInTheDocument()
      })
    })
  })

  describe('計畫顯示', () => {
    it('顯示 coach_message', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/今天專注在產品開發/)).toBeInTheDocument()
      })
    })

    it('顯示 capacity_note', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('可用時間 6 小時')).toBeInTheDocument()
      })
    })

    it('待完成項目顯示 content 和 product_name', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      const { container } = render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        const html = container.innerHTML
        expect(html).toContain('完成首頁設計稿')
        expect(html).toContain('修復登入 bug')
        expect(html).toContain('[Zentropy]')
      })
    })

    it('顯示預估時間', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('60m')).toBeInTheDocument()
        expect(screen.getByText('30m')).toBeInTheDocument()
      })
    })

    it('已完成項目顯示在已完成區塊', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('已完成的任務')).toBeInTheDocument()
      })
    })

    it('待完成項目按 order 排序', async () => {
      const plan = mockPlan({
        items: [
          mockPlanItem({ id: 'b', content: '第二個', order: 2, completed: false }),
          mockPlanItem({ id: 'a', content: '第一個', order: 1, completed: false }),
        ],
      })
      mockGet.mockResolvedValue({ plan })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        const items = screen.getAllByText(/第[一二]個/)
        expect(items[0].textContent).toContain('第一個')
        expect(items[1].textContent).toContain('第二個')
      })
    })

    it('所有任務已完成時顯示提示', async () => {
      const plan = mockPlan({
        items: [mockPlanItem({ completed: true })],
      })
      mockGet.mockResolvedValue({ plan })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('所有任務已完成！')).toBeInTheDocument()
      })
    })
  })

  describe('完成任務', () => {
    it('完成項目後呼叫 API 和 onCompleteTask', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      mockUpdateItem.mockResolvedValue({})
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('完成首頁設計稿')).toBeInTheDocument()
      })

      // Click the circle button (first uncompleted item)
      const circleButtons = document.querySelectorAll('button.mt-0\\.5')
      fireEvent.click(circleButtons[0])

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { completed: true })
        expect(defaultProps.onCompleteTask).toHaveBeenCalledWith('task-1')
      })
    })
  })

  describe('關閉行為', () => {
    it('點擊 backdrop 觸發 onClose', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop!)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('點擊 X 按鈕觸發 onClose', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      // X button is in the header
      const closeButton = document.querySelector('.p-1.rounded-lg')
      fireEvent.click(closeButton!)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('點擊開啟任務', () => {
    it('點擊 plan item 文字觸發 onOpenTask', async () => {
      mockGet.mockResolvedValue({ plan: mockPlan() })
      const onOpenTask = vi.fn()
      render(<TodayPlanSheet {...defaultProps} onOpenTask={onOpenTask} />)

      await waitFor(() => {
        expect(screen.getByText('完成首頁設計稿')).toBeInTheDocument()
      })

      // Click the text button (not the checkbox)
      fireEvent.click(screen.getByText('完成首頁設計稿'))

      expect(onOpenTask).toHaveBeenCalledWith('task-1', null)
    })

    it('點擊 plan item 傳遞 sub_task_id', async () => {
      const plan = mockPlan({
        items: [mockPlanItem({ sub_task_id: 'sub-1' })],
      })
      mockGet.mockResolvedValue({ plan })
      const onOpenTask = vi.fn()
      render(<TodayPlanSheet {...defaultProps} onOpenTask={onOpenTask} />)

      await waitFor(() => {
        expect(screen.getByText('完成首頁設計稿')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('完成首頁設計稿'))

      expect(onOpenTask).toHaveBeenCalledWith('task-1', 'sub-1')
    })
  })

  describe('回歸測試：API 回應格式', () => {
    it('正確處理 handleResponse 解包後的格式（res.plan 而非 res.data）', async () => {
      // handleResponse 已經解包 { success, data } → data
      // 所以 API.coach.plan.get() 回傳的是 { plan: {...} }，不是 { success: true, data: { plan: {...} } }
      mockGet.mockResolvedValue({ plan: mockPlan() })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        // 如果格式處理錯誤，這裡會顯示「尚未生成今日計畫」而非計畫內容
        expect(screen.queryByText('尚未生成今日計畫')).not.toBeInTheDocument()
        expect(screen.getByText('完成首頁設計稿')).toBeInTheDocument()
      })
    })

    it('使用 content 而非 title 顯示項目名稱', async () => {
      const plan = mockPlan({
        items: [mockPlanItem({ content: '這是 content 欄位' })],
      })
      mockGet.mockResolvedValue({ plan })
      render(<TodayPlanSheet {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('這是 content 欄位')).toBeInTheDocument()
      })
    })
  })
})
