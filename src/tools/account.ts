import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { customerIdArg } from './shared.js';

export function registerAccountTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'list_business_channels',
    title: '비즈채널 목록 조회',
    description:
      '광고계정에 등록된 비즈채널(웹사이트, 전화번호, 네이버 톡톡, 쇼핑몰 등)을 조회합니다. 광고그룹이 연결하는 대상입니다.',
    inputSchema: z.object({ customerId: customerIdArg }),
    run: ({ customerId }) => client.get('/ncc/channels', undefined, { customerId }),
  });

  registerReadTool(server, {
    name: 'list_customer_links',
    title: '연결된 광고계정 조회',
    description:
      '대행사·광고주 간 연결된 광고계정 목록을 조회합니다. 여기서 얻은 customerId를 다른 툴의 customerId 인자로 넘겨 여러 계정을 오갈 수 있습니다.',
    inputSchema: z.object({
      type: z.string().optional().describe('연결 유형 필터. 생략하면 전체를 조회합니다.'),
      customerId: customerIdArg,
    }),
    run: ({ type, customerId }) => client.get('/customer-links', { type }, { customerId }),
  });
}
