/**
 * Zentropy MCP Server 完整測試客戶端
 *
 * 測試遠端 MCP Server 的完整功能
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = 'https://api.zentropy.cc/mcp';

async function testMcpServer() {
  console.log('==========================================');
  console.log('Zentropy MCP Server 測試');
  console.log('==========================================\n');

  try {
    // 建立 Transport
    console.log('1️⃣  建立連線到:', MCP_URL);
    const transport = new StreamableHTTPClientTransport({
      url: MCP_URL,
    });

    // 建立 Client
    const client = new Client({
      name: 'test-client',
      version: '1.0.0',
    }, {
      capabilities: {
        roots: {
          listChanged: false,
        },
      },
    });

    // 連接
    console.log('   連接中...\n');
    await client.connect(transport);
    console.log('   ✅ 連接成功！\n');

    // 2. 列出所有 Tools
    console.log('2️⃣  列出所有 Tools');
    console.log('---');
    const tools = await client.listTools();
    if (tools.tools && tools.tools.length > 0) {
      tools.tools.forEach((tool) => {
        console.log(`   📦 ${tool.name}`);
        console.log(`      ${tool.description}`);
      });
    } else {
      console.log('   ⚠️  沒有可用的 tools');
    }
    console.log('');

    // 3. 列出所有 Resources
    console.log('3️⃣  列出所有 Resources');
    console.log('---');
    const resources = await client.listResources();
    if (resources.resources && resources.resources.length > 0) {
      resources.resources.forEach((resource) => {
        console.log(`   📚 ${resource.name || resource.uri}`);
        console.log(`      URI: ${resource.uri}`);
        if (resource.description) {
          console.log(`      ${resource.description}`);
        }
      });
    } else {
      console.log('   ⚠️  沒有可用的 resources');
    }
    console.log('');

    // 4. 測試 capture tool
    console.log('4️⃣  測試 capture tool（捕捉想法）');
    console.log('---');
    try {
      const captureResult = await client.callTool('capture', {
        content: '測試從遠端 MCP 捕捉想法 - ' + new Date().toISOString(),
        source: 'test-client',
        mode: 'thought',
      });
      console.log('   ✅ capture 成功：');
      console.log('   ', JSON.stringify(captureResult, null, 2));
    } catch (error) {
      console.error('   ❌ capture 失敗:', error instanceof Error ? error.message : error);
    }
    console.log('');

    // 5. 讀取 handoff-ready Resource
    console.log('5️⃣  讀取 handoff-ready Resource');
    console.log('---');
    try {
      const handoffResult = await client.readResource('zentropy://handoff/ready');
      console.log('   ✅ handoff-ready 讀取成功：');
      if (handoffResult.contents && handoffResult.contents.length > 0) {
        const content = handoffResult.contents[0];
        if (content.text) {
          try {
            const parsed = JSON.parse(content.text);
            console.log('   ', JSON.stringify(parsed, null, 2));
          } catch {
            console.log('   ', content.text);
          }
        }
      }
    } catch (error) {
      console.error('   ❌ handoff-ready 讀取失敗:', error instanceof Error ? error.message : error);
    }
    console.log('');

    // 6. 讀取 context-now Resource
    console.log('6️⃣  讀取 context-now Resource（全局狀態）');
    console.log('---');
    try {
      const contextResult = await client.readResource('zentropy://context/now');
      console.log('   ✅ context-now 讀取成功：');
      if (contextResult.contents && contextResult.contents.length > 0) {
        const content = contextResult.contents[0];
        if (content.text) {
          try {
            const parsed = JSON.parse(content.text);
            console.log('   ', JSON.stringify(parsed, null, 2));
          } catch {
            console.log('   ', content.text);
          }
        }
      }
    } catch (error) {
      console.error('   ❌ context-now 讀取失敗:', error instanceof Error ? error.message : error);
    }
    console.log('');

    // 關閉連線
    await client.close();
    console.log('==========================================');
    console.log('測試完成！');
    console.log('==========================================');

  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testMcpServer();
