import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Zentropy',
  description: 'Zentropy 服務條款',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            服務條款
          </h1>
          <p className="text-slate-400">
            最後更新日期：2026 年 2 月 7 日
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. 服務說明</h2>
            <p>
              Zentropy 是一個任務管理和營運協作平台，提供任務追蹤、專案管理、
              Google Calendar 整合等功能。通過使用本服務，您同意遵守以下條款。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. 帳號註冊</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>您必須提供真實、準確的資訊</li>
              <li>您需負責保管帳號安全</li>
              <li>不得與他人共享帳號</li>
              <li>如發現未經授權的使用，請立即通知我們</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. 使用規範</h2>
            <p className="mb-4">使用 Zentropy 服務時，您同意：</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>禁止</strong>上傳違法、侵權或惡意內容</li>
              <li><strong>禁止</strong>試圖破壞系統安全或干擾服務運作</li>
              <li><strong>禁止</strong>使用自動化工具進行濫用行為</li>
              <li><strong>禁止</strong>冒充他人或提供虛假資訊</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Google Calendar 整合</h2>
            <p className="mb-4">
              當您授權 Zentropy 存取 Google Calendar 時：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>我們僅會讀取您的可用時間和創建您指定的會議</li>
              <li>不會存取或修改其他日曆事件</li>
              <li>您可以隨時在設定頁面中解除授權</li>
              <li>解除授權後，相關資料將被刪除</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. 智慧財產權</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>您的內容</strong>：您保留對上傳內容的所有權</li>
              <li><strong>Zentropy 平台</strong>：所有介面、程式碼、設計為 Zentropy 所有</li>
              <li><strong>授權</strong>：您授予 Zentropy 使用您內容的必要權限以提供服務</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. 免責聲明</h2>
            <p className="mb-4">
              Zentropy 服務按「現況」提供，我們不保證：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>服務不會中斷或完全無誤</li>
              <li>資料不會遺失（建議定期備份重要資料）</li>
              <li>符合您的特定需求</li>
            </ul>
            <p className="mt-4">
              我們會盡力維持服務穩定，但不對因服務中斷、資料遺失造成的損失負責。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. 服務變更與終止</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>我們保留隨時修改或終止服務的權利</li>
              <li>重大變更會提前通知用戶</li>
              <li>您可以隨時刪除帳號並終止服務</li>
              <li>如違反使用規範，我們可能暫停或終止您的帳號</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. 資料備份</h2>
            <p>
              我們建議您定期備份重要資料。雖然我們會盡力保護資料安全，
              但不對資料遺失承擔責任。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. 第三方服務</h2>
            <p>
              Zentropy 整合了 Google Calendar 等第三方服務。
              這些服務受其各自的服務條款約束，我們不對第三方服務負責。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. 適用法律</h2>
            <p>
              本服務條款受中華民國法律管轄。
              如有爭議，雙方同意以台灣台北地方法院為第一審管轄法院。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. 條款更新</h2>
            <p>
              我們可能會不定期更新服務條款。重大變更時，我們會通過 Email 或服務通知您。
              繼續使用服務即表示您同意更新後的條款。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. 聯絡我們</h2>
            <p>
              如果您對服務條款有任何疑問，請聯絡：
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
