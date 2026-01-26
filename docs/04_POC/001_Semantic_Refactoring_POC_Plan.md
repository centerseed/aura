# POC-001: Semantic Clustering & Knowledge Refactoring (語義群聚與知識重構驗證)

## 1. 目的
驗證《Zentropy 功能規格書》第 3.4 節中定義的「語義感測」與「自動重構」邏輯。重點在於驗證跨語言對齊能力以及基於統計學（Z-Score）的重構觸發機制。

## 2. 測試場景
在一個混雜了「開發」、「理財」、「生活」以及「特定 AI 技術」的標籤庫（Topic: Coding）中，驗證系統能否主動發現「Gemini 相關議題」已過熱並需要重新分組。

## 3. 技術組件
- **Embedding Model**: `text-embedding-004` (Google Gemini 系列) 或 `text-embedding-3-small` (OpenAI)。
- **計算庫**: `numpy` (矩陣運算), `scikit-learn` (相似度與聚類分析)。
- **分析方法**: 餘弦相似度 (Cosine Similarity) & Z-Score 密度判定。

## 4. 數據集範例
準備 10 則混雜了中文與英文、碎料與主題內容的 Mock 筆記：
- N1~N5: 關於 Gemini API 的開發細節（中英混雜）。
- N6~N8: 一般 Python 開發技巧。
- N9~N10: 無關雜訊。

## 5. 驗證步驟
1. **生成向量**: 將 10 則內容轉換為高維向量。
2. **計算全局底噪**: 計算所有筆記兩兩相似度的平均值與方差。
3. **識別子群聚**: 使用 K-Means 或語義相似度篩選，找出最緊密的群聚。
4. **觸發判定**: 計算該群聚的相似度平均值，判斷是否高於全局平均值 + 2.5 倍標準差。

## 6. 腳本實現位置
`tests/poc/semantic_refactoring_demo.py`
