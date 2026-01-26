# ⚙️ 設定頁面開發報告

## 📅 開發時間
- 日期：2026-01-26

## 🎯 功能目標
建立用戶設定頁面，首先實現登出功能。

## ✅ 已完成功能

### 1. 設定頁面 (`/settings`)

**檔案**：[web/app/settings/page.tsx](web/app/settings/page.tsx)

**功能**：
- ✅ 顯示用戶基本資訊（名稱、Email、認證方式）
- ✅ 登出按鈕
- ✅ 返回 Dashboard 按鈕
- ✅ Firebase Auth 身份驗證
- ✅ 未登入自動重定向到首頁

**UI 設計**：
- 🎨 使用 Slate 950 深色背景
- 🎨 紫色/粉色漸層標題
- 🎨 卡片式資訊展示
- 🎨 紅色登出按鈕（警示色）

### 2. 用戶資訊顯示

顯示三個主要資訊：

1. **名稱**
   - 來源：`userData.displayName`
   - Icon：User

2. **Email**
   - 來源：`userData.email`
   - Icon：Mail

3. **認證方式**
   - GOOGLE → "Google"
   - ANONYMOUS → "訪客"
   - EMAIL → "Email"
   - Icon：Shield

### 3. 登出功能

```typescript
const handleSignOut = async () => {
  setIsSigningOut(true);
  try {
    await signOut(auth);  // Firebase 登出
    router.push("/");     // 重定向到首頁
  } catch (error) {
    console.error("登出失敗:", error);
    alert("登出失敗，請稍後再試");
    setIsSigningOut(false);
  }
};
```

**流程**：
1. 使用者點擊登出按鈕
2. 呼叫 Firebase `signOut(auth)`
3. 清除 Firebase Authentication Session
4. 重定向到首頁 (`/`)
5. Firebase `onAuthStateChanged` 觸發
6. Dashboard/Onboarding 檢測到未登入狀態
7. 自動重定向到首頁

### 4. Dashboard 整合

**檔案**：[web/app/dashboard/page.tsx](web/app/dashboard/page.tsx)

**修改**：
- 在 Header 右側加入設定按鈕
- 位置：視圖切換按鈕之後
- Icon：Settings (齒輪圖示)
- 點擊後跳轉到 `/settings`

**程式碼**：
```typescript
{/* 設定按鈕 */}
<button
  onClick={() => router.push("/settings")}
  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
  title="設定"
>
  <Settings className="w-5 h-5" />
</button>
```

## 📱 頁面結構

### 設定頁面佈局

```
┌─────────────────────────────────┐
│ ← 返回 Dashboard                │
│                                 │
│ 帳號設定                        │
│ 管理你的帳號資訊與偏好設定      │
├─────────────────────────────────┤
│ 個人資訊                        │
│ ┌─────────────────────────────┐ │
│ │ 👤 名稱: 吳柏宗              │ │
│ │ ✉️  Email: centerseed...    │ │
│ │ 🛡️  認證方式: Google         │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 帳號操作                        │
│ ┌─────────────────────────────┐ │
│ │ [🚪 登出]                    │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 偏好設定                        │
│ 即將推出...                     │
└─────────────────────────────────┘
```

### Dashboard Header 更新

```
┌──────────────────────────────────────────────────┐
│ Zentropy │ 歡迎，吳柏宗       [結構][時間][甘特][⚙️] │
└──────────────────────────────────────────────────┘
```

## 🔧 技術實作

### 使用的技術
- **框架**：Next.js 16 (App Router)
- **UI 庫**：shadcn/ui (Card, Button)
- **Icon**：Lucide React
- **認證**：Firebase Authentication
- **樣式**：Tailwind CSS

### 使用的元件
```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, User, Mail, Shield, Loader2, ArrowLeft } from "lucide-react";
```

### State 管理
```typescript
const [isLoading, setIsLoading] = useState(true);          // 載入狀態
const [isSigningOut, setIsSigningOut] = useState(false);   // 登出中狀態
const [userData, setUserData] = useState(null);            // 用戶資料
```

### Firebase Auth 整合
```typescript
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser) {
      router.push("/");  // 未登入重定向
      return;
    }

    // 獲取用戶資料
    const userRes = await fetch(`/api/me?firebaseUid=${firebaseUser.uid}`);
    const data = await userRes.json();
    setUserData(data);
  });

  return () => unsubscribe();
}, [router]);
```

