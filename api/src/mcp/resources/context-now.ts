/**
 * context-now Resource Handler
 *
 * MCP Resource: zentropy://context/now
 * Coach 生成的全局狀態感知。
 */

import { GetContextNowUseCase } from '@/application/use-cases/mcp/get-context-now'

export async function readContextNow(userId: string) {
  const useCase = new GetContextNowUseCase()
  return useCase.execute({ userId })
}
