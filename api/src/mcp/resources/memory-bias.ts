/**
 * memory-bias Resource Handler
 *
 * MCP Resource: zentropy://memory/bias
 * 個人估時偏差數據。
 */

import { GetMemoryBiasUseCase } from '@/application/use-cases/mcp/get-memory-bias'

export async function readMemoryBias(userId: string) {
  const useCase = new GetMemoryBiasUseCase()
  return useCase.execute({ userId })
}
