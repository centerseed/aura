import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

interface AgentBaselineScenario {
  scenario: string
}

interface AgentBaselineReport {
  generatedAt: string
  model: string
  scenarioCount: number
  score: number
  fallbackCount: number
  obviousFailures: string[]
  scenarios: AgentBaselineScenario[]
}

interface GateConfig {
  version: number
  baselineScore: number
  minScore: number
  maxFallbackCount: number
  maxObviousFailures: number
}

const ROOT = process.cwd()
const REPORT_PATH = process.env.AGENT_BASELINE_REPORT_PATH
  ?? path.join(ROOT, "test-results", "agent-baseline-latest.json")
const GATE_CONFIG_PATH = path.join(ROOT, "tests", "integration", "agent-baseline-gate.json")

function runBaselineTest(): number {
  const args = ["vitest", "run", "tests/integration/agent-baseline.test.ts"]
  const child = spawnSync("npx", args, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      AGENT_BASELINE_REPORT_PATH: REPORT_PATH,
    },
  })
  return child.status ?? -1
}

function runLifecycleIdleFlushTest(): number {
  const args = ["vitest", "run", "tests/integration/agent-lifecycle-idle-flush.test.ts"]
  const child = spawnSync("npx", args, {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
    },
  })
  return child.status ?? -1
}

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`)
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
}

function evaluateGate(report: AgentBaselineReport, gate: GateConfig): string[] {
  const failures: string[] = []
  if (report.score < gate.minScore) {
    failures.push(`score ${report.score} < minScore ${gate.minScore}`)
  }
  if (report.score < gate.baselineScore) {
    failures.push(`score ${report.score} < baselineScore ${gate.baselineScore}`)
  }
  if (report.fallbackCount > gate.maxFallbackCount) {
    failures.push(`fallbackCount ${report.fallbackCount} > maxFallbackCount ${gate.maxFallbackCount}`)
  }
  if (report.obviousFailures.length > gate.maxObviousFailures) {
    failures.push(
      `obviousFailures ${report.obviousFailures.length} > maxObviousFailures ${gate.maxObviousFailures} (${report.obviousFailures.join(", ")})`
    )
  }
  return failures
}

function main(): void {
  const shouldUpdateBaseline = process.argv.includes("--update-baseline")

  const lifecycleExitCode = runLifecycleIdleFlushTest()
  const testExitCode = runBaselineTest()
  const report = readJsonFile<AgentBaselineReport>(REPORT_PATH)
  const gate = readJsonFile<GateConfig>(GATE_CONFIG_PATH)
  const failures = evaluateGate(report, gate)
  if (testExitCode !== 0) {
    failures.push(`baseline_test_failed_exit_code=${testExitCode}`)
  }
  if (lifecycleExitCode !== 0) {
    failures.push(`lifecycle_idle_flush_test_failed_exit_code=${lifecycleExitCode}`)
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("Agent Baseline Gate")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`generatedAt: ${report.generatedAt}`)
  console.log(`model:       ${report.model}`)
  console.log(`scenarios:   ${report.scenarioCount}`)
  console.log(`score:       ${report.score}`)
  console.log(`baseline:    ${gate.baselineScore}`)
  console.log(`minScore:    ${gate.minScore}`)
  console.log(`fallbacks:   ${report.fallbackCount}`)
  console.log(`obvious:     ${report.obviousFailures.length}`)
  console.log(`report:      ${REPORT_PATH}`)
  console.log(`lifecycle:   ${lifecycleExitCode}`)
  console.log(`testExit:    ${testExitCode}`)

  if (shouldUpdateBaseline) {
    const updated: GateConfig = {
      ...gate,
      baselineScore: report.score,
      minScore: report.score,
    }
    writeJsonFile(GATE_CONFIG_PATH, updated)
    console.log(`baseline updated -> ${report.score} (${GATE_CONFIG_PATH})`)
  }

  if (failures.length > 0) {
    console.error("\n❌ DEPLOY BLOCKED by Agent Baseline Gate:")
    for (const reason of failures) {
      console.error(`- ${reason}`)
    }
    process.exit(1)
  }

  console.log("\n✅ Agent baseline gate passed")
}

main()
