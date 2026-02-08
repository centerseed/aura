/**
 * 驗證 Firebase Token 工具
 * 用於檢查 token 是否有效
 */

const token = process.argv[2]

if (!token) {
  console.error('❌ 請提供 token')
  console.log('\n用法：')
  console.log('  npx tsx scripts/verify-token.ts "你的token"\n')
  process.exit(1)
}

async function verifyToken() {
  console.log('🔍 驗證 Firebase Token...\n')
  console.log(`Token 長度: ${token.length} 字符`)
  console.log(`Token 前綴: ${token.substring(0, 20)}...`)
  console.log(`Token 後綴: ...${token.substring(token.length - 20)}\n`)

  try {
    // 嘗試解析 JWT token
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('❌ Token 格式不正確（應該是 JWT 格式）')
      process.exit(1)
    }

    // 解碼 payload
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    )

    console.log('📋 Token 資訊:')
    console.log(`  用戶 ID (sub): ${payload.sub}`)
    console.log(`  Email: ${payload.email || '未提供'}`)
    console.log(`  簽發時間 (iat): ${new Date(payload.iat * 1000).toLocaleString('zh-TW')}`)
    console.log(`  過期時間 (exp): ${new Date(payload.exp * 1000).toLocaleString('zh-TW')}`)
    console.log(`  簽發者 (iss): ${payload.iss}`)
    console.log(`  受眾 (aud): ${payload.aud}\n`)

    // 檢查是否過期
    const now = Math.floor(Date.now() / 1000)
    const expiresIn = payload.exp - now

    if (expiresIn <= 0) {
      console.error(`❌ Token 已過期！`)
      console.error(`   過期於: ${new Date(payload.exp * 1000).toLocaleString('zh-TW')}`)
      console.error(`   現在時間: ${new Date().toLocaleString('zh-TW')}`)
      console.error(`   已過期: ${Math.abs(expiresIn)} 秒\n`)
      process.exit(1)
    } else {
      console.log(`✅ Token 有效！`)
      console.log(`   剩餘時間: ${Math.floor(expiresIn / 60)} 分鐘 ${expiresIn % 60} 秒\n`)
    }

    // 測試 API 調用
    console.log('🧪 測試 API 調用...')
    const response = await fetch('https://zentropy.cc/api/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ API 調用成功！')
      console.log(`   用戶: ${data.name || data.email}`)
    } else {
      const error = await response.text()
      console.error('❌ API 調用失敗！')
      console.error(`   狀態碼: ${response.status}`)
      console.error(`   錯誤: ${error}`)
    }

  } catch (error: any) {
    console.error('❌ 驗證失敗:', error.message)
    process.exit(1)
  }
}

verifyToken()
