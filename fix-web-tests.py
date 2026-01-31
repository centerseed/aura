#!/usr/bin/env python3
"""
批量修復 web/ 測試以符合新的 API 回應格式

新格式：
- 成功: {success: true, data: {...}, meta: {timestamp}}
- 失敗: {success: false, error: {code, message, details}, meta: {timestamp}}
"""

import re
import os
from pathlib import Path

def fix_test_file(file_path):
    """修復單個測試檔案"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. 成功回應: expect(data).toHaveProperty('xxx', value) -> expect(data.data).toHaveProperty('xxx', value)
    # 但要排除已經是 data.data 或 data.error 的情況
    content = re.sub(
        r"expect\(data\)\.toHaveProperty\('(\w+)',\s*([^)]+)\)",
        lambda m: f"expect(data.data).toHaveProperty('{m.group(1)}', {m.group(2)})"
                  if m.group(1) not in ['error', 'success', 'meta']
                  else m.group(0),
        content
    )

    # 2. 成功回應: expect(data.xxx).toBe() -> expect(data.data.xxx).toBe()
    # 但要排除 data.data, data.error, data.success, data.meta
    content = re.sub(
        r"expect\(data\.(\w+)\)",
        lambda m: f"expect(data.data.{m.group(1)})"
                  if m.group(1) not in ['data', 'error', 'success', 'meta']
                  else m.group(0),
        content
    )

    # 3. 錯誤回應: expect(data).toHaveProperty('error', 'xxx') -> expect(data.error.message).toBe('xxx')
    content = re.sub(
        r"expect\(data\)\.toHaveProperty\('error',\s*'([^']+)'\)",
        r"expect(data.error.message).toBe('\1')",
        content
    )

    # 4. 錯誤回應: expect(data.error).toContain('xxx') -> expect(data.error.message).toContain('xxx')
    content = re.sub(
        r"expect\(data\.error\)\.toContain\('([^']+)'\)",
        r"expect(data.error.message).toContain('\1')",
        content
    )

    # 5. 錯誤回應: expect(data.error).toBe('xxx') -> expect(data.error.message).toBe('xxx')
    content = re.sub(
        r"expect\(data\.error\)\.toBe\('([^']+)'\)",
        r"expect(data.error.message).toBe('\1')",
        content
    )

    # 6. 驗證錯誤: data.error.field -> data.error.details.field (如果有的話)
    content = re.sub(
        r"expect\(data\.error\.field\)",
        r"expect(data.error.details?.field)",
        content
    )

    # 7. 錯誤訊息: 'Unauthorized' -> 'Invalid or expired token'
    content = re.sub(
        r"\.toBe\('Unauthorized'\)",
        r".toBe('Invalid or expired token')",
        content
    )

    # 8. 錯誤: expect(data.error).toContain -> expect(data.error.message).toContain
    content = re.sub(
        r"expect\(data\.error\)\.toContain\(",
        r"expect(data.error.message).toContain(",
        content
    )

    # 9. 漏掉的屬性: data.areas, data.hasAreas 等 (檢查是否在 const data = 之後)
    # 這需要更智能的處理，先處理明確的case
    content = re.sub(
        r"expect\(data\)\.toHaveProperty\('(displayName|areas|hasAreas)'\)",
        r"expect(data.data).toHaveProperty('\1')",
        content
    )

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False

def main():
    print('🔧 開始批量修復測試檔案...\n')

    test_dir = Path('web/tests')
    test_files = list(test_dir.rglob('*.test.ts'))

    fixed_count = 0
    for file_path in test_files:
        if fix_test_file(file_path):
            print(f'✓ 修復: {file_path.relative_to("web/tests")}')
            fixed_count += 1

    print(f'\n✅ 完成！共修復 {fixed_count} 個測試檔案')
    print('\n請執行 cd web && npm test 驗證結果')

if __name__ == '__main__':
    main()
