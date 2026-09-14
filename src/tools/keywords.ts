import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { customerIdArg } from './shared.js';

export function registerKeywordTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'list_keywords',
    title: '키워드 목록 조회',
    description:
      '광고그룹에 등록된 키워드 목록과 입찰가·상태를 조회합니다. 노출·클릭·비용 같은 성과 지표는 포함되지 않으므로 get_stats를 함께 쓰세요.',
    inputSchema: z.object({
      adgroupId: z
        .string()
        .min(1)
        .describe('조회할 광고그룹의 nccAdgroupId. list_adgroups로 먼저 확인하세요.'),
      customerId: customerIdArg,
    }),
    run: ({ adgroupId, customerId }) =>
      client.get('/ncc/keywords', { nccAdgroupId: adgroupId }, { customerId }),
  });

  registerReadTool(server, {
    name: 'get_keyword',
    title: '키워드 단건 조회',
    description: 'nccKeywordId로 키워드 하나의 상세 정보를 조회합니다.',
    inputSchema: z.object({
      keywordId: z.string().min(1).describe('nccKeywordId (예: nkw-a001-01-000000123456789)'),
      customerId: customerIdArg,
    }),
    run: ({ keywordId, customerId }) =>
      client.get(`/ncc/keywords/${encodeURIComponent(keywordId)}`, undefined, { customerId }),
  });

  registerReadTool(server, {
    name: 'get_related_keywords',
    title: '연관 키워드 및 검색량 조회',
    description:
      '키워드도구 API로 힌트 키워드의 연관 키워드와 월간 검색수·클릭수·경쟁정도를 조회합니다. 광고 등록 여부와 무관하게 조회할 수 있어 키워드 발굴에 씁니다. 힌트는 최대 5개입니다.',
    inputSchema: z.object({
      hintKeywords: z
        .array(z.string().min(1))
        .min(1)
        .max(5)
        .describe('연관 키워드를 뽑을 기준 키워드. 공백 없이 넣는 편이 결과가 좋습니다.'),
      showDetail: z.boolean().default(true).describe('월간 검색수·클릭수 등 상세 지표 포함 여부.'),
      customerId: customerIdArg,
    }),
    run: ({ hintKeywords, showDetail, customerId }) =>
      client.get(
        '/keywordstool',
        { hintKeywords: hintKeywords.join(','), showDetail: showDetail ? 1 : 0 },
        { customerId },
      ),
  });
}
