import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupZombieTopics } from "@/app/api/products/[id]/apply-reorganization/zombie-cleanup";

// Mock PrismaClient
function createMockDb(topics: Array<{ id: string; name: string }>, activeTaskCounts: Record<string, number> = {}) {
  return {
    topic: {
      findMany: vi.fn().mockResolvedValue(topics),
      update: vi.fn().mockResolvedValue({}),
    },
    task: {
      count: vi.fn().mockImplementation(async (args: any) => {
        const topicId = args.where.topic_id;
        return activeTaskCounts[topicId] ?? 0;
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
}

describe("cleanupZombieTopics", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("應該刪除不在 proposed 也不在 operated 中的舊 topic", async () => {
    const db = createMockDb([
      { id: "t1", name: "個人金融與帳戶管理" },
      { id: "t2", name: "個人健康與保健" },
      { id: "t3", name: "個人安全與健康" },
      { id: "t4", name: "個人安全防護" },
      { id: "t5", name: "個人網路安全" },
    ]);

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: [],
      proposedTopicNames: ["個人金融與帳戶管理", "個人採購與訂閱管理", "兒童福利與教育"],
    });

    // t1 保留（在 proposed 中）
    // t2, t3, t4, t5 刪除（不在 proposed 也不在 operated）
    expect(result.deletedTopics).toEqual([
      "個人健康與保健",
      "個人安全與健康",
      "個人安全防護",
      "個人網路安全",
    ]);

    // 確認 topic.update 被呼叫了 4 次（soft delete）
    expect(db.topic.update).toHaveBeenCalledTimes(4);
    for (const call of db.topic.update.mock.calls) {
      expect(call[0].data.deleted_at).toBeInstanceOf(Date);
    }
  });

  it("應該保留 operated 中的 topic（即使不在 proposed）", async () => {
    const db = createMockDb([
      { id: "t1", name: "舊主題A" },
      { id: "t2", name: "舊主題B" },
    ]);

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: ["t1"],  // t1 被 rename/merge 操作過
      proposedTopicNames: ["新主題X"],
    });

    // t1 保留（在 operated）, t2 刪除
    expect(result.deletedTopics).toEqual(["舊主題B"]);
    expect(db.topic.update).toHaveBeenCalledTimes(1);
  });

  it("如果舊 topic 有殘留 task，應先移到未分類再刪除 topic", async () => {
    const db = createMockDb(
      [
        { id: "t1", name: "舊主題" },
        { id: "t2", name: "新主題" },
      ],
      { t1: 2 },  // t1 有 2 個殘留 task
    );

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: [],
      proposedTopicNames: ["新主題"],
    });

    // t1 被刪除
    expect(result.deletedTopics).toEqual(["舊主題"]);

    // 殘留 task 被移到未分類（topic_id: null）
    expect(db.task.updateMany).toHaveBeenCalledWith({
      where: { topic_id: "t1", deleted_at: null, status: { not: "ARCHIVE" } },
      data: { topic_id: null },
    });

    // topic 被軟刪除
    expect(db.topic.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { deleted_at: expect.any(Date) },
    });
  });

  it("如果舊 topic 沒有殘留 task，直接刪除不呼叫 task.updateMany", async () => {
    const db = createMockDb(
      [{ id: "t1", name: "空主題" }],
      { t1: 0 },
    );

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: [],
      proposedTopicNames: [],
    });

    expect(result.deletedTopics).toEqual(["空主題"]);
    expect(db.task.updateMany).not.toHaveBeenCalled();
    expect(db.topic.update).toHaveBeenCalledTimes(1);
  });

  it("所有 topic 都在 proposed 中時不刪除任何 topic", async () => {
    const db = createMockDb([
      { id: "t1", name: "主題A" },
      { id: "t2", name: "主題B" },
    ]);

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: [],
      proposedTopicNames: ["主題A", "主題B"],
    });

    expect(result.deletedTopics).toEqual([]);
    expect(db.topic.update).not.toHaveBeenCalled();
  });

  it("模擬真實場景：8 個舊 topic → 3 個 proposed，應刪除 5 個", async () => {
    const db = createMockDb([
      { id: "t1", name: "個人金融與帳戶管理" },
      { id: "t2", name: "個人健康與保健" },
      { id: "t3", name: "個人安全與健康" },
      { id: "t4", name: "個人安全防護" },
      { id: "t5", name: "個人網路安全" },
      { id: "t6", name: "個人採購與訂閱管理" },
      { id: "t7", name: "兒童福利與教育" },
      { id: "t8", name: "家庭行政" },
    ], {
      // t8 有 1 個被 AI 漏掉的 task
      t8: 1,
    });

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: [],
      proposedTopicNames: ["個人金融與帳戶管理", "個人採購與訂閱管理", "兒童福利與教育"],
    });

    // t1, t6, t7 保留（在 proposed）
    // t2, t3, t4, t5, t8 刪除
    expect(result.deletedTopics).toEqual([
      "個人健康與保健",
      "個人安全與健康",
      "個人安全防護",
      "個人網路安全",
      "家庭行政",
    ]);

    // t8 有殘留 task → 先 updateMany 移到未分類
    expect(db.task.updateMany).toHaveBeenCalledTimes(1);
    expect(db.task.updateMany).toHaveBeenCalledWith({
      where: { topic_id: "t8", deleted_at: null, status: { not: "ARCHIVE" } },
      data: { topic_id: null },
    });

    // 5 個 topic 被軟刪除
    expect(db.topic.update).toHaveBeenCalledTimes(5);
  });

  it("keep 的 topic 不在 proposed 中時應被刪除（不應放入 operatedTopicIds）", async () => {
    // 模擬 AI 回了 keep 但 topic 不在 proposed_clusters 中
    // keep 的 topic 不應加到 operatedTopicIds，所以這裡 operatedTopicIds 不包含它
    const db = createMockDb([
      { id: "t1", name: "Aura 功能開發" },        // AI 說 keep，但不在 proposed
      { id: "t2", name: "Zentropy 功能開發" },     // AI 說 keep，但不在 proposed
      { id: "t3", name: "Zentropy App 功能開發" }, // 在 proposed
    ]);

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      // rename/merge 的 topic 才會在 operatedTopicIds 中，keep 的不在
      operatedTopicIds: [],
      proposedTopicNames: ["Zentropy App 功能開發"],
    });

    // t1, t2 被刪除（keep 但不在 proposed）
    expect(result.deletedTopics).toEqual(["Aura 功能開發", "Zentropy 功能開發"]);
    expect(db.topic.update).toHaveBeenCalledTimes(2);
  });

  it("rename/merge 的 topic 即使不在 proposed 中也應保留（在 operatedTopicIds）", async () => {
    const db = createMockDb([
      { id: "t1", name: "新名字" },  // rename 後的 topic
      { id: "t2", name: "舊主題" },  // 不相關的舊 topic
    ]);

    const result = await cleanupZombieTopics(db, {
      productId: "product-1",
      operatedTopicIds: ["t1"],  // rename 操作過
      proposedTopicNames: ["新名字"],
    });

    // t2 被刪除，t1 保留
    expect(result.deletedTopics).toEqual(["舊主題"]);
  });
});
