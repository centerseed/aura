"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { auth } from "@/lib/firebase"
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, type User } from "firebase/auth"
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react"
import { API_BASE_URL } from "@/lib/api-client"

type BindState = "loading" | "login-required" | "binding" | "success" | "error"

interface ErrorInfo {
  code: "expired" | "used" | "conflict" | "invalid" | "unknown"
  recoverable: boolean
  message: string
}

const TOKEN_REGEX = /^[0-9a-f]{64}$/

function LineBrowserWarning() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center space-y-4">
        <div className="text-4xl">🌐</div>
        <h2 className="text-white font-bold text-xl">請用瀏覽器開啟</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          LINE 內建瀏覽器不支援 Google 登入。<br />
          請點右上角「⋯」→「在瀏覽器中開啟」
        </p>
      </div>
    </div>
  )
}

function LineBindContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("t") ?? ""
  const [state, setState] = useState<BindState>("loading")
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [isLineBrowser, setIsLineBrowser] = useState(false)
  // 防止 onAuthStateChanged 多次觸發時重複呼叫 performBind
  const bindAttempted = useRef(false)

  // Token 格式驗證
  const tokenValid = TOKEN_REGEX.test(token)

  async function performBind(user: User) {
    setState("binding")
    try {
      const idToken = await user.getIdToken()
      const res = await fetch(`${API_BASE_URL}/api/line/bind`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        setState("success")
        return
      }

      const status = res.status
      if (status === 410) {
        setErrorInfo({ code: "expired", recoverable: true, message: "連結已過期，請回到 LINE 重新獲取綁定連結。" })
      } else if (status === 409) {
        const data = await res.json().catch(() => ({}))
        const isAlreadyBound = data?.error?.includes("already bound to another user")
        const code = isAlreadyBound ? "conflict" : "used"
        const msg = isAlreadyBound
          ? "此 LINE 帳號已綁定其他 Zentropy 帳號，如需協助請聯絡客服。"
          : "此連結已被使用過，請回到 LINE 重新獲取。"
        setErrorInfo({ code, recoverable: true, message: msg })
      } else if (status === 400) {
        setErrorInfo({ code: "invalid", recoverable: false, message: "連結格式無效，請確認連結完整性。" })
      } else {
        setErrorInfo({ code: "unknown", recoverable: true, message: "發生未知錯誤，請稍後再試。" })
      }
      setState("error")
    } catch {
      setErrorInfo({ code: "unknown", recoverable: true, message: "網路錯誤，請確認連線後再試。" })
      setState("error")
    }
  }

  // LINE 瀏覽器偵測必須在 useEffect 裡（SSR 沒有 navigator）
  useEffect(() => {
    setIsLineBrowser(navigator.userAgent.includes("Line/"))
  }, [])

  useEffect(() => {
    if (!tokenValid) {
      setErrorInfo({ code: "invalid", recoverable: false, message: "連結格式無效，請確認連結完整性。" })
      setState("error")
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (bindAttempted.current) return // 防止重複綁定
        bindAttempted.current = true
        performBind(user)
      } else {
        setState("login-required")
      }
    })
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tokenValid])

  async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
      // onAuthStateChanged 會接手
    } catch (err: any) {
      if (err?.code === "auth/popup-blocked") {
        // popup 被擋，改用 redirect
        await signInWithRedirect(auth, provider)
      } else {
        setErrorInfo({ code: "unknown", recoverable: true, message: "登入失敗，請稍後再試。" })
        setState("error")
      }
    }
  }

  if (isLineBrowser) {
    return <LineBrowserWarning />
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
        {/* Logo / Brand */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            Zentropy × LINE
          </h1>
          <p className="text-slate-400 text-sm">帳號綁定</p>
        </div>

        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="text-slate-400 text-sm">確認登入狀態中…</p>
          </div>
        )}

        {state === "login-required" && (
          <div className="space-y-5">
            <p className="text-slate-300 text-sm leading-relaxed">
              請登入 Zentropy 帳號以完成 LINE 綁定。<br />
              登入後將自動完成綁定，無需額外操作。
            </p>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium text-sm py-3 px-4 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 Google 帳號登入
            </button>
          </div>
        )}

        {state === "binding" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-slate-400 text-sm">綁定中，請稍候…</p>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4 py-2">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold text-lg">綁定成功！</h2>
              <p className="text-slate-400 text-sm mt-2">
                回到 LINE 開始與 Zentropy 對話吧 🎉<br />
                隨時傳訊息記錄任務、整理計畫。
              </p>
            </div>
          </div>
        )}

        {state === "error" && errorInfo && (
          <div className="space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold">綁定失敗</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                {errorInfo.message}
              </p>
            </div>
            {errorInfo.recoverable && (
              <a
                href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID ?? '@zentropy'}`}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                返回 LINE 重新取得連結
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LineBindPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <LineBindContent />
    </Suspense>
  )
}
