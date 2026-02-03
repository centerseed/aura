import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const USER_ID = '467c7125-d890-429f-b46f-168429b1907e'; // 吳柏宗 (centerseedwu@gmail.com)

async function restoreTasks() {
  try {
    console.log('🔍 查詢用戶的 Areas 和 Products...\n');

    // 查詢所有 Areas 和 Products
    const areas = await prisma.area.findMany({
      where: { user_id: USER_ID, deleted_at: null },
      include: {
        products: {
          where: { deleted_at: null },
          include: {
            topics: {
              where: { deleted_at: null }
            }
          }
        }
      }
    });

    console.log(`找到 ${areas.length} 個 Areas:\n`);
    for (const area of areas) {
      console.log(`📁 Area: ${area.name}`);
      console.log(`   Products: ${area.products.length}`);
      for (const product of area.products) {
        console.log(`   📦 ${product.name}`);
        console.log(`      Topics: ${product.topics.map(t => t.name).join(', ') || '(無)'}`);
      }
      console.log('');
    }

    // 開始重建 Tasks
    console.log('🔨 開始重建 Tasks...\n');

    // ============================================================================
    // Area: 事業
    // ============================================================================
    const areaWork = areas.find(a => a.name === '事業');
    if (!areaWork) {
      console.error('❌ 找不到「事業」Area');
      return;
    }

    // ----------------------------------------------------------------------------
    // Product: Zentropy
    // ----------------------------------------------------------------------------
    const productZentropy = areaWork.products.find(p => p.name === 'Zentropy');
    if (productZentropy) {
      console.log('📦 重建 Zentropy 的 Tasks...');

      // 找到或創建 Topics
      let topicZentropyDev = productZentropy.topics.find(t => t.name === 'Zentropy 功能開發');
      if (!topicZentropyDev) {
        topicZentropyDev = await prisma.topic.create({
          data: {
            user_id: USER_ID,
            product_id: productZentropy.id,
            name: 'Zentropy 功能開發'
          }
        });
      }

      let topicProjectMgmt = productZentropy.topics.find(t => t.name === '專案管理與規劃');
      if (!topicProjectMgmt) {
        topicProjectMgmt = await prisma.topic.create({
          data: {
            user_id: USER_ID,
            product_id: productZentropy.id,
            name: '專案管理與規劃'
          }
        });
      }

      // Task 1: App repo module整合
      const dueDate1 = new Date();
      dueDate1.setDate(dueDate1.getDate() + 5);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productZentropy.id,
          topic_id: topicZentropyDev.id,
          content: 'App repo module整合',
          status: 'ACTIVE',
          due_date: dueDate1
        }
      });
      console.log('   ✅ App repo module整合');

      // Task 2: Zentropy 架構可重用 App Repo 層
      const dueDate2 = new Date();
      dueDate2.setDate(dueDate2.getDate() + 5);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productZentropy.id,
          topic_id: topicZentropyDev.id,
          content: 'Zentropy 架構可重用 App Repo 層',
          status: 'ACTIVE',
          due_date: dueDate2
        }
      });
      console.log('   ✅ Zentropy 架構可重用 App Repo 層');

      // Task 3: 設計 Zentropy 核心記憶層
      const dueDate3 = new Date();
      dueDate3.setDate(dueDate3.getDate() + 5);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productZentropy.id,
          topic_id: topicZentropyDev.id,
          content: '設計 Zentropy 核心記憶層',
          status: 'ACTIVE',
          due_date: dueDate3,
          sub_items: [
            { id: crypto.randomUUID(), content: '規劃記憶層架構', completed: false },
            { id: crypto.randomUUID(), content: '實作POC', completed: false },
            { id: crypto.randomUUID(), content: '驗證效果', completed: false }
          ]
        }
      });
      console.log('   ✅ 設計 Zentropy 核心記憶層 (含 3 個 sub-items)');

      // Task 4: Zentropy 圖片輸入功能開發
      const dueDate4 = new Date();
      dueDate4.setDate(dueDate4.getDate() + 21);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productZentropy.id,
          topic_id: topicZentropyDev.id,
          content: 'Zentropy 圖片輸入功能開發',
          status: 'ACTIVE',
          due_date: dueDate4,
          sub_items: [
            { id: crypto.randomUUID(), content: '實現圖片上傳與顯示', completed: false },
            { id: crypto.randomUUID(), content: '整合 OCR 辨識引擎', completed: false },
            { id: crypto.randomUUID(), content: '將 OCR 結果轉換為 task/todo list', completed: false }
          ]
        }
      });
      console.log('   ✅ Zentropy 圖片輸入功能開發 (含 3 個 sub-items)');

      // Task 5: Zentropy MVP 功能開發
      const dueDate5 = new Date();
      dueDate5.setDate(dueDate5.getDate() + 21);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productZentropy.id,
          topic_id: topicZentropyDev.id,
          content: 'Zentropy MVP 功能開發',
          status: 'ACTIVE',
          due_date: dueDate5,
          sub_items: [
            { id: crypto.randomUUID(), content: '連結 Google 日曆', completed: false },
            { id: crypto.randomUUID(), content: '圖片輸入功能', completed: false },
            { id: crypto.randomUUID(), content: '主動評估 AI 分類/整理的效果', completed: false }
          ]
        }
      });
      console.log('   ✅ Zentropy MVP 功能開發 (含 3 個 sub-items)');

      // Task 6: Zentropy 架構可重用 App Repo 層（專案管理）
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productZentropy.id,
          topic_id: topicProjectMgmt.id,
          content: 'Zentropy 架構可重用 App Repo 層',
          status: 'ACTIVE',
          due_date: null
        }
      });
      console.log('   ✅ Zentropy 架構可重用 App Repo 層（專案管理）');
    }

    // ----------------------------------------------------------------------------
    // Product: Paceriz
    // ----------------------------------------------------------------------------
    const productPaceriz = areaWork.products.find(p => p.name === 'Paceriz');
    if (productPaceriz) {
      console.log('\n📦 重建 Paceriz 的 Tasks...');

      // 找到或創建 Topics
      let topicPacerizV2 = productPaceriz.topics.find(t => t.name.includes('Paceriz v2 課表開發與問題修復'));
      if (!topicPacerizV2) {
        topicPacerizV2 = await prisma.topic.create({
          data: {
            user_id: USER_ID,
            product_id: productPaceriz.id,
            name: 'Paceriz v2 課表開發與問題修復'
          }
        });
      }

      let topicPacerizMethod = productPaceriz.topics.find(t => t.name.includes('Paceriz 方法論測試'));
      if (!topicPacerizMethod) {
        topicPacerizMethod = await prisma.topic.create({
          data: {
            user_id: USER_ID,
            product_id: productPaceriz.id,
            name: 'Paceriz 方法論測試'
          }
        });
      }

      // Task 1: Paceriz v2週課表轉換測試
      const dueDateP1 = new Date();
      dueDateP1.setDate(dueDateP1.getDate() + 21);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productPaceriz.id,
          topic_id: topicPacerizV2.id,
          content: 'Paceriz v2週課表轉換測試',
          status: 'ACTIVE',
          due_date: dueDateP1,
          sub_items: [
            { id: crypto.randomUUID(), content: 'Paceriz v2 課表開發與問題修復', completed: false },
            { id: crypto.randomUUID(), content: 'Paceriz 課表 V2 開發與問題修復', completed: false },
            { id: crypto.randomUUID(), content: 'aaa', completed: false }
          ]
        }
      });
      console.log('   ✅ Paceriz v2週課表轉換測試 (含 3 個 sub-items)');

      // Task 2: Paceriz v2 課表 UI 修正
      const dueDateP2 = new Date();
      dueDateP2.setDate(dueDateP2.getDate() + 21);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productPaceriz.id,
          topic_id: topicPacerizV2.id,
          content: 'Paceriz v2 課表 UI 修正',
          status: 'ACTIVE',
          due_date: dueDateP2,
          sub_items: [
            { id: crypto.randomUUID(), content: 'Paceriz 課表 V2 開發與問題修復', completed: false },
            { id: crypto.randomUUID(), content: 'Paceriz 非跑步訓練UI顯示', completed: false }
          ]
        }
      });
      console.log('   ✅ Paceriz v2 課表 UI 修正 (含 2 個 sub-items)');

      // Task 3: Paceriz 方法論測試
      const dueDateP3 = new Date();
      dueDateP3.setDate(dueDateP3.getDate() + 21);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productPaceriz.id,
          topic_id: topicPacerizMethod.id,
          content: 'Paceriz 方法論測試',
          status: 'ACTIVE',
          due_date: dueDateP3,
          sub_items: [
            { id: crypto.randomUUID(), content: 'Paceriz 方法論測試', completed: false }
          ]
        }
      });
      console.log('   ✅ Paceriz 方法論測試 (含 1 個 sub-item)');
    }

    // ----------------------------------------------------------------------------
    // Product: Fintasy
    // ----------------------------------------------------------------------------
    const productFintasy = areaWork.products.find(p => p.name === 'Fintasy');
    if (productFintasy) {
      console.log('\n📦 重建 Fintasy 的 Tasks...');

      // Task 1: 驗證 Fintasy MVP app
      const dueDateF1 = new Date();
      dueDateF1.setDate(dueDateF1.getDate() + 21);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productFintasy.id,
          topic_id: null,
          content: '驗證 Fintasy MVP app',
          status: 'ACTIVE',
          due_date: dueDateF1
        }
      });
      console.log('   ✅ 驗證 Fintasy MVP app');

      // Task 2: 驗證MVP app
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productFintasy.id,
          topic_id: null,
          content: '驗證MVP app',
          status: 'ACTIVE',
          due_date: null
        }
      });
      console.log('   ✅ 驗證MVP app');
    }

    // ----------------------------------------------------------------------------
    // Product: Miyume
    // ----------------------------------------------------------------------------
    const productMiyume = areaWork.products.find(p => p.name === 'Miyume');
    if (productMiyume) {
      console.log('\n📦 重建 Miyume 的 Tasks...');

      // Task: Miyume 封版與測試
      const dueDateM1 = new Date();
      dueDateM1.setDate(dueDateM1.getDate() + 1);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productMiyume.id,
          topic_id: null,
          content: 'Miyume 封版與測試',
          status: 'ACTIVE',
          due_date: dueDateM1,
          sub_items: [
            { id: crypto.randomUUID(), content: '封版', completed: true },
            { id: crypto.randomUUID(), content: '設定revenuecap和IAP', completed: false },
            { id: crypto.randomUUID(), content: '測試', completed: false }
          ]
        }
      });
      console.log('   ✅ Miyume 封版與測試 (含 3 個 sub-items，1個已完成)');
    }

    // ----------------------------------------------------------------------------
    // Product: 日本代購
    // ----------------------------------------------------------------------------
    const productJPProxy = areaWork.products.find(p => p.name === '日本代購');
    if (productJPProxy) {
      console.log('\n📦 重建 日本代購 的 Tasks...');

      // Task: 準備日本代購士1 on 1
      const dueDateJ1 = new Date();
      dueDateJ1.setDate(dueDateJ1.getDate() + 2);
      await prisma.task.create({
        data: {
          user_id: USER_ID,
          product_id: productJPProxy.id,
          topic_id: null,
          content: '準備日本代購士1 on 1',
          status: 'ACTIVE',
          due_date: dueDateJ1
        }
      });
      console.log('   ✅ 準備日本代購士1 on 1');
    }

    // ============================================================================
    // Area: 人際
    // ============================================================================
    const areaPeople = areas.find(a => a.name === '人際');
    if (areaPeople) {
      const productNetworking = areaPeople.products.find(p => p.name === '人脈經營');
      if (productNetworking) {
        console.log('\n📦 重建 人脈經營 的 Tasks...');

        // Task: 更新BNI 1:1表格
        const dueDateN1 = new Date();
        dueDateN1.setDate(dueDateN1.getDate() + 1);
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productNetworking.id,
            topic_id: null,
            content: '更新BNI 1:1表格',
            status: 'ACTIVE',
            due_date: dueDateN1
          }
        });
        console.log('   ✅ 更新BNI 1:1表格');
      }
    }

    // ============================================================================
    // Area: 個人
    // ============================================================================
    const areaPersonal = areas.find(a => a.name === '個人');
    if (areaPersonal) {
      // ----------------------------------------------------------------------------
      // Product: 個人事務
      // ----------------------------------------------------------------------------
      const productPersonal = areaPersonal.products.find(p => p.name === '個人事務');
      if (productPersonal) {
        console.log('\n📦 重建 個人事務 的 Tasks...');

        // 找到或創建 Topic
        let topicShopping = productPersonal.topics.find(t => t.name === '個人用品採購');
        if (!topicShopping) {
          topicShopping = await prisma.topic.create({
            data: {
              user_id: USER_ID,
              product_id: productPersonal.id,
              name: '個人用品採購'
            }
          });
        }

        // Task: 個人用品採購
        const dueDatePS1 = new Date();
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productPersonal.id,
            topic_id: topicShopping.id,
            content: '個人用品採購：濾水架、菜刀、置物架、枕頭、咖啡器材、鍋碗瓢盆、指甲剪',
            status: 'ACTIVE',
            due_date: dueDatePS1,
            sub_items: [
              { id: crypto.randomUUID(), content: '購買鍋子 杯子碗盤', completed: true },
              { id: crypto.randomUUID(), content: '購買手沖壺', completed: false },
              { id: crypto.randomUUID(), content: '購買指甲剪', completed: true },
              { id: crypto.randomUUID(), content: '購買指甲剪', completed: true },
              { id: crypto.randomUUID(), content: '購買枕頭', completed: true },
              { id: crypto.randomUUID(), content: '購買置物架', completed: false },
              { id: crypto.randomUUID(), content: '購買菜刀', completed: false },
              { id: crypto.randomUUID(), content: '買流理台置物架', completed: false },
              { id: crypto.randomUUID(), content: '個人用品採購：置物架、咖啡器材、枕...', completed: false },
              { id: crypto.randomUUID(), content: '購買濾水架', completed: true },
              { id: crypto.randomUUID(), content: '購買菜刀', completed: true }
            ]
          }
        });
        console.log('   ✅ 個人用品採購 (含 11 個 sub-items，6個已完成)');

        // 找到或創建 Topic: 個人 行政事務
        let topicAdmin = productPersonal.topics.find(t => t.name === '個人 行政事務');
        if (!topicAdmin) {
          topicAdmin = await prisma.topic.create({
            data: {
              user_id: USER_ID,
              product_id: productPersonal.id,
              name: '個人 行政事務'
            }
          });
        }

        // Task: 處理印鑑證明
        const dueDatePS2 = new Date();
        dueDatePS2.setDate(dueDatePS2.getDate() + 3);
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productPersonal.id,
            topic_id: topicAdmin.id,
            content: '處理印鑑證明',
            status: 'ACTIVE',
            due_date: dueDatePS2
          }
        });
        console.log('   ✅ 處理印鑑證明');

        // Task: 申請台灣無筆事證明
        const dueDatePS3 = new Date();
        dueDatePS3.setDate(dueDatePS3.getDate() + 7);
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productPersonal.id,
            topic_id: topicAdmin.id,
            content: '申請台灣無筆事證明',
            status: 'ACTIVE',
            due_date: dueDatePS3
          }
        });
        console.log('   ✅ 申請台灣無筆事證明');

        // 找到或創建 Topic: 個人 健康與保健
        let topicHealth = productPersonal.topics.find(t => t.name === '個人 健康與保健');
        if (!topicHealth) {
          topicHealth = await prisma.topic.create({
            data: {
              user_id: USER_ID,
              product_id: productPersonal.id,
              name: '個人 健康與保健'
            }
          });
        }

        // Task: 購買助眠保健品
        const dueDatePS4 = new Date();
        dueDatePS4.setDate(dueDatePS4.getDate() + 7);
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productPersonal.id,
            topic_id: topicHealth.id,
            content: '購買助眠保健品',
            status: 'ACTIVE',
            due_date: dueDatePS4
          }
        });
        console.log('   ✅ 購買助眠保健品');
      }

      // ----------------------------------------------------------------------------
      // Product: 搬家去日本
      // ----------------------------------------------------------------------------
      const productJPMove = areaPersonal.products.find(p => p.name === '搬家去日本');
      if (productJPMove) {
        console.log('\n📦 重建 搬家去日本 的 Tasks...');

        // 找到或創建 Topic
        let topicJPLife = productJPMove.topics.find(t => t.name === '日本生活行政準備');
        if (!topicJPLife) {
          topicJPLife = await prisma.topic.create({
            data: {
              user_id: USER_ID,
              product_id: productJPMove.id,
              name: '日本生活行政準備'
            }
          });
        }

        // Task 1: 日本生活行政準備：NHK、貸款、醫療、潛規則了解與實際辦理
        const dueDateJP1 = new Date();
        dueDateJP1.setDate(dueDateJP1.getDate() + 5);
        const taskJP = await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productJPMove.id,
            topic_id: topicJPLife.id,
            content: '日本生活行政準備：NHK、貸款、醫療、潛規則了解與實際辦理',
            status: 'ACTIVE',
            due_date: dueDateJP1,
            sub_items: [
              { id: crypto.randomUUID(), content: '區役所地址登記', completed: true },
              { id: crypto.randomUUID(), content: '開日本銀行手機號', completed: true },
              { id: crypto.randomUUID(), content: '開設日本郵局帳戶', completed: false }
            ],
            references: [
              {
                id: crypto.randomUUID(),
                type: 'link',
                title: '樂天門號申請',
                url: '',
                created_at: new Date().toISOString()
              }
            ]
          }
        });
        console.log('   ✅ 日本生活行政準備 (含 3 個 sub-items，2個已完成，1個 reference)');

        // Task 2: 辦理日本學生登記
        await prisma.task.create({
          data: {
            user_id: USER_ID,
            product_id: productJPMove.id,
            topic_id: topicJPLife.id,
            content: '辦理日本學生登記',
            status: 'ACTIVE',
            due_date: null
          }
        });
        console.log('   ✅ 辦理日本學生登記');
      }
    }

    console.log('\n✅ 所有 Tasks 重建完成！');

    // 統計
    const totalTasks = await prisma.task.count({
      where: { user_id: USER_ID, deleted_at: null }
    });
    console.log(`\n📊 統計結果: 共重建 ${totalTasks} 個 Tasks`);

  } catch (error) {
    console.error('❌ 重建失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreTasks();
