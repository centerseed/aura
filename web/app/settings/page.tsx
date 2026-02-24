"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, User, Loader2, ArrowLeft, Calendar, CheckCircle2, AlertCircle, Plug, Copy, Check, Pencil, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { API_BASE_URL } from "@/lib/api-client";
import {
  OAuthStatus,
  getOAuthStatus,
  disconnectOAuth,
} from "@/lib/oauth-client";
import { OAuthConnectDialog } from "@/components/oauth-connect-dialog";
import { BriefingScheduleSettings } from "@/components/briefing-schedule-settings";
import { BriefingSchedule } from "@/domain/entities/user.entity";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userData, setUserData] = useState<{
    id: string;
    email: string | null;
    name: string | null;
    displayName: string;
    auth_provider: string;
    timezone: string;
    settings: any | null;
  } | null>(null);

  // OAuth 狀態（目前只支援 Google Calendar）
  const [calendarStatus, setCalendarStatus] = useState<OAuthStatus | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userToken, setUserToken] = useState<string>('');

  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null);
  const [mcpConfigCopied, setMcpConfigCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const mcpServerUrl =
    process.env.NEXT_PUBLIC_MCP_SERVER_URL ||
    (API_BASE_URL && API_BASE_URL.startsWith('http') ? API_BASE_URL : null) ||
    'https://api.zentropy.cc';

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        setUserToken(token); // 存儲 token 供其他組件使用

        const userRes = await fetch(`${API_BASE_URL}/api/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (userRes.ok) {
          const data = await userRes.json();
          setUserData({
            ...data.data.user,
            timezone: data.data.user?.timezone || 'Asia/Taipei',
          });
        }

        // 載入 AI 使用量
        try {
          const usageRes = await fetch(`${API_BASE_URL}/api/me/ai-usage`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (usageRes.ok) {
            const usageData = await usageRes.json();
            setAiUsage(usageData.data);
          }
        } catch (e) {
          console.error('載入 AI 使用量失敗:', e);
        }

        // 載入 Google Calendar 狀態
        await loadCalendarStatus(token);
      } catch (error) {
        console.error("載入用戶資料失敗:", error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 處理 OAuth callback（URL 參數）
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    const provider = searchParams.get('provider');

    // 如果是在 popup 中，通知父視窗後關閉
    if (window.opener && (oauthSuccess || oauthError)) {
      if (oauthSuccess === 'true') {
        window.opener.postMessage(
          { type: 'oauth-success', provider },
          window.location.origin
        );
      } else if (oauthError) {
        window.opener.postMessage(
          { type: 'oauth-error', error: decodeURIComponent(oauthError) },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    // 正常頁面中的處理（非 popup）
    if (oauthSuccess === 'true' && provider === 'google_calendar') {
      setOauthMessage({
        type: 'success',
        text: '✅ Google Calendar 已成功連接！',
      });

      // 重新載入 Calendar 狀態
      auth.currentUser?.getIdToken().then(loadCalendarStatus);

      // 3 秒後清除訊息
      setTimeout(() => setOauthMessage(null), 3000);
    } else if (oauthError) {
      setOauthMessage({
        type: 'error',
        text: `❌ 授權失敗：${decodeURIComponent(oauthError)}`,
      });

      // 5 秒後清除訊息
      setTimeout(() => setOauthMessage(null), 5000);
    }
  }, [searchParams]);

  // 載入 Google Calendar 狀態
  const loadCalendarStatus = async (token: string) => {
    setLoadingCalendar(true);
    try {
      const status = await getOAuthStatus('google_calendar', token);
      setCalendarStatus(status);
    } catch (error) {
      console.error('Failed to load calendar status:', error);
      setCalendarStatus(null);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // 複製 MCP 設定到剪貼簿
  const handleCopyMcpConfig = async () => {
    const config = {
      "mcpServers": {
        "zentropy": {
          "type": "sse",
          "url": `${mcpServerUrl}/mcp`,
          "oauth": {
            "authorizationUrl": `${mcpServerUrl}/api/oauth/mcp/authorize`,
            "tokenUrl": `${mcpServerUrl}/api/oauth/mcp/token`,
            "clientId": "claude-code",
            "scopes": ["read:tasks", "write:inbox", "read:knowledge", "write:knowledge", "read:profile"]
          }
        }
      }
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setMcpConfigCopied(true);
      setTimeout(() => setMcpConfigCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy config:', error);
      alert('複製失敗，請手動複製下方設定');
    }
  };

  // 處理解除 Google Calendar 連接
  const handleDisconnectCalendar = async () => {
    const confirmed = confirm(
      '確定要解除 Google Calendar 的連接嗎？\n\n這將撤銷 Zentropy 的日曆授權。'
    );

    if (!confirmed) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      await disconnectOAuth('google_calendar', token);

      setOauthMessage({
        type: 'success',
        text: '✅ Google Calendar 已解除連接',
      });

      // 重新載入狀態
      await loadCalendarStatus(token);

      setTimeout(() => setOauthMessage(null), 3000);
    } catch (error) {
      console.error('Disconnect failed:', error);
      alert(`解除連接失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  };


  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("登出失敗:", error);
      alert("登出失敗，請稍後再試");
      setIsSigningOut(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setIsSavingName(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) throw new Error('更新名稱失敗');
      setUserData((prev) => prev ? { ...prev, displayName: trimmed, name: trimmed } : prev);
      setIsEditingName(false);
    } catch (error) {
      console.error('儲存名稱失敗:', error);
      alert('儲存名稱失敗，請稍後再試');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveBriefingSchedule = async (schedule: BriefingSchedule) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      alert("請先登入");
      return;
    }

    const token = await firebaseUser.getIdToken();
    const currentSettings = userData?.settings || {};

    const response = await fetch(`${API_BASE_URL}/api/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        settings: {
          ...currentSettings,
          briefingSchedule: schedule,
        },
      }),
    });

    if (!response.ok) {
      throw new Error("更新失敗");
    }

    // 重新載入用戶資料
    const userRes = await fetch(`${API_BASE_URL}/api/me`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    if (userRes.ok) {
      const data = await userRes.json();
      setUserData({
        ...data.data.user,
        timezone: data.data.user?.timezone || 'Asia/Taipei',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回 Dashboard
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            帳號設定
          </h1>
          <p className="text-slate-400 mt-2">管理你的帳號資訊與偏好設定</p>
        </div>

        <div className="space-y-6">
          {/* 用戶資訊卡片 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <User className="w-5 h-5 mr-2 text-indigo-400" />
                個人資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">名稱</span>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1 w-40 focus:outline-none focus:border-indigo-500"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName();
                          if (e.key === 'Escape') setIsEditingName(false);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveName}
                        disabled={isSavingName}
                        className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      >
                        {isSavingName ? <Loader2 className="w-3 h-3 animate-spin" /> : '儲存'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingName(false)}
                        className="h-7 px-2 text-slate-400 hover:text-white text-xs"
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {userData?.displayName || "未設定"}
                      </span>
                      <button
                        onClick={() => {
                          setEditingName(userData?.name || userData?.displayName || '');
                          setIsEditingName(true);
                        }}
                        className="text-slate-500 hover:text-indigo-400 transition-colors"
                        title="編輯名稱"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Email</span>
                  <span className="text-white font-medium">
                    {userData?.email || "未設定"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">登入方式</span>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {userData?.auth_provider === "GOOGLE" && "Google"}

                    {userData?.auth_provider === "EMAIL" && "Email"}
                    {userData?.auth_provider === "APPLE" && "Apple"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 晨報/晚報設定 */}
          <BriefingScheduleSettings
            initialSettings={userData?.settings?.briefingSchedule}
            onSave={handleSaveBriefingSchedule}
          />

          {/* AI 使用額度 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Zap className="w-5 h-5 mr-2 text-amber-400" />
                AI 使用額度
              </CardTitle>
              <CardDescription className="text-slate-400">
                每日 AI 功能呼叫次數，每天午夜重置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiUsage ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">今日已使用</span>
                    <span className={`font-medium ${aiUsage.used >= aiUsage.limit ? 'text-red-400' : aiUsage.used >= 30 ? 'text-amber-400' : 'text-white'}`}>
                      {aiUsage.used} / {aiUsage.limit}
                    </span>
                  </div>
                  <Progress
                    value={(aiUsage.used / aiUsage.limit) * 100}
                    className="h-2 bg-slate-800"
                  />
                  {aiUsage.used >= aiUsage.limit && (
                    <Alert className="bg-red-950/50 border-red-500/30">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <AlertDescription className="text-red-300">
                        今日 AI 額度已用完，明天午夜後將自動重置。
                      </AlertDescription>
                    </Alert>
                  )}
                  {aiUsage.used >= 30 && aiUsage.used < aiUsage.limit && (
                    <Alert className="bg-amber-950/50 border-amber-500/30">
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                      <AlertDescription className="text-amber-300">
                        今日 AI 額度已使用超過 {aiUsage.used} 次，剩餘 {aiUsage.limit - aiUsage.used} 次，請留意使用量。
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* MCP (Model Context Protocol) 設定 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Plug className="w-5 h-5 mr-2 text-blue-400" />
                MCP Integration
              </CardTitle>
              <CardDescription className="text-slate-400">
                在 Claude Code 中連接 Zentropy MCP Server，讓 AI 直接存取你的任務資料
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 功能說明 */}
              <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <p className="text-slate-300 text-sm mb-3">
                  連接後，Claude Code 可以：
                </p>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">✓</span>
                    查看你的任務清單和今日計畫
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">✓</span>
                    新增任務到 Inbox
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">✓</span>
                    搜尋知識庫內容
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">✓</span>
                    查看專案結構（Areas/Products/Topics）
                  </li>
                </ul>
              </div>

              {/* 設定步驟 */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-white">設定步驟：</p>
                <ol className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">1.</span>
                    <div>
                      在專案根目錄建立（或開啟）<code className="bg-slate-800 px-1 py-0.5 rounded text-xs">.mcp.json</code>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">2.</span>
                    <div>複製下方設定並貼到 <code className="bg-slate-800 px-1 py-0.5 rounded text-xs">mcpServers</code> 區塊</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">3.</span>
                    <div>重新啟動 Claude Code，首次使用時會自動進行 OAuth 授權</div>
                  </li>
                </ol>
              </div>

              {/* 設定檔內容 */}
              <div className="relative">
                <pre className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto">
{JSON.stringify({
  "mcpServers": {
    "zentropy": {
      "type": "sse",
      "url": `${mcpServerUrl}/mcp`,
      "oauth": {
        "authorizationUrl": `${mcpServerUrl}/api/oauth/mcp/authorize`,
        "tokenUrl": `${mcpServerUrl}/api/oauth/mcp/token`,
        "clientId": "claude-code",
        "scopes": [
          "read:tasks",
          "write:inbox",
          "read:knowledge",
          "write:knowledge",
          "read:profile"
        ]
      }
    }
  }
}, null, 2)}
                </pre>
                <Button
                  onClick={handleCopyMcpConfig}
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  {mcpConfigCopied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      已複製
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      複製設定
                    </>
                  )}
                </Button>
              </div>

              {/* 支援的客戶端 */}
              <p className="text-xs text-slate-500">
                支援的 MCP 客戶端：Claude Code、Cursor、Cline、Continue 等
              </p>
            </CardContent>
          </Card>

          {/* Google Calendar 連接 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Calendar className="w-5 h-5 mr-2 text-indigo-400" />
                Google Calendar
              </CardTitle>
              <CardDescription className="text-slate-400">
                查看可用時間、創建會議並自動生成 Google Meet 連結
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCalendar ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : calendarStatus?.authorized ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-white font-medium">已連接</p>
                        {calendarStatus.authorized_email && (
                          <p className="text-sm text-slate-400 mt-0.5">
                            {calendarStatus.authorized_email}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectCalendar}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      解除連接
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    已授權的權限：查看日曆、創建活動、編輯活動
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                    <p className="text-slate-300 text-sm mb-3">
                      連接 Google Calendar 後，你可以：
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                      <li className="flex items-start">
                        <span className="text-emerald-400 mr-2">✓</span>
                        在 Zentropy 中直接查看空閒時間
                      </li>
                      <li className="flex items-start">
                        <span className="text-emerald-400 mr-2">✓</span>
                        創建會議並自動生成 Google Meet 連結
                      </li>
                      <li className="flex items-start">
                        <span className="text-emerald-400 mr-2">✓</span>
                        設定會議提醒
                      </li>
                    </ul>
                  </div>
                  <Button
                    onClick={() => setShowConnectDialog(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    連接 Google Calendar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OAuth Connect Dialog */}
          {showConnectDialog && userToken && (
            <OAuthConnectDialog
              open={showConnectDialog}
              onOpenChange={setShowConnectDialog}
              provider="google_calendar"
              token={userToken}
              onSuccess={async () => {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                  setUserToken(token);
                  await loadCalendarStatus(token);
                }
              }}
            />
          )}

          {/* OAuth 訊息提示 */}
          {oauthMessage && (
            <Alert className={oauthMessage.type === 'success' ? 'bg-emerald-950/50 border-emerald-500/30' : 'bg-red-950/50 border-red-500/30'}>
              {oauthMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <AlertDescription className="text-white">
                {oauthMessage.text}
              </AlertDescription>
            </Alert>
          )}

          {/* 帳號操作 */}
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6">
              <Button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    登出中...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
