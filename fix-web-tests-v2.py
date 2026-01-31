#!/usr/bin/env python3
"""
批量修復 Web 測試檔案的 API 回應格式問題

修復內容：
1. data.data.xxx → data.xxx
2. snake_case → camelCase
3. 錯誤訊息格式
"""

import re
import os
from pathlib import Path

# 測試目錄
tests_dir = Path(__file__).parent / 'web' / 'tests' / 'integration' / 'api'

# 需要修復的檔案
files_to_fix = [
    'tasks-taskId-sub-items-subItemId.test.ts',
    'tasks-taskId-sub-items.test.ts',
]

def fix_test_file(file_path):
    """修復單個測試檔案"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. 修復 data.data.sub_item → data.subItem
    content = re.sub(r'data\.data\.sub_item\b', 'data.subItem', content)
    
    # 2. 修復 data.data.sub_items → data.subItems  
    content = re.sub(r'data\.data\.sub_items\b', 'data.subItems', content)
    
    # 3. 修復 data.sub_items_meta → data.meta
    content = re.sub(r'data\.sub_items_meta\b', 'data.meta', content)
    
    # 4. 修復 data.data.sub_items_meta → data.meta
    content = re.sub(r'data\.data\.sub_items_meta\b', 'data.meta', content)
    
    # 5. 修復 data.sub_item (不在 data.data 或 data.sub_items_meta 中)
    content = re.sub(r'(?<!\.data)\.sub_item\b', '.subItem', content)
    
    # 6. 修復錯誤訊息的引號期望
    content = content.replace("'content' is required and cannot be empty", "Content is required")
    content = content.replace("'content' cannot be empty", "Content cannot be empty")
    content = content.replace("Either 'completed' or 'content' field", "Either completed or content field")
    content = content.replace("'completed' must be boolean", "boolean")
    content = content.replace("'content' must be string", "string")
    content = content.replace("'sub_item_ids' must be an array", "sub_item_ids must be an array")
    
    # 7. 修復 deleted_sub_item_id → deletedSubItemId
    content = re.sub(r'deleted_sub_item_id', 'deletedSubItemId', content)
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

print('🔧 開始批量修復測試檔案...\n')

fixed_count = 0
for filename in files_to_fix:
    file_path = tests_dir / filename
    if not file_path.exists():
        print(f'⚠️  檔案不存在: {filename}')
        continue
    
    print(f'修復: {filename}')
    if fix_test_file(file_path):
        fixed_count += 1
        print(f'  ✅ 已修復')
    else:
        print(f'  - 無需修改')

print(f'\n✅ 完成! 共修復 {fixed_count}/{len(files_to_fix)} 個檔案')
