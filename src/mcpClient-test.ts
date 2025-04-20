import MCPClient from './mcpClient';
import { mcpServers } from './mcpServers';

/**
 * 运行完整的MCP客户端测试
 */
async function testMCPClient() {
  console.log('===============================');
  console.log('开始MCP客户端测试');
  console.log('===============================');
  
  let mcpClient: MCPClient | null = null;
  
  try {
    // 创建客户端实例
    console.log('创建MCPClient实例...');
    mcpClient = new MCPClient("test-client", "1.0.0");
    
    // 输出服务器配置信息
    console.log('\n--- 服务器配置信息 ---');
    Object.entries(mcpServers).forEach(([key, config]) => {
      console.log(`服务器 "${key}":`);
      console.log(`  URL: ${config.url}`);
      console.log(`  命令: ${config.command || '无'}`);
      console.log(`  参数: ${config.args?.join(' ') || '无'}`);
    });
    
    // 1. 服务器启动测试
    console.log('\n--- 测试一: 服务器启动 ---');
    await mcpClient.startAllServers();
    const runningServers = mcpClient.getRunningServers();
    console.log(`已启动 ${runningServers.length} 个服务器: ${runningServers.join(', ')}`);
    
    if (runningServers.length === 0) {
      throw new Error('没有服务器成功启动，无法继续测试');
    }
    
    // 2. 服务器连接测试
    console.log('\n--- 测试二: 服务器连接 ---');
    for (const serverKey of runningServers) {
      try {
        console.log(`尝试连接到服务器 "${serverKey}"...`);
        await mcpClient.connectToServer(serverKey);
        console.log(`✓ 成功连接到服务器 "${serverKey}"`);
      } catch (error) {
        console.error(`✗ 连接到服务器 "${serverKey}" 失败:`, error);
      }
    }
    
    const connectedServers = mcpClient.getConnectedServers();
    console.log(`已连接 ${connectedServers.length} 个服务器: ${connectedServers.join(', ')}`);
    
    if (connectedServers.length === 0) {
      throw new Error('没有服务器成功连接，无法继续测试');
    }
    
    // 3. 基本功能测试
    console.log('\n--- 测试三: 基本功能测试 ---');
    for (const serverKey of connectedServers) {
      console.log(`\n测试服务器 "${serverKey}" 的基本功能:`);
      
      // 测试列出资源
      try {
        console.log('  获取资源列表...');
        const resources = await mcpClient.listResources(serverKey);
        console.log(`  ✓ 成功获取 ${resources.resources?.length || 0} 个资源`);
      } catch (error) {
        console.error('  ✗ 获取资源列表失败:', error);
      }
      
      // 测试列出提示
      try {
        console.log('  获取提示列表...');
        const prompts = await mcpClient.listPrompts(serverKey);
        console.log(`  ✓ 成功获取 ${prompts.prompts?.length || 0} 个提示`);
      } catch (error) {
        console.error('  ✗ 获取提示列表失败:', error);
      }
      
      // 测试列出工具
      try {
        console.log('  获取工具列表...');
        const toolsResponse = await mcpClient.listTools(serverKey);
        const tools = toolsResponse.tools || [];
        console.log(`  ✓ 成功获取 ${tools.length} 个工具`);
        
        // 输出工具详情
        if (tools.length > 0) {
          console.log('  可用工具:');
          const toolsWithSource = tools.map(tool => ({
            name: `${serverKey}.${tool.name}`,
            description: tool.description || '',
            parameters: tool.inputSchema || {},
            sourceServer: serverKey
          }));
          toolsWithSource.forEach(tool => {
            console.log(`    - ${tool.name}: ${tool.description || '无描述'}`);
          });
        }
      } catch (error) {
        console.error('  ✗ 获取工具列表失败:', error);
      }
    }
    
    // 4. 工具收集测试
    console.log('\n--- 测试四: 收集所有服务器工具 ---');
    try {
      const allTools = await mcpClient.collectToolsFromAllServers();
      console.log(`从所有服务器收集到 ${allTools.length} 个工具`);
      
      // 按服务器分组显示工具
      const toolsByServer = (allTools as Array<{
        name: string;
        description: string;
        parameters: any;
        sourceServer: string;
      }>).reduce((acc, tool) => {
        acc[tool.sourceServer] = acc[tool.sourceServer] || [];
        acc[tool.sourceServer].push(tool.name);
        return acc;
      }, {} as Record<string, string[]>);
      
      Object.entries(toolsByServer).forEach(([server, tools]) => {
        console.log(`  服务器 "${server}": ${tools.join(', ')}`);
      });
    } catch (error) {
      console.error('收集所有工具失败:', error);
    }
    
    // 5. 连接状态检查
    console.log('\n--- 测试五: 连接状态检查 ---');
    console.log(`已连接服务器: ${mcpClient.getConnectedServers().join(', ')}`);
    console.log(`运行中服务器: ${mcpClient.getRunningServers().join(', ')}`);
    
  } catch (error) {
    console.error('\n*** 测试过程中出错 ***');
    console.error(error);
  } finally {
    // 资源清理
    console.log('\n--- 清理资源 ---');
    
    if (mcpClient) {
      // 断开所有连接
      try {
        console.log('断开所有连接...');
        // 获取所有已连接的服务器并逐个断开
        const connectedServers = mcpClient.getConnectedServers();
        for (const serverKey of connectedServers) {
          await mcpClient.disconnect(serverKey);
          console.log(`✓ 已断开服务器 ${serverKey} 的连接`);
        }
      } catch (error) {
        console.error('✗ 断开连接失败:', error);
      }
      
      // 停止所有服务器
      try {
        console.log('停止所有服务器...');
        await mcpClient.stopAllServers();
        console.log('✓ 已停止所有服务器');
      } catch (error) {
        console.error('✗ 停止服务器失败:', error);
      }
    }
    
    console.log('\n===============================');
    console.log('MCP客户端测试完成');
    console.log('===============================');
  }
}

// 运行测试
testMCPClient().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});