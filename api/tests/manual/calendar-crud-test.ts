/**
 * Calendar API CRUD 測試腳本
 *
 * 用法：
 * 1. 在瀏覽器登入 https://zentropy.cc/test-calendar
 * 2. 點擊「📋 複製完整 Token」按鈕
 * 3. 執行測試（三種方式擇一）：
 *
 *    方式 1 - 命令行參數（最簡單）：
 *    npm run test:calendar-crud -- --token="你的token"
 *
 *    方式 2 - 環境變數：
 *    export FIREBASE_TOKEN="你的token"
 *    npm run test:calendar-crud
 *
 *    方式 3 - .env.test.local 檔案（可重複使用）：
 *    echo 'FIREBASE_TOKEN="你的token"' > .env.test.local
 *    npm run test:calendar-crud
 */

// 載入 .env.test.local（如果存在）
import * as fs from 'fs'
import * as path from 'path'

const envTestLocalPath = path.join(__dirname, '../../.env.test.local')
if (fs.existsSync(envTestLocalPath)) {
  const envContent = fs.readFileSync(envTestLocalPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const API_BASE_URL = process.env.API_BASE_URL || 'https://zentropy.cc/api'

// 支援三種方式提供 token：
// 1. 環境變數
// 2. 命令行參數（npm run test:calendar-crud -- --token="your-token"）
// 3. .env.test.local 檔案
let FIREBASE_TOKEN = process.env.FIREBASE_TOKEN

// 檢查命令行參數
const tokenArg = process.argv.find(arg => arg.startsWith('--token='))
if (tokenArg) {
  FIREBASE_TOKEN = tokenArg.split('=')[1].replace(/^["']|["']$/g, '')
}

if (!FIREBASE_TOKEN) {
  console.error('❌ 錯誤：請提供 FIREBASE_TOKEN')
  console.log('\n獲取 token 的方式：')
  console.log('1. 在瀏覽器登入 https://zentropy.cc/test-calendar')
  console.log('2. 點擊「📋 複製完整 Token」按鈕')
  console.log('\n使用方式（擇一）：')
  console.log('方式 1 - 環境變數：')
  console.log('  export FIREBASE_TOKEN="你複製的token"')
  console.log('  npm run test:calendar-crud')
  console.log('\n方式 2 - 命令行參數（推薦）：')
  console.log('  npm run test:calendar-crud -- --token="你複製的token"')
  console.log('\n方式 3 - 創建 .env.test.local 檔案：')
  console.log('  echo \'FIREBASE_TOKEN="你的token"\' > .env.test.local')
  console.log('  npm run test:calendar-crud\n')
  process.exit(1)
}

// ANSI 顏色碼
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color: keyof typeof colors, ...args: any[]) {
  console.log(colors[color], ...args, colors.reset)
}

// 測試結果統計
let totalTests = 0
let passedTests = 0
let failedTests = 0

async function test(name: string, fn: () => Promise<void>) {
  totalTests++
  try {
    await fn()
    passedTests++
    log('green', `✅ ${name}`)
  } catch (error: any) {
    failedTests++
    log('red', `❌ ${name}`)
    log('red', `   錯誤：${error.message}`)
  }
}

// ============================================================================
// 測試工具函數
// ============================================================================

async function apiCall(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: any
) {
  const url = `${API_BASE_URL}${endpoint}`

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${FIREBASE_TOKEN}`,
      'Content-Type': 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`API Error: ${JSON.stringify(errorData)}`)
  }

  return response.json()
}

// ============================================================================
// CRUD 測試
// ============================================================================

// 儲存創建的事件 ID（用於測試結束後清理）
const createdEventIds: string[] = []

/**
 * CREATE - 創建會議
 */
async function testCreateEvent() {
  log('blue', '\n📝 測試 CREATE - 創建會議')

  // 測試 1: 創建基本會議
  await test('創建基本會議（無 Meet 連結）', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)

    const endTime = new Date(tomorrow)
    endTime.setHours(11, 0, 0, 0)

    const result = await apiCall('/calendar/create-event', 'POST', {
      summary: '[測試] 基本會議',
      description: 'CRUD 測試腳本創建的測試會議',
      startDateTime: tomorrow.toISOString(),
      endDateTime: endTime.toISOString(),
      generateMeetLink: false,
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (!result.data.eventId) {
      throw new Error('未返回 eventId')
    }

    createdEventIds.push(result.data.eventId)
    log('cyan', `   Event ID: ${result.data.eventId}`)
  })

  // 測試 2: 創建帶 Google Meet 的會議
  await test('創建會議（自動生成 Google Meet）', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(14, 0, 0, 0)

    const endTime = new Date(tomorrow)
    endTime.setHours(15, 0, 0, 0)

    const result = await apiCall('/calendar/create-event', 'POST', {
      summary: '[測試] Meet 會議',
      description: '測試 Google Meet 連結生成',
      startDateTime: tomorrow.toISOString(),
      endDateTime: endTime.toISOString(),
      generateMeetLink: true,
    })

    if (!result.data.meetLink) {
      throw new Error('未返回 Google Meet 連結')
    }

    if (!result.data.meetLink.includes('meet.google.com')) {
      throw new Error('Meet 連結格式不正確')
    }

    createdEventIds.push(result.data.eventId)
    log('cyan', `   Meet 連結: ${result.data.meetLink}`)
  })

  // 測試 3: 創建帶參與者的會議
  await test('創建會議（包含參與者）', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(16, 0, 0, 0)

    const endTime = new Date(tomorrow)
    endTime.setHours(17, 0, 0, 0)

    const result = await apiCall('/calendar/create-event', 'POST', {
      summary: '[測試] 團隊會議',
      description: '測試參與者邀請功能',
      startDateTime: tomorrow.toISOString(),
      endDateTime: endTime.toISOString(),
      attendees: ['test@example.com'],
      generateMeetLink: true,
    })

    createdEventIds.push(result.data.eventId)
    log('cyan', `   Event 連結: ${result.data.eventLink}`)
  })

  // 測試 4: 驗證必填欄位
  await test('驗證缺少必填欄位時回傳錯誤', async () => {
    try {
      await apiCall('/calendar/create-event', 'POST', {
        // 缺少 summary
        startDateTime: new Date().toISOString(),
        endDateTime: new Date().toISOString(),
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('summary')) {
        throw new Error('錯誤訊息應該提到 summary')
      }
    }
  })

  // 測試 5: 驗證時間邏輯
  await test('驗證結束時間必須晚於開始時間', async () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 3600000) // 1 小時前

    try {
      await apiCall('/calendar/create-event', 'POST', {
        summary: '無效會議',
        startDateTime: now.toISOString(),
        endDateTime: earlier.toISOString(), // 結束時間早於開始時間
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.toLowerCase().includes('after')) {
        throw new Error('錯誤訊息應該提到時間順序問題')
      }
    }
  })
}

/**
 * READ - 查詢空檔
 */
async function testReadFreeBusy() {
  log('blue', '\n📖 測試 READ - 查詢空檔')

  // 測試 1: 查詢本週空檔
  await test('查詢本週空檔', async () => {
    const now = new Date()
    const timeMin = new Date(now)
    timeMin.setHours(0, 0, 0, 0)

    const timeMax = new Date(now)
    timeMax.setDate(timeMax.getDate() + 7)
    timeMax.setHours(23, 59, 59, 999)

    const result = await apiCall('/calendar/free-busy', 'POST', {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      workingHours: { start: 9, end: 18 },
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (!Array.isArray(result.data.availableSlots)) {
      throw new Error('availableSlots 應該是陣列')
    }

    if (!Array.isArray(result.data.busySlots)) {
      throw new Error('busySlots 應該是陣列')
    }

    log('cyan', `   找到 ${result.data.availableSlots.length} 個可用時段`)
    log('cyan', `   找到 ${result.data.busySlots.length} 個已佔用時段`)

    // 顯示前 3 個可用時段
    if (result.data.availableSlots.length > 0) {
      log('cyan', '   前 3 個可用時段：')
      result.data.availableSlots.slice(0, 3).forEach((slot: any) => {
        const start = new Date(slot.start)
        const end = new Date(slot.end)
        log('cyan', `     - ${start.toLocaleString('zh-TW')} ~ ${end.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} (${slot.durationMinutes} 分鐘)`)
      })
    }
  })

  // 測試 2: 查詢明天的空檔
  await test('查詢明天的空檔', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const dayEnd = new Date(tomorrow)
    dayEnd.setHours(23, 59, 59, 999)

    const result = await apiCall('/calendar/free-busy', 'POST', {
      timeMin: tomorrow.toISOString(),
      timeMax: dayEnd.toISOString(),
    })

    log('cyan', `   明天有 ${result.data.availableSlots.length} 個可用時段`)
  })

  // 測試 3: 自訂工作時間
  await test('自訂工作時間（8:00-20:00）', async () => {
    const now = new Date()
    const timeMin = new Date(now)
    timeMin.setHours(0, 0, 0, 0)

    const timeMax = new Date(now)
    timeMax.setDate(timeMax.getDate() + 1)

    const result = await apiCall('/calendar/free-busy', 'POST', {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      workingHours: { start: 8, end: 20 },
    })

    // 驗證時段是否在工作時間內
    if (result.data.availableSlots.length > 0) {
      const firstSlot = result.data.availableSlots[0]
      const startHour = new Date(firstSlot.start).getHours()

      if (startHour < 8 || startHour >= 20) {
        throw new Error('時段超出工作時間範圍')
      }
    }
  })

  // 測試 4: 驗證必填欄位
  await test('驗證缺少必填欄位時回傳錯誤', async () => {
    try {
      await apiCall('/calendar/free-busy', 'POST', {
        // 缺少 timeMin 和 timeMax
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('timeMin')) {
        throw new Error('錯誤訊息應該提到 timeMin')
      }
    }
  })
}

/**
 * UPDATE - 更新會議
 */
async function testUpdateEvent() {
  log('blue', '\n✏️  測試 UPDATE - 更新會議')

  if (createdEventIds.length === 0) {
    log('yellow', '   ⚠️  沒有可更新的事件')
    return
  }

  // 測試 1: 更新會議標題
  await test('更新會議標題', async () => {
    const eventId = createdEventIds[0]

    const result = await apiCall('/calendar/update-event', 'PUT', {
      eventId,
      summary: '[測試] 已更新的會議標題',
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (result.data.summary !== '[測試] 已更新的會議標題') {
      throw new Error('會議標題未成功更新')
    }

    log('cyan', `   已更新標題: ${result.data.summary}`)
  })

  // 測試 2: 更新會議時間
  await test('更新會議時間', async () => {
    const eventId = createdEventIds[0]

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(15, 0, 0, 0)  // 改為 15:00

    const endTime = new Date(tomorrow)
    endTime.setHours(16, 0, 0, 0)  // 改為 16:00

    const result = await apiCall('/calendar/update-event', 'PUT', {
      eventId,
      startDateTime: tomorrow.toISOString(),
      endDateTime: endTime.toISOString(),
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    log('cyan', `   已更新時間: ${new Date(result.data.startDateTime).toLocaleString('zh-TW')}`)
  })

  // 測試 3: 更新參與者
  await test('更新參與者列表', async () => {
    const eventId = createdEventIds[0]

    const result = await apiCall('/calendar/update-event', 'PUT', {
      eventId,
      attendees: ['updated@example.com', 'another@example.com'],
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    log('cyan', `   已更新參與者`)
  })

  // 測試 4: 驗證必填欄位
  await test('驗證缺少 eventId 時回傳錯誤', async () => {
    try {
      await apiCall('/calendar/update-event', 'PUT', {
        summary: '測試',
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('eventId')) {
        throw new Error('錯誤訊息應該提到 eventId')
      }
    }
  })

  // 測試 5: 驗證至少提供一個要更新的欄位
  await test('驗證至少提供一個更新欄位', async () => {
    try {
      await apiCall('/calendar/update-event', 'PUT', {
        eventId: createdEventIds[0],
        // 沒有提供任何要更新的欄位
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('required')) {
        throw new Error('錯誤訊息應該提到需要更新的欄位')
      }
    }
  })

  // 測試 6: 驗證時間邏輯
  await test('驗證結束時間必須晚於開始時間', async () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 3600000) // 1 小時前

    try {
      await apiCall('/calendar/update-event', 'PUT', {
        eventId: createdEventIds[0],
        startDateTime: now.toISOString(),
        endDateTime: earlier.toISOString(),
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.toLowerCase().includes('after')) {
        throw new Error('錯誤訊息應該提到時間順序問題')
      }
    }
  })
}

/**
 * DELETE - 刪除會議
 */
async function testDeleteEvent() {
  log('blue', '\n🗑️  測試 DELETE - 刪除會議')

  if (createdEventIds.length === 0) {
    log('yellow', '   ⚠️  沒有需要刪除的事件')
    return
  }

  // 測試 1: 刪除第一個創建的事件
  await test('刪除測試事件', async () => {
    const eventId = createdEventIds[0]

    const result = await apiCall(
      `/calendar/delete-event?eventId=${eventId}`,
      'DELETE'
    )

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (!result.data.deleted) {
      throw new Error('事件未成功刪除')
    }

    log('cyan', `   已刪除事件: ${eventId}`)
  })

  // 測試 2: 驗證刪除不存在的事件
  await test('驗證刪除不存在的事件時回傳錯誤', async () => {
    try {
      await apiCall(
        '/calendar/delete-event?eventId=nonexistent-event-id',
        'DELETE'
      )
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      // 預期會失敗
      if (!error.message.includes('API Error')) {
        throw new Error('錯誤格式不正確')
      }
    }
  })

  // 測試 3: 驗證缺少 eventId 參數
  await test('驗證缺少 eventId 參數時回傳錯誤', async () => {
    try {
      await apiCall('/calendar/delete-event', 'DELETE')
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('eventId')) {
        throw new Error('錯誤訊息應該提到 eventId')
      }
    }
  })
}

/**
 * REMINDER - 提醒 CRUD
 */
const createdReminderIds: string[] = []

async function testReminders() {
  log('blue', '\n🔔 測試 REMINDER - 提醒 CRUD')

  // 測試 1: 創建 Calendar Reminder
  await test('創建 Calendar 提醒', async () => {
    const remindAt = new Date()
    remindAt.setDate(remindAt.getDate() + 2)
    remindAt.setHours(8, 0, 0, 0)

    const result = await apiCall('/reminders', 'POST', {
      remindAt: remindAt.toISOString(),
      message: '[測試] Calendar 提醒測試',
      reminderType: 'CALENDAR_REMINDER',
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (!result.data.id) {
      throw new Error('未返回 reminder id')
    }

    if (!result.data.calendarRemindEventId) {
      throw new Error('未返回 calendarRemindEventId')
    }

    createdReminderIds.push(result.data.id)
    log('cyan', `   Reminder ID: ${result.data.id}`)
    log('cyan', `   Calendar Event ID: ${result.data.calendarRemindEventId}`)
  })

  // 測試 2: 創建 Local Notification Reminder
  await test('創建 Local Notification 提醒', async () => {
    const remindAt = new Date()
    remindAt.setDate(remindAt.getDate() + 2)
    remindAt.setHours(20, 0, 0, 0)

    const result = await apiCall('/reminders', 'POST', {
      remindAt: remindAt.toISOString(),
      message: '[測試] 本地通知提醒測試',
      reminderType: 'LOCAL_NOTIFICATION',
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    // LOCAL_NOTIFICATION 不應該有 calendarRemindEventId
    if (result.data.calendarRemindEventId) {
      throw new Error('LOCAL_NOTIFICATION 不應該有 calendarRemindEventId')
    }

    createdReminderIds.push(result.data.id)
    log('cyan', `   Reminder ID: ${result.data.id}`)
  })

  // 測試 3: 查詢提醒列表
  await test('查詢提醒列表', async () => {
    const result = await apiCall('/reminders', 'GET')

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (!Array.isArray(result.data)) {
      throw new Error('data 應該是陣列')
    }

    log('cyan', `   找到 ${result.data.length} 個提醒`)
  })

  // 測試 4: 查詢單一提醒
  await test('查詢單一提醒', async () => {
    if (createdReminderIds.length === 0) throw new Error('沒有可查詢的提醒')

    const result = await apiCall(`/reminders/${createdReminderIds[0]}`, 'GET')

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (result.data.id !== createdReminderIds[0]) {
      throw new Error('返回的 ID 不匹配')
    }

    log('cyan', `   提醒時間: ${new Date(result.data.remindAt).toLocaleString('zh-TW')}`)
    log('cyan', `   訊息: ${result.data.message}`)
  })

  // 測試 5: 更新提醒時間
  await test('更新提醒時間', async () => {
    if (createdReminderIds.length === 0) throw new Error('沒有可更新的提醒')

    const newRemindAt = new Date()
    newRemindAt.setDate(newRemindAt.getDate() + 3)
    newRemindAt.setHours(9, 0, 0, 0)

    const result = await apiCall(`/reminders/${createdReminderIds[0]}`, 'PUT', {
      remindAt: newRemindAt.toISOString(),
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    log('cyan', `   新提醒時間: ${new Date(result.data.remindAt).toLocaleString('zh-TW')}`)
  })

  // 測試 6: 更新提醒訊息
  await test('更新提醒訊息', async () => {
    if (createdReminderIds.length === 0) throw new Error('沒有可更新的提醒')

    const result = await apiCall(`/reminders/${createdReminderIds[1]}`, 'PUT', {
      message: '[測試] 已更新的提醒訊息',
    })

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (result.data.message !== '[測試] 已更新的提醒訊息') {
      throw new Error('訊息未成功更新')
    }
  })

  // 測試 7: 刪除提醒
  await test('刪除提醒', async () => {
    if (createdReminderIds.length === 0) throw new Error('沒有可刪除的提醒')

    const result = await apiCall(`/reminders/${createdReminderIds[0]}`, 'DELETE')

    if (!result.success) {
      throw new Error('API 回傳 success: false')
    }

    if (!result.data.deleted) {
      throw new Error('提醒未成功刪除')
    }

    log('cyan', `   已刪除提醒: ${createdReminderIds[0]}`)
  })

  // 測試 8: 驗證不存在的提醒
  await test('查詢不存在的提醒返回 404', async () => {
    try {
      await apiCall('/reminders/00000000-0000-0000-0000-000000000000', 'GET')
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('not found') && !error.message.includes('API Error')) {
        throw new Error('錯誤格式不正確')
      }
    }
  })

  // 測試 9: 驗證必填欄位
  await test('驗證缺少必填欄位時回傳錯誤', async () => {
    try {
      await apiCall('/reminders', 'POST', {
        message: '缺少 remindAt 和 reminderType',
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('remindAt')) {
        throw new Error('錯誤訊息應該提到 remindAt')
      }
    }
  })

  // 測試 10: 驗證無效 reminderType
  await test('驗證無效 reminderType 時回傳錯誤', async () => {
    try {
      await apiCall('/reminders', 'POST', {
        remindAt: new Date().toISOString(),
        reminderType: 'INVALID_TYPE',
      })
      throw new Error('應該要回傳錯誤，但成功了')
    } catch (error: any) {
      if (!error.message.includes('reminderType')) {
        throw new Error('錯誤訊息應該提到 reminderType')
      }
    }
  })
}

// ============================================================================
// 清理函數
// ============================================================================

async function cleanup() {
  if (createdEventIds.length === 0 && createdReminderIds.length === 0) {
    return
  }

  log('blue', '\n🧹 清理測試資料')

  // 清理提醒（先清理提醒，因為刪除提醒會同時刪除 Calendar 事件）
  for (const reminderId of createdReminderIds) {
    try {
      await apiCall(`/reminders/${reminderId}`, 'DELETE')
      log('green', `   ✅ 已刪除提醒: ${reminderId}`)
    } catch (error: any) {
      log('yellow', `   ⚠️  刪除提醒失敗: ${reminderId} - ${error.message}`)
    }
  }

  // 清理事件
  for (const eventId of createdEventIds) {
    try {
      await apiCall(`/calendar/delete-event?eventId=${eventId}`, 'DELETE')
      log('green', `   ✅ 已刪除事件: ${eventId}`)
    } catch (error: any) {
      log('yellow', `   ⚠️  刪除失敗: ${eventId} - ${error.message}`)
    }
  }

  log('green', '\n✨ 清理完成')
}

// ============================================================================
// 主測試流程
// ============================================================================

async function runTests() {
  log('cyan', '╔══════════════════════════════════════════════════════════╗')
  log('cyan', '║         Google Calendar API CRUD 測試                    ║')
  log('cyan', '╚══════════════════════════════════════════════════════════╝')

  log('cyan', `\n🔗 API URL: ${API_BASE_URL}`)
  log('cyan', `🔑 Token: ${FIREBASE_TOKEN.substring(0, 20)}...`)

  // 執行測試
  await testCreateEvent()
  await testReadFreeBusy()
  await testUpdateEvent()
  await testDeleteEvent()
  await testReminders()

  // 顯示測試結果
  log('cyan', '\n╔══════════════════════════════════════════════════════════╗')
  log('cyan', '║                    測試結果摘要                          ║')
  log('cyan', '╚══════════════════════════════════════════════════════════╝')

  log('cyan', `\n總測試數：${totalTests}`)
  log('green', `✅ 通過：${passedTests}`)

  if (failedTests > 0) {
    log('red', `❌ 失敗：${failedTests}`)

    // 即使測試失敗也要清理
    await cleanup()
    process.exit(1)
  } else {
    log('green', '\n🎉 所有測試通過！')

    // 清理測試資料
    await cleanup()
  }
}

// 執行測試
runTests().catch(error => {
  log('red', '\n❌ 測試執行失敗：')
  log('red', error.message)
  process.exit(1)
})
