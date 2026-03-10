import type { ChatOptions } from "naru-agent-js"
import { AgentSessionLifecycleService } from "@/application/services/agent-session-lifecycle-service"

export interface AgentChatDelegate {
  chat(message: string, options?: ChatOptions): Promise<any>
}

export class LifecycleAwareAgent {
  constructor(
    private readonly delegate: AgentChatDelegate,
    private readonly lifecycleService: AgentSessionLifecycleService,
    private readonly defaultUserId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async chat(message: string, options: ChatOptions = {}): Promise<any> {
    const sessionId = options.sessionId ?? "default"
    const userId = options.userId ?? this.defaultUserId

    await this.lifecycleService.beforeMessage({
      sessionId,
      userId,
      now: this.now(),
    })

    const result = await this.delegate.chat(message, {
      ...options,
      sessionId,
      userId,
    })

    await this.lifecycleService.afterMessage({
      sessionId,
      now: this.now(),
    })

    return result
  }
}
