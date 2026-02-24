import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Zentropy',
  description: 'Zentropy 隱私政策',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            隱私政策
          </h1>
          <p className="text-slate-400">
            最後更新日期：2026 年 2 月 24 日
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. 資訊收集</h2>
            <p className="mb-4">
              Zentropy 致力於保護您的隱私。我們收集以下類型的資訊：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>帳號資訊：Email、名稱（通過 Google 或 Email 登入時提供）</li>
              <li>使用資料：任務、專案、領域等您主動創建的內容</li>
              <li>Google Calendar 資料：僅在您授權後存取（用於查看可用時間、創建會議）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. 資訊使用</h2>
            <p className="mb-4">我們使用收集的資訊用於：</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>提供和改進 Zentropy 服務</li>
              <li>同步您的任務和專案資料</li>
              <li>與 Google Calendar 整合（僅在您授權後）</li>
              <li>發送重要的服務通知</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Google OAuth 授權</h2>
            <p className="mb-4">
              當您連接 Google Calendar 時，我們會請求以下權限：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>查看日曆</strong>：讀取您的可用時間</li>
              <li><strong>創建活動</strong>：在您的日曆中創建會議</li>
              <li><strong>編輯活動</strong>：更新會議資訊</li>
            </ul>
            <p className="mt-4">
              <strong>重要說明</strong>：我們不會存取您日曆中的其他事件內容，也不會分享您的日曆資料給第三方。
              您可以隨時在設定頁面中解除授權。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. 資料儲存與安全</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>所有資料使用 SSL/TLS 加密傳輸</li>
              <li>OAuth Token 使用 AES-256-CBC 加密儲存</li>
              <li>定期進行安全性審查與更新</li>
              <li>資料儲存於安全的雲端服務（Neon Database）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. AI 功能與資料處理</h2>
            <p className="mb-4">
              Zentropy 使用人工智慧技術提供以下功能：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Brain Dump（智慧捕捉）</strong>：自動分析您的文字輸入，將其分類為任務並歸入適當的專案</li>
              <li><strong>Coach Briefing（教練簡報）</strong>：根據您的任務和專案狀態，產生每日行動建議</li>
              <li><strong>Topic Reorganization（主題重組）</strong>：分析專案中的任務分布，提供組織結構優化建議</li>
            </ul>
            <p className="mt-4 mb-4">
              為提供上述 AI 功能，我們會將以下資料傳送至 <strong>Google Gemini API</strong> 進行處理：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>您輸入的文字內容</li>
              <li>任務名稱與描述</li>
              <li>專案名稱與主題名稱</li>
              <li>里程碑資訊</li>
            </ul>
            <p className="mt-4">
              <strong>重要說明</strong>：根據 Google 的 API 資料使用政策，透過 API 傳送的資料<strong>不會</strong>被用於訓練 Google 的 AI 模型。
              AI 功能需要您的明確同意才會啟用，您可以隨時在 App 設定中關閉 AI 功能。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. 資料分享</h2>
            <p className="mb-4">
              我們<strong>不會</strong>出售、交易或轉讓您的個人資訊給第三方，除非法律要求或獲得您的明確同意。
            </p>
            <p>
              上述 AI 功能所需的資料傳輸（至 Google Gemini API）屬於提供服務所必要的處理，
              僅限於您同意使用 AI 功能時進行，且不構成資訊出售或轉讓。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. 您的權利</h2>
            <p className="mb-4">您有權利：</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>隨時刪除您的帳號和所有資料</li>
              <li>匯出您的資料</li>
              <li>解除 Google Calendar 授權</li>
              <li>更新或修改您的個人資訊</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Cookie 使用</h2>
            <p>
              Zentropy 使用 Cookie 來維持您的登入狀態和改善使用體驗。
              您可以通過瀏覽器設定管理 Cookie。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. 政策更新</h2>
            <p>
              我們可能會不定期更新此隱私政策。重大變更時，我們會通過 Email 或服務通知您。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. 聯絡我們</h2>
            <p>
              如果您對此隱私政策有任何疑問，請聯絡：
              <br />
              <a href="mailto:centerseedwu@gmail.com" className="text-indigo-400 hover:text-indigo-300">
                centerseedwu@gmail.com
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <a
            href="/"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← 返回首頁
          </a>
        </div>
      </div>
    </div>
  )
}
