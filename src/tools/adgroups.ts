import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { customerIdArg } from './shared.js';

export function registerAdgroupTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'list_adgroups',
    title: '광고그룹 목록 조회',
    description:
      '캠페인에 속한 광고그룹 목록을 조회합니다. 광고그룹은 입찰가·소재·키워드를 묶는 단위입니다. campaignId를 생략하면 광고계정 전체 광고그룹을 조회합니다.',
    inputSchema: z.object({
      campaignId: z
        .string()
        .optional()
        .describe('조회할 캠페인의 nccCampaignId. list_campaigns로 먼저 확인하세요.'),
      adgroupIds: z
        .array(z.string())
        .max(100)
        .optional()
        .describe('특정 광고그룹만 조회할 때의 nccAdgroupId 목록.'),
      customerId: customerIdArg,
    }),
    run: ({ campaignId, adgroupIds, customerId }) =>
      client.get(
        '/ncc/adgroups',
        { nccCampaignId: campaignId, nccAdgroupIdList: adgroupIds },
        { customerId },
      ),
  });

  registerReadTool(server, {
    name: 'get_adgroup',
    title: '광고그룹 단건 조회',
    description: 'nccAdgroupId로 광고그룹 하나의 상세 정보를 조회합니다.',
    inputSchema: z.object({
      adgroupId: z.string().min(1).describe('nccAdgroupId (예: grp-a001-01-000000012345678)'),
      customerId: customerIdArg,
    }),
    run: ({ adgroupId, customerId }) =>
      client.get(`/ncc/adgroups/${encodeURIComponent(adgroupId)}`, undefined, { customerId }),
  });

  registerReadTool(server, {
    name: 'get_adgroup_targets',
    title: '광고그룹 타게팅 조회',
    description: '광고그룹에 설정된 타게팅(요일·시간, 지역, 매체, PC/모바일 등)을 조회합니다.',
    inputSchema: z.object({
      adgroupId: z.string().min(1).describe('nccAdgroupId'),
      customerId: customerIdArg,
    }),
    run: ({ adgroupId, customerId }) =>
      client.get(`/ncc/adgroups/${encodeURIComponent(adgroupId)}/targets`, undefined, {
        customerId,
      }),
  });
}
