import { McpServer } from '@modelcontextprotocol/server';

import type { NaverAdsConfig } from './config.js';
import { NaverAdsClient } from './naver/client.js';
import { registerAllTools } from './tools/index.js';
import { SERVER_VERSION } from './version.js';

export const SERVER_NAME = 'naver-ads-mcp';

/**
 * 툴이 모두 등록된 MCP 서버 인스턴스를 만든다.
 *
 * `serveStdio`는 연결마다 팩토리를 호출하므로 이 함수는 여러 번 불릴 수 있다.
 * 설정 로드와 검증은 바깥에서 한 번만 하고, 여기서는 조립만 한다.
 */
export function createServer(config: NaverAdsConfig): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: '네이버 검색광고' },
    { capabilities: { tools: {} } },
  );

  registerAllTools(server, new NaverAdsClient(config));

  return server;
}
