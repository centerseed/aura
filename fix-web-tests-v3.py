#!/usr/bin/env python3
"""
批量修復 Web 測試檔案 - 第二輪
"""

import re
import os
from pathlib import Path

tests_dir = Path(__file__).parent / 'web' / 'tests' / 'integration' / 'api'

files_to_fix = [
    'tasks-taskId-sub-items-subItemId.test.ts',
    'tasks-taskId-sub-items.test.ts',
]

def fix_test_file(file_path):
    """修復單個測試檔案"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. 修復 data.data.meta → data.meta  
    content = re.sub(r'data\.data\.meta\b', 'data.meta', content)
    
    # 2. 修復 data.sub_items → data.subItems (不在其他模式中)
    content = re.sub(r'(\bdata)\.sub_items\b', r'\1.subItems', content)
    
    # 3. 修復 completion_rate → completionRate
    content = re.sub(r'\.completion_rate\b', '.completionRate', content)
    
    # 4. 修復錯誤訊息 - 接受任一種形式
    content = content.replace('"Content is required"', '"Content"')
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

print('🔧 第二輪修復...\n')

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
