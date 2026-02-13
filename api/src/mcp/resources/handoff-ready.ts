/**
 * handoff-ready Resource Handler
 *
 * MCP Resource: zentropy://handoff/ready ★ 核心
 * 結構化意圖交接包。
 */

import { GetHandoffReadyUseCase } from '@/application/use-cases/mcp/get-handoff-ready'

export async function readHandoffReady(userId: string) {
  const useCase = new GetHandoffReadyUseCase()
  return useCase.execute({ userId })
}