## 🎨 UI/UX 設計

### 顏色配置
- **背景**：Slate 950 (深色)
- **卡片**：Slate 900 (次深色)
- **邊框**：Slate 800
- **標題漸層**：Purple 400 → Pink 400
- **文字**：White / Slate 400
- **登出按鈕**：Red 600 → Red 700

### 互動效果
- ✨ Hover 效果：亮度提升
- ✨ 載入動畫：Spinner
- ✨ 過渡動畫：transition-all
- ✨ 按鈕禁用狀態：disabled 時顯示載入中

### 響應式設計
- 📱 最大寬度：4xl (max-w-4xl)
- 📱 Padding：px-6 py-8
- 📱 卡片間距：space-y-6

## 📋 使用流程

### 1. 進入設定頁面
```
Dashboard → 點擊右上角齒輪圖示 → 進入設定頁面
```

### 2. 查看個人資訊
- 名稱
- Email
- 認證方式

### 3. 登出
```
點擊「登出」按鈕
  ↓
Firebase Auth 登出
  ↓
重定向到首頁
  ↓
完成登出
```

### 4. 返回 Dashboard
```
點擊「← 返回 Dashboard」按鈕
  ↓
返回主頁面
```

## 🔒 安全性

### ✅ 已實現
1. **身份驗證**：使用 Firebase Auth Session
2. **自動重定向**：未登入自動跳轉首頁
3. **安全登出**：完整清除 Firebase Session
4. **無 URL 參數**：設定頁面無敏感資訊

### 🔐 登出安全流程
```
1. 用戶點擊登出
2. 呼叫 Firebase signOut()
3. 清除本地 Session
4. 重定向到首頁
5. 所有受保護頁面檢測到未登入
6. 自動重定向到首頁
```

## 📝 待開發功能

### 🔜 偏好設定
- [ ] 語言設定
- [ ] 主題設定（淺色/深色）
- [ ] 通知設定
- [ ] 資料匯出

### 🔜 帳號管理
- [ ] 修改名稱
- [ ] 修改 Email
- [ ] 變更密碼（Email 登入）
- [ ] 刪除帳號

### 🔜 隱私與安全
- [ ] 登入裝置管理
- [ ] 登入歷史紀錄
- [ ] 兩步驟驗證

## 🧪 測試清單

### 功能測試
- [ ] 點擊 Dashboard 設定按鈕能正常進入設定頁面
- [ ] 設定頁面正確顯示用戶資訊
- [ ] 登出按鈕正常運作
- [ ] 登出後重定向到首頁
- [ ] 返回 Dashboard 按鈕正常運作
- [ ] 未登入訪問 `/settings` 自動重定向首頁

### UI 測試
- [ ] 設定按鈕 hover 效果正常
- [ ] 卡片樣式正確
- [ ] 登出按鈕載入動畫正常
- [ ] 響應式佈局正常

### 安全測試
- [ ] 登出後無法訪問 Dashboard
- [ ] 登出後無法訪問設定頁面
- [ ] Firebase Session 完全清除

## 📊 檔案修改記錄

### 新增檔案
1. **web/app/settings/page.tsx** (210 行)
   - 設定頁面主檔案
   - 包含用戶資訊顯示
   - 包含登出功能

### 修改檔案
1. **web/app/dashboard/page.tsx**
   - 新增設定按鈕（Header 右側）
   - 使用現有的 Settings icon

## ✅ 完成狀態

🎉 **設定頁面開發完成！**

- ✅ 設定頁面已建立
- ✅ 登出功能已實作
- ✅ Dashboard 整合完成
- ✅ Firebase Auth 整合完成
- ✅ UI/UX 設計完成
- 🔄 待測試

## 🚀 測試步驟

### 1. 啟動開發伺服器
```bash
cd /Users/wubaizong/Naruvia/web
npm run dev
```

### 2. 測試登入
1. 訪問 http://localhost:3000
2. 使用 Google 登入
3. 進入 Dashboard

### 3. 測試設定頁面
1. 點擊右上角齒輪圖示
2. 確認進入設定頁面
3. 查看用戶資訊是否正確

### 4. 測試登出
1. 點擊「登出」按鈕
2. 確認跳轉到首頁
3. 嘗試訪問 `/dashboard`
4. 確認被重定向到首頁

---

**開發時間**: 2026-01-26
**狀態**: ✅ 完成
**待測試**: 登出流程
