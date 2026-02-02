import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock 組件來測試 UI 顯示邏輯
function BrainDumpResultDisplay({
  processedItems,
  appendResult
}: {
  processedItems: any[],
  appendResult: any
}) {
  return (
    <div>
      {/* 創建新任務的顯示 */}
      {processedItems.length > 0 && (
        <div data-testid="create-new-tasks-result">
          <div>AI 已整理 {processedItems.length} 個項目</div>
          {processedItems.map((item, index) => (
            <div key={item.id || index} data-testid={`task-item-${index}`}>
              <h4>{item.title}</h4>
              <div>
                {item.tag.area} / {item.tag.product} / {item.tag.topic}
              </div>
              {/* 🔥 重點：顯示 reasoning */}
              {item.reasoning && (
                <div data-testid={`task-reasoning-${index}`}>
                  AI 思考：{item.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 追加 sub-item 的顯示 */}
      {appendResult && (
        <div data-testid="append-sub-item-result">
          <div>已追加 {appendResult.appended_sub_items.length} 個待辦事項</div>

          {/* 目標任務 */}
          <div data-testid="target-task">
            追加到任務：{appendResult.target_task.content}
          </div>

          {/* 新增的 sub-items */}
          {appendResult.appended_sub_items.map((subItem: any, index: number) => (
            <div key={subItem.id} data-testid={`sub-item-${index}`}>
              ☐ {subItem.content}
            </div>
          ))}

          {/* 🔥 重點：顯示 reasoning */}
          <div data-testid="append-reasoning">
            AI 思考：{appendResult.reasoning}
          </div>
        </div>
      )}
    </div>
  )
}

describe('Brain Dump UI - Reasoning 顯示測試', () => {
  it('應該顯示創建新任務時的 reasoning', () => {
    const mockProcessedItems = [
      {
        id: 'task-1',
        title: '準備週報',
        tag: {
          area: '工作',
          product: '專案 A',
          topic: '管理'
        },
        reasoning: 'AI 判斷這是工作相關的管理任務，需要定期完成'
      }
    ]

    render(
      <BrainDumpResultDisplay
        processedItems={mockProcessedItems}
        appendResult={null}
      />
    )

    // 驗證顯示了 reasoning
    const reasoning = screen.getByTestId('task-reasoning-0')
    expect(reasoning).toBeInTheDocument()
    expect(reasoning).toHaveTextContent('AI 思考：AI 判斷這是工作相關的管理任務，需要定期完成')
  })

  it('應該顯示追加 sub-item 時的 reasoning', () => {
    const mockAppendResult = {
      target_task: {
        id: 'task-123',
        content: '準備週報',
        product: '專案 A'
      },
      appended_sub_items: [
        {
          id: 'sub-1',
          content: '整理本週完成的功能',
          completed: false,
          created_at: '2026-02-01T10:00:00Z',
          completed_at: null,
          order: 0
        }
      ],
      reasoning: '用戶輸入是簡短的執行步驟，明確是既有任務「準備週報」的子項目'
    }

    render(
      <BrainDumpResultDisplay
        processedItems={[]}
        appendResult={mockAppendResult}
      />
    )

    // 驗證顯示了目標任務
    const targetTask = screen.getByTestId('target-task')
    expect(targetTask).toHaveTextContent('追加到任務：準備週報')

    // 驗證顯示了 sub-item
    const subItem = screen.getByTestId('sub-item-0')
    expect(subItem).toHaveTextContent('☐ 整理本週完成的功能')

    // 🔥 驗證顯示了 reasoning
    const reasoning = screen.getByTestId('append-reasoning')
    expect(reasoning).toBeInTheDocument()
    expect(reasoning).toHaveTextContent('AI 思考：用戶輸入是簡短的執行步驟')
  })

  it('當沒有 reasoning 時不應該顯示 reasoning 區塊', () => {
    const mockProcessedItems = [
      {
        id: 'task-1',
        title: '測試任務',
        tag: {
          area: '工作',
          product: '測試',
          topic: '測試'
        }
        // 沒有 reasoning
      }
    ]

    render(
      <BrainDumpResultDisplay
        processedItems={mockProcessedItems}
        appendResult={null}
      />
    )

    // 驗證不顯示 reasoning
    expect(screen.queryByTestId('task-reasoning-0')).not.toBeInTheDocument()
  })
})
