import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { customerIdArg } from './shared.js';

/**
 * 전용 툴이 아직 없는 엔드포인트를 위한 탈출구.
 *
 * 검색광고 API는 엔드포인트가 많아 전부를 툴로 감싸기까지 시간이 걸린다.
 * GET만 허용해 조회 전용 원칙은 그대로 유지한다.
 */
export function registerRawTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'naver_ads_get',
    title: '임의 엔드포인트 GET 호출',
    description:
      '전용 툴이 없는 네이버 검색광고 API 엔드포인트를 직접 GET 호출합니다. 전용 툴(list_campaigns, get_stats 등)이 있으면 그쪽을 쓰세요. 이 툴은 /ncc/labels 처럼 아직 감싸지 않은 경로용입니다. 엔드포인트 명세는 https://naver.github.io/searchad-apidoc 을 참고하세요.',
    inputSchema: z.object({
      path: z
        .string()
        .regex(/^\/[^\s?#]*$/, 'path는 /로 시작하고 쿼리스트링(?)을 포함하지 않아야 합니다.')
        .describe('호출할 경로. 예: /ncc/labels'),
      query: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('쿼리 파라미터. 값이 JSON이어야 하는 파라미터는 직렬화된 문자열로 넣으세요.'),
      customerId: customerIdArg,
    }),
    run: ({ path, query, customerId }) => client.get(path, query, { customerId }),
  });
}
