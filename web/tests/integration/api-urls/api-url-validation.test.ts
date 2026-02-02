/**
 * API URL 驗證測試
 *
 * 這些測試確保所有前端程式碼都正確使用 API_BASE_URL，
 * 避免發生相對路徑 fetch 呼叫（會導致請求發送到前端 host 而非 API server）。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// 需要檢查的目錄
const DIRS_TO_CHECK = [
  'app',
  'components',
]

// 排除的目錄或檔案模式
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  'tests',
  '__tests__',
  '.test.',
  '.spec.',
]

// 問題模式：相對路徑的 API 呼叫
const PROBLEMATIC_PATTERNS = [
  /fetch\s*\(\s*["'`]\/api\//g,  // fetch("/api/...) 或 fetch('/api/...) 或 fetch(`/api/...)
  /fetch\s*\(\s*`\/api\//g,      // fetch(`/api/...) without ${API_BASE_URL}
]

// 正確的模式：使用 API_BASE_URL
const CORRECT_PATTERNS = [
  /fetch\s*\(\s*`\$\{API_BASE_URL\}\/api\//,  // fetch(`${API_BASE_URL}/api/...)
  /apiUrl\s*\(\s*["'`]\/api\//,               // apiUrl("/api/...)
  /API\.\w+\.\w+/,                            // API.users.me(), API.areas.create(), etc.
]

function getAllTsxFiles(dir: string, files: string[] = []): string[] {
  try {
    const items = readdirSync(dir)

    for (const item of items) {
      const fullPath = join(dir, item)

      // 檢查是否應該排除
      if (EXCLUDE_PATTERNS.some(pattern => fullPath.includes(pattern))) {
        continue
      }

      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        getAllTsxFiles(fullPath, files)
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath)
      }
    }
  } catch {
    // 目錄不存在，忽略
  }

  return files
}

function findProblematicFetches(content: string, filePath: string): string[] {
  const issues: string[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    for (const pattern of PROBLEMATIC_PATTERNS) {
      if (pattern.test(line)) {
        // 確認這行沒有使用正確的模式
        const hasCorrectPattern = CORRECT_PATTERNS.some(correct => correct.test(line))

        if (!hasCorrectPattern) {
          issues.push(`${filePath}:${i + 1}: ${line.trim()}`)
        }
      }
    }
  }

  return issues
}

describe('API URL 配置驗證', () => {
  const projectRoot = join(__dirname, '../../../')

  it('所有 app/ 和 components/ 中的 fetch 呼叫應該使用 API_BASE_URL', () => {
    const allIssues: string[] = []

    for (const dir of DIRS_TO_CHECK) {
      const fullDir = join(projectRoot, dir)
      const files = getAllTsxFiles(fullDir)

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const issues = findProblematicFetches(content, file.replace(projectRoot, ''))
        allIssues.push(...issues)
      }
    }

    if (allIssues.length > 0) {
      const errorMessage = [
        '發現使用相對路徑的 API 呼叫：',
        '',
        ...allIssues,
        '',
        '修復方式：',
        '1. 添加 import { API_BASE_URL } from "@/lib/api-client"',
        '2. 將 fetch("/api/...") 改為 fetch(`${API_BASE_URL}/api/...`)',
        '   或使用 apiUrl("/api/...") helper',
        '   或使用 API 物件 (例如 API.users.me())',
      ].join('\n')

      expect.fail(errorMessage)
    }
  })

  it('API_BASE_URL 應該在 lib/api-client.ts 中正確導出', async () => {
    const apiClientPath = join(projectRoot, 'lib/api-client.ts')
    const content = readFileSync(apiClientPath, 'utf-8')

    expect(content).toContain('export const API_BASE_URL')
    expect(content).toContain("process.env.NEXT_PUBLIC_API_URL")
  })

  it('使用 fetch 的檔案應該有 API_BASE_URL import', () => {
    const filesWithFetch: { file: string; hasFetch: boolean; hasImport: boolean }[] = []

    for (const dir of DIRS_TO_CHECK) {
      const fullDir = join(projectRoot, dir)
      const files = getAllTsxFiles(fullDir)

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const relPath = file.replace(projectRoot, '')

        // 檢查是否有使用 fetch 呼叫 API
        const hasFetch = /fetch\s*\(\s*[`"'].*\/api\//.test(content) ||
                        /fetch\s*\(\s*apiUrl/.test(content)

        if (hasFetch) {
          // 檢查是否有正確的 import
          const hasImport = content.includes("from '@/lib/api-client'") ||
                           content.includes('from "@/lib/api-client"') ||
                           content.includes("from '../lib/api-client'") ||
                           content.includes('from "../lib/api-client"')

          // 如果使用 fetch 但沒有 import api-client，可能有問題
          if (!hasImport) {
            // 但如果使用的是 ${API_BASE_URL}，還是需要檢查 import
            const usesApiBaseUrl = content.includes('${API_BASE_URL}')
            if (usesApiBaseUrl) {
              filesWithFetch.push({ file: relPath, hasFetch, hasImport })
            }
          }
        }
      }
    }

    const missingImports = filesWithFetch.filter(f => !f.hasImport)

    if (missingImports.length > 0) {
      const errorMessage = [
        '以下檔案使用 API_BASE_URL 但缺少 import：',
        '',
        ...missingImports.map(f => `  - ${f.file}`),
        '',
        '請添加：import { API_BASE_URL } from "@/lib/api-client"',
      ].join('\n')

      expect.fail(errorMessage)
    }
  })
})
