/**
 * PlannerSkill — 拆解大目標（stub，M6 實作）
 */

import { skill, makeSkillResult } from "naru-agent-js"

export const plannerSkill = skill({
  name: "planner",
  description: "拆解大目標為任務清單",
  triggers: ["規劃", "拆解", "計畫", "planner", "幫我規劃", "展開", "怎麼做", "怎麼拆"],
  priority: 6,
  run: async (_message, _context) =>
    makeSkillResult({
      promptInjection:
        "用戶想要規劃一個大目標。Planner 功能正在開發中（M6），" +
        "請用繁體中文友善地告知用戶此功能即將推出，" +
        "並建議他先用 brain_dump 把目標記下來，後續可以一起拆解。",
      skillName: "planner",
    }),
})
