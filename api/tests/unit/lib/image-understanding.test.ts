import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  understandImage,
  formatExtractedItemsAsText,
  validateImage,
  type ImageUnderstandingResult,
} from "@/lib/image-understanding";

// Mock @ai-sdk/google
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mocked-model"),
}));

// Mock ai
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from "ai";

const mockGenerateObject = generateObject as ReturnType<typeof vi.fn>;

describe("image-understanding", () => {
  describe("validateImage", () => {
    it("應該接受有效的 JPEG 圖片", () => {
      const result = validateImage(1024 * 1024, "image/jpeg");
      expect(result).toEqual({ valid: true });
    });

    it("應該接受有效的 PNG 圖片", () => {
      const result = validateImage(5 * 1024 * 1024, "image/png");
      expect(result).toEqual({ valid: true });
    });

    it("應該接受有效的 WEBP 圖片", () => {
      const result = validateImage(100, "image/webp");
      expect(result).toEqual({ valid: true });
    });

    it("應該拒絕超過 10MB 的圖片", () => {
      const result = validateImage(11 * 1024 * 1024, "image/jpeg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("10MB");
    });

    it("應該拒絕不支援的格式", () => {
      const result = validateImage(1024, "image/gif");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("image/gif");
    });

    it("應該拒絕非圖片格式", () => {
      const result = validateImage(1024, "application/pdf");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("application/pdf");
    });
  });

  describe("understandImage", () => {
    const mockItineraryResult: ImageUnderstandingResult = {
      image_type: "itinerary",
      confidence: 0.95,
      extracted_text: "Day 5: 2/10 台北 → 九份\nDay 6: 2/11 平溪線",
      extracted_items: [
        {
          title: "台北到九份交通",
          description: "搭公車 1062 到九份老街",
          date: "2026-02-10",
          time: "09:00",
          priority: "high",
          visual_cues: ["紅色標記"],
          category: "交通",
          sub_items: ["買悠遊卡", "查公車時刻表"],
          notes: "車程約 1.5 小時",
        },
        {
          title: "九份老街觀光",
          description: "逛老街、吃芋圓",
          date: "2026-02-10",
          time: "11:00",
          priority: "medium",
          visual_cues: [],
          category: "觀光",
          sub_items: [],
          notes: "",
        },
        {
          title: "平溪線一日遊",
          description: "十分放天燈、平溪老街",
          date: "2026-02-11",
          time: "08:30",
          priority: "medium",
          visual_cues: ["藍色區塊"],
          category: "觀光",
          sub_items: ["十分瀑布", "放天燈"],
          notes: "需買平溪線一日券",
        },
      ],
      context: {
        overall_theme: "台灣北部旅遊行程",
        date_range: { start: "2026-02-10", end: "2026-02-11" },
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("應該正確呼叫 Gemini API 並回傳結果", async () => {
      mockGenerateObject.mockResolvedValue({ object: mockItineraryResult });

      const buffer = Buffer.from("fake-image-data");
      const result = await understandImage(buffer, "image/jpeg");

      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(result.image_type).toBe("itinerary");
      expect(result.extracted_items).toHaveLength(3);
      expect(result.confidence).toBe(0.95);
    });

    it("應該在有補充文字時傳遞給 API", async () => {
      mockGenerateObject.mockResolvedValue({ object: mockItineraryResult });

      const buffer = Buffer.from("fake-image-data");
      await understandImage(buffer, "image/png", "這是我的旅遊行程");

      const call = mockGenerateObject.mock.calls[0][0];
      const textContent = call.messages[0].content.find(
        (c: any) => c.type === "text"
      );
      expect(textContent.text).toContain("這是我的旅遊行程");
    });

    it("應該拒絕超過大小限制的圖片", async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      await expect(
        understandImage(largeBuffer, "image/jpeg")
      ).rejects.toThrow("超過限制");
    });

    it("應該拒絕不支援的格式", async () => {
      const buffer = Buffer.from("fake");
      await expect(
        understandImage(buffer, "image/gif")
      ).rejects.toThrow("不支援");
    });
  });

  describe("formatExtractedItemsAsText", () => {
    it("應該正確格式化行程表結果", () => {
      const result: ImageUnderstandingResult = {
        image_type: "itinerary",
        confidence: 0.9,
        extracted_text: "raw text",
        extracted_items: [
          {
            title: "搭火車到花蓮",
            description: "台北車站出發",
            date: "2026-02-10",
            time: "08:00",
            priority: "high",
            visual_cues: [],
            category: "交通",
            sub_items: [],
            notes: "建議提前買票",
          },
          {
            title: "太魯閣國家公園",
            description: "",
            date: "2026-02-10",
            time: "13:00",
            priority: "medium",
            visual_cues: [],
            category: "觀光",
            sub_items: ["砂卡噹步道", "燕子口"],
            notes: "",
          },
        ],
        context: {
          overall_theme: "花蓮兩日遊",
          date_range: { start: "2026-02-10", end: "2026-02-11" },
        },
      };

      const text = formatExtractedItemsAsText(result);

      expect(text).toContain("花蓮兩日遊");
      expect(text).toContain("2026-02-10 ~ 2026-02-11");
      expect(text).toContain("08:00 搭火車到花蓮");
      expect(text).toContain("台北車站出發");
      expect(text).toContain("備註：建議提前買票");
      expect(text).toContain("砂卡噹步道");
      expect(text).toContain("燕子口");
    });

    it("應該處理沒有日期的項目", () => {
      const result: ImageUnderstandingResult = {
        image_type: "todo_list",
        confidence: 0.8,
        extracted_text: "raw",
        extracted_items: [
          {
            title: "買牛奶",
            description: "",
            priority: "low",
            visual_cues: [],
            category: "購物",
            sub_items: [],
            notes: "",
          },
        ],
        context: {
          overall_theme: "購物清單",
        },
      };

      const text = formatExtractedItemsAsText(result);
      expect(text).toContain("購物清單");
      expect(text).toContain("買牛奶");
    });

    it("應該按日期排序", () => {
      const result: ImageUnderstandingResult = {
        image_type: "itinerary",
        confidence: 0.9,
        extracted_text: "",
        extracted_items: [
          {
            title: "Day 2",
            description: "",
            date: "2026-02-12",
            priority: "medium",
            visual_cues: [],
            category: "觀光",
            sub_items: [],
            notes: "",
          },
          {
            title: "Day 1",
            description: "",
            date: "2026-02-11",
            priority: "medium",
            visual_cues: [],
            category: "觀光",
            sub_items: [],
            notes: "",
          },
        ],
        context: {
          overall_theme: "旅遊",
        },
      };

      const text = formatExtractedItemsAsText(result);
      const day1Pos = text.indexOf("Day 1");
      const day2Pos = text.indexOf("Day 2");
      expect(day1Pos).toBeLessThan(day2Pos);
    });

    it("應該處理空結果", () => {
      const result: ImageUnderstandingResult = {
        image_type: "other",
        confidence: 0.3,
        extracted_text: "",
        extracted_items: [],
        context: {
          overall_theme: "無法辨識",
        },
      };

      const text = formatExtractedItemsAsText(result);
      expect(text).toContain("無法辨識");
    });
  });
});
