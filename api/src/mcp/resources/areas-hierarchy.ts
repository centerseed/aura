/**
 * areas-hierarchy Resource Handler
 *
 * MCP Resource: zentropy://areas
 * 用戶的角色/資產/主題階層結構。
 */

import { GetAreasHierarchyUseCase } from '@/application/use-cases/mcp/get-areas-hierarchy'

export async function readAreasHierarchy(userId: string) {
  const useCase = new GetAreasHierarchyUseCase()
  return useCase.execute({ userId })
}
