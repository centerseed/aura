"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Loader2, CheckCircle2 } from "lucide-react";
import { BriefingSchedule } from "@/domain/entities/user.entity";
import { DEFAULT_BRIEFING_SCHEDULE } from "@/lib/briefing-schedule-defaults";

interface BriefingScheduleSettingsProps {
  initialSettings?: BriefingSchedule;
  onSave: (schedule: BriefingSchedule) => Promise<void>;
}

export function BriefingScheduleSettings({
  initialSettings,
  onSave,
}: BriefingScheduleSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [schedule, setSchedule] = useState<BriefingSchedule>(
    initialSettings || DEFAULT_BRIEFING_SCHEDULE
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(schedule);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save briefing schedule:", error);
      alert("儲存失敗，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center text-white">
          <Sun className="w-5 h-5 mr-2 text-amber-400" />
          晨報/晚報時間設定
        </CardTitle>
        <CardDescription className="text-slate-400">
          設定你希望看到晨報/晚報生成提示的時間窗口
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 晨報設定 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">晨報</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.morning?.enabled ?? true}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    morning: {
                      ...(schedule.morning || DEFAULT_BRIEFING_SCHEDULE.morning!),
                      enabled: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-400">啟用提示</span>
            </label>
          </div>

          {schedule.morning?.enabled && (
            <div className="flex items-center gap-3 pl-6">
              <span className="text-xs text-slate-500">觀看時間窗口：</span>
              <select
                value={schedule.morning?.windowStart ?? 7}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    morning: {
                      ...(schedule.morning || DEFAULT_BRIEFING_SCHEDULE.morning!),
                      windowStart: parseInt(e.target.value),
                    },
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span className="text-slate-500">-</span>
              <select
                value={schedule.morning?.windowEnd ?? 14}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    morning: {
                      ...(schedule.morning || DEFAULT_BRIEFING_SCHEDULE.morning!),
                      windowEnd: parseInt(e.target.value),
                    },
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
                <option value={24}>24:00</option>
              </select>
            </div>
          )}
        </div>

        {/* 晚報設定 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-white">晚報</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.evening?.enabled ?? true}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    evening: {
                      ...(schedule.evening || DEFAULT_BRIEFING_SCHEDULE.evening!),
                      enabled: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-400">啟用提示</span>
            </label>
          </div>

          {schedule.evening?.enabled && (
            <div className="flex items-center gap-3 pl-6">
              <span className="text-xs text-slate-500">觀看時間窗口：</span>
              <select
                value={schedule.evening?.windowStart ?? 19}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    evening: {
                      ...(schedule.evening || DEFAULT_BRIEFING_SCHEDULE.evening!),
                      windowStart: parseInt(e.target.value),
                    },
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span className="text-slate-500">-</span>
              <select
                value={schedule.evening?.windowEnd ?? 24}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    evening: {
                      ...(schedule.evening || DEFAULT_BRIEFING_SCHEDULE.evening!),
                      windowEnd: parseInt(e.target.value),
                    },
                  })
                }
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
                <option value={24}>24:00</option>
              </select>
            </div>
          )}
        </div>

        {/* 說明 */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            💡 <strong className="text-slate-300">如何運作：</strong>只有在設定的時間窗口內打開 Dashboard，才會主動提示「生成{" "}
            {schedule.morning?.enabled && schedule.evening?.enabled
              ? "晨報/晚報"
              : schedule.morning?.enabled
              ? "晨報"
              : schedule.evening?.enabled
              ? "晚報"
              : "簡報"}
            」。窗口外仍可查看已生成的簡報，但不會主動提示。
          </p>
          {(schedule.evening?.windowEnd ?? 24) <= (schedule.evening?.windowStart ?? 19) && (
            <p className="text-xs text-amber-400 mt-2">
              ⚠️ 晚報時間跨日（如 22:00-02:00）：從今天{" "}
              {(schedule.evening?.windowStart ?? 19).toString().padStart(2, "0")}:00 到明天{" "}
              {(schedule.evening?.windowEnd ?? 24).toString().padStart(2, "0")}:00
            </p>
          )}
        </div>

        {/* 儲存按鈕 */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                儲存中...
              </>
            ) : (
              "儲存設定"
            )}
          </Button>
          {saveSuccess && (
            <div className="flex items-center gap-1 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              已儲存
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
