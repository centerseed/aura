"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  Eye
} from "lucide-react";

// Helper function to get auth headers
async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  const token = await user.getIdToken();
  return { 'Authorization': `Bearer ${token}` };
}

interface EvaluationLog {
  id: string;
  user_id: string;
  type: "BRAIN_DUMP" | "ADJUST_TAGS" | "REORGANIZE";
  input_content: any;
  output_content: any;
  user_action: "PENDING" | "APPLIED" | "CANCELLED" | "EDITED";
  metadata: any;
  created_at: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
}

export default function EvaluationDashboard() {
  const router = useRouter();
  const [logs, setLogs] = useState<EvaluationLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<EvaluationLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 從 Firebase Auth 獲取當前用戶
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 使用 Firebase ID Token 查詢資料庫中的用戶 ID
        try {
          const token = await user.getIdToken();
          const meRes = await fetch(`${API_BASE_URL}/api/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (meRes.ok) {
            const userData = await meRes.json();
            setUserId(userData.id);
          } else {
            // 用戶未在資料庫中註冊
            router.push("/");
          }
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          router.push("/");
        }
      } else {
        // 未登入,導向首頁
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchLogs = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append("type", filterType);
      if (filterAction) params.append("userAction", filterAction);

      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/evaluation/logs?${params.toString()}`, {
        headers: authHeaders
      });
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchLogs();
    }
  }, [userId, filterType, filterAction]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "APPLIED":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-amber-400" />;
      case "EDITED":
        return <AlertCircle className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "APPLIED":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "CANCELLED":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "PENDING":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "EDITED":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-white/5 text-white/50 border-white/10";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "BRAIN_DUMP":
        return "Brain Dump";
      case "ADJUST_TAGS":
        return "調整標籤";
      case "REORGANIZE":
        return "重新整理";
      default:
        return type;
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center">
        <p className="text-white/50">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.history.back()}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <h1 className="text-2xl font-bold text-white">AI 評估紀錄</h1>
            </div>
            <Button
              size="sm"
              onClick={fetchLogs}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              重新整理
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex gap-2 items-center">
              <Filter className="w-4 h-4 text-white/50" />
              <select
                value={filterType || ""}
                onChange={(e) => setFilterType(e.target.value || null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">所有類型</option>
                <option value="BRAIN_DUMP">Brain Dump</option>
                <option value="ADJUST_TAGS">調整標籤</option>
                <option value="REORGANIZE">重新整理</option>
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={filterAction || ""}
                onChange={(e) => setFilterAction(e.target.value || null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">所有狀態</option>
                <option value="APPLIED">已應用</option>
                <option value="CANCELLED">已取消</option>
                <option value="PENDING">待處理</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Log List */}
          <Card className="bg-slate-900 border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              紀錄列表 ({logs.length})
            </h2>
            <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-center text-white/50 py-8">
                  {isLoading ? "載入中..." : "沒有紀錄"}
                </p>
              ) : (
                logs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedLog?.id === log.id
                        ? "bg-indigo-500/20 border-indigo-500/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">
                            {getTypeLabel(log.type)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${getActionColor(log.user_action)}`}>
                            {log.user_action}
                          </span>
                        </div>
                        <p className="text-xs text-white/50">
                          {new Date(log.created_at).toLocaleString("zh-TW")}
                        </p>
                      </div>
                      {getActionIcon(log.user_action)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Detail View */}
          <Card className="bg-slate-900 border-white/10 p-4">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-indigo-400" />
                    詳細資訊
                  </h2>
                  <span className={`text-sm px-3 py-1 rounded-full border ${getActionColor(selectedLog.user_action)}`}>
                    {selectedLog.user_action}
                  </span>
                </div>

                {/* Meta Info */}
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-white/50">類型：</span>
                      <span className="text-white">{getTypeLabel(selectedLog.type)}</span>
                    </div>
                    <div>
                      <span className="text-white/50">時間：</span>
                      <span className="text-white">
                        {new Date(selectedLog.created_at).toLocaleString("zh-TW")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Input Content */}
                <div>
                  <h3 className="text-sm font-medium text-white/70 mb-2">輸入內容</h3>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-blue-200 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedLog.input_content, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Output Content */}
                <div>
                  <h3 className="text-sm font-medium text-white/70 mb-2">AI 輸出</h3>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-green-200 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedLog.output_content, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Metadata */}
                {selectedLog.metadata && (
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-2">額外資訊</h3>
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 max-h-64 overflow-y-auto">
                      <pre className="text-xs text-purple-200 whitespace-pre-wrap break-words">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-white/50">選擇一筆紀錄來查看詳細資訊</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
