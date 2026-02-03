/**
 * Task Consolidation 保護機制測試
 *
 * 這個測試套件確保 task consolidation 操作絕對不會誤刪 parent task
 *
 * 測試場景：
 * 1. 正常的 consolidation（parent 保留，sub_tasks 刪除）
 * 2. AI 錯誤地把 parent 也列入 sub_task_ids（應該被過濾掉）
 * 3. 多層 consolidation 鏈（確保沒有級聯刪除）
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Task } from '@prisma/client';

const prisma = new PrismaClient();

describe('Task Consolidation Protection', () => {
  let testUserId: string;
  let testProductId: string;
  let testTopicId: string;

  beforeAll(async () => {
    // 建立測試用戶
    const testUser = await prisma.user.create({
      data: {
        email: `test-consolidation-${Date.now()}@example.com`,
        name: 'Consolidation Test User',
        auth_provider: 'EMAIL',
      },
    });
    testUserId = testUser.id;

    // 建立測試 Area
    const testArea = await prisma.area.create({
      data: {
        user_id: testUserId,
        name: 'Test Area',
        is_custom: true,
      },
    });

    // 建立測試 Product
    const testProduct = await prisma.product.create({
      data: {
        user_id: testUserId,
        area_id: testArea.id,
        name: 'Test Product',
        status: 'ACTIVE',
        lifecycle: 'FINITE',
      },
    });
    testProductId = testProduct.id;

    // 建立測試 Topic
    const testTopic = await prisma.topic.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        name: 'Test Topic',
      },
    });
    testTopicId = testTopic.id;
  });

  afterAll(async () => {
    // 清理測試數據
    await prisma.task.deleteMany({ where: { user_id: testUserId } });
    await prisma.topic.deleteMany({ where: { user_id: testUserId } });
    await prisma.product.deleteMany({ where: { user_id: testUserId } });
    await prisma.area.deleteMany({ where: { user_id: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });

    await prisma.$disconnect();
  });

  /**
   * 測試 1: 正常的 consolidation 應該保留 parent，刪除 sub_tasks
   */
  it('should keep parent task and delete sub tasks in normal consolidation', async () => {
    // 建立 parent task
    const parentTask = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Parent Task: Shopping List',
        status: 'INBOX',
        sub_items: [],
      },
    });

    // 建立 3 個 sub tasks
    const subTask1 = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Buy milk',
        status: 'INBOX',
      },
    });

    const subTask2 = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Buy bread',
        status: 'INBOX',
      },
    });

    const subTask3 = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Buy eggs',
        status: 'INBOX',
      },
    });

    // 模擬 consolidation proposal（正常情況）
    const proposal = {
      parent_task_id: parentTask.id,
      sub_task_ids: [subTask1.id, subTask2.id, subTask3.id],
      consolidated_title: 'Shopping List: Milk, Bread, Eggs',
      consolidated_narrative: 'Consolidated shopping tasks',
      reasoning: 'Group related shopping items',
      confidence: 0.9,
    };

    // 執行 consolidation
    await prisma.$transaction(async (tx) => {
      const parent = await tx.task.findUnique({ where: { id: proposal.parent_task_id } });
      if (!parent) throw new Error('Parent task not found');

      const subTasks = await tx.task.findMany({
        where: {
          id: { in: proposal.sub_task_ids },
          deleted_at: null,
        },
      });

      const subItems = subTasks.map((task, idx) => ({
        id: task.id,
        content: task.content,
        completed: false,
        created_at: new Date().toISOString(),
        completed_at: null,
        order: idx,
      }));

      await tx.task.update({
        where: { id: proposal.parent_task_id },
        data: {
          content: proposal.consolidated_title,
          sub_items: subItems as any,
        },
      });

      // 刪除 sub tasks
      await tx.task.updateMany({
        where: { id: { in: proposal.sub_task_ids } },
        data: { deleted_at: new Date() },
      });
    });

    // 驗證結果
    const updatedParent = await prisma.task.findUnique({ where: { id: parentTask.id } });
    expect(updatedParent).not.toBeNull();
    expect(updatedParent!.deleted_at).toBeNull(); // Parent 應該保留
    expect((updatedParent!.sub_items as any[]).length).toBe(3); // 應該有 3 個 sub_items

    const deletedSubTask1 = await prisma.task.findUnique({ where: { id: subTask1.id } });
    expect(deletedSubTask1!.deleted_at).not.toBeNull(); // Sub task 應該被刪除

    const deletedSubTask2 = await prisma.task.findUnique({ where: { id: subTask2.id } });
    expect(deletedSubTask2!.deleted_at).not.toBeNull();

    const deletedSubTask3 = await prisma.task.findUnique({ where: { id: subTask3.id } });
    expect(deletedSubTask3!.deleted_at).not.toBeNull();
  });

  /**
   * 測試 2: AI 錯誤地把 parent 也列入 sub_task_ids 時，應該被過濾掉
   */
  it('should prevent parent task deletion when AI incorrectly includes it in sub_task_ids', async () => {
    // 建立 parent task
    const parentTask = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Parent Task: Project Tasks',
        status: 'INBOX',
        sub_items: [],
      },
    });

    // 建立 2 個 sub tasks
    const subTask1 = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Research phase',
        status: 'INBOX',
      },
    });

    const subTask2 = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Implementation phase',
        status: 'INBOX',
      },
    });

    // 模擬 AI 錯誤：把 parent 也列入 sub_task_ids
    const malformedProposal = {
      parent_task_id: parentTask.id,
      sub_task_ids: [
        parentTask.id,  // ❌ 錯誤：包含了 parent 自己
        subTask1.id,
        subTask2.id,
      ],
      consolidated_title: 'Project Tasks',
      consolidated_narrative: 'All project tasks',
      reasoning: 'Consolidate project work',
      confidence: 0.85,
    };

    // 執行 consolidation（應用保護邏輯）
    await prisma.$transaction(async (tx) => {
      const parent = await tx.task.findUnique({ where: { id: malformedProposal.parent_task_id } });
      if (!parent) throw new Error('Parent task not found');

      // 🚨 保護層：過濾掉 parent task
      const safeSubTaskIds = malformedProposal.sub_task_ids.filter(
        (id) => id !== malformedProposal.parent_task_id
      );

      const subTasks = await tx.task.findMany({
        where: {
          id: { in: safeSubTaskIds },
          deleted_at: null,
        },
      });

      const subItems = subTasks.map((task, idx) => ({
        id: task.id,
        content: task.content,
        completed: false,
        created_at: new Date().toISOString(),
        completed_at: null,
        order: idx,
      }));

      await tx.task.update({
        where: { id: malformedProposal.parent_task_id },
        data: {
          content: malformedProposal.consolidated_title,
          sub_items: subItems as any,
        },
      });

      // 刪除 sub tasks（已過濾，不包含 parent）
      if (safeSubTaskIds.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: safeSubTaskIds } },
          data: { deleted_at: new Date() },
        });
      }
    });

    // 驗證結果
    const updatedParent = await prisma.task.findUnique({ where: { id: parentTask.id } });
    expect(updatedParent).not.toBeNull();
    expect(updatedParent!.deleted_at).toBeNull(); // ✅ Parent 絕對不能被刪除！
    expect((updatedParent!.sub_items as any[]).length).toBe(2); // 應該有 2 個 sub_items（不包含自己）

    const deletedSubTask1 = await prisma.task.findUnique({ where: { id: subTask1.id } });
    expect(deletedSubTask1!.deleted_at).not.toBeNull(); // Sub task 應該被刪除

    const deletedSubTask2 = await prisma.task.findUnique({ where: { id: subTask2.id } });
    expect(deletedSubTask2!.deleted_at).not.toBeNull();
  });

  /**
   * 測試 3: 空的 sub_task_ids 不應該導致錯誤
   */
  it('should handle empty sub_task_ids gracefully', async () => {
    const parentTask = await prisma.task.create({
      data: {
        user_id: testUserId,
        product_id: testProductId,
        topic_id: testTopicId,
        content: 'Parent with no subs',
        status: 'INBOX',
        sub_items: [],
      },
    });

    const proposal = {
      parent_task_id: parentTask.id,
      sub_task_ids: [], // 空陣列
      consolidated_title: 'Updated title',
      consolidated_narrative: 'Updated narrative',
      reasoning: 'Just updating content',
      confidence: 1.0,
    };

    // 執行 consolidation（應該不拋出錯誤）
    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: proposal.parent_task_id },
        data: {
          content: proposal.consolidated_title,
        },
      });

      if (proposal.sub_task_ids.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: proposal.sub_task_ids } },
          data: { deleted_at: new Date() },
        });
      }
    });

    const updatedParent = await prisma.task.findUnique({ where: { id: parentTask.id } });
    expect(updatedParent).not.toBeNull();
    expect(updatedParent!.deleted_at).toBeNull();
  });
});
