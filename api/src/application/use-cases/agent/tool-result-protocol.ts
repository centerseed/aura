export interface PresentedEntity {
  position: number
  title: string
  entityId?: string
  entityType?: string
  taskId?: string
  subTaskId?: string
  planItemId?: string
  start?: string
  end?: string
  description?: string
  eventLink?: string
  meetLink?: string
  attendees?: string[]
}

export interface ParsedToolResult {
  facts: Record<string, unknown> | null
  summary: string
}

export function serializeFactsSummary(
  facts: Record<string, unknown>,
  summary: string,
): string {
  return ["[FACTS]", JSON.stringify(facts, null, 2), "[/FACTS]", "", summary].join("\n")
}

export function parseToolResult(raw: string): ParsedToolResult {
  const startMarker = "[FACTS]"
  const endMarker = "[/FACTS]"
  const startIndex = raw.indexOf(startMarker)
  const endIndex = raw.indexOf(endMarker)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {
      facts: null,
      summary: raw.trim(),
    }
  }

  const jsonText = raw.slice(startIndex + startMarker.length, endIndex).trim()
  const summary = raw.slice(endIndex + endMarker.length).trim()

  try {
    return {
      facts: jsonText ? JSON.parse(jsonText) as Record<string, unknown> : null,
      summary,
    }
  } catch {
    return {
      facts: null,
      summary,
    }
  }
}

export function extractPresentedEntities(
  facts: Record<string, unknown> | null,
): PresentedEntity[] {
  if (!facts) return []
  const raw = facts.presentedEntities
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const entity = item as Record<string, unknown>
      const title = typeof entity.title === "string" ? entity.title.trim() : ""
      if (!title) return null

      return {
        position: typeof entity.position === "number" ? entity.position : index + 1,
        title,
        entityId: typeof entity.entityId === "string" ? entity.entityId : undefined,
        entityType: typeof entity.entityType === "string" ? entity.entityType : undefined,
        taskId: typeof entity.taskId === "string" ? entity.taskId : undefined,
        subTaskId: typeof entity.subTaskId === "string" ? entity.subTaskId : undefined,
        planItemId: typeof entity.planItemId === "string" ? entity.planItemId : undefined,
        start: typeof entity.start === "string" ? entity.start : undefined,
        end: typeof entity.end === "string" ? entity.end : undefined,
        description: typeof entity.description === "string" ? entity.description : undefined,
        eventLink: typeof entity.eventLink === "string" ? entity.eventLink : undefined,
        meetLink: typeof entity.meetLink === "string" ? entity.meetLink : undefined,
        attendees: Array.isArray(entity.attendees)
          ? entity.attendees.filter((item): item is string => typeof item === "string")
          : undefined,
      }
    })
    .filter((item) => item !== null)
}
