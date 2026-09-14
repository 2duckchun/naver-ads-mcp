import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { customerIdArg } from './shared.js';

export function registerCampaignTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'list_campaigns',
    title: '캠페인 목록 조회',
    description:
      '광고계정의 캠페인 목록을 조회합니다. 캠페인은 파워링크·쇼핑검색·파워컨텐츠 등 광고 유형과 예산을 관리하는 최상위 단위입니다. 반환되는 nccCampaignId는 list_adgroups의 입력값이 됩니다.',
    inputSchema: z.object({
      campaignIds: z
        .array(z.string())
        .max(100)
        .optional()
        .describe('특정 캠페인만 조회할 때의 nccCampaignId 목록. 생략하면 전체를 조회합니다.'),
      customerId: customerIdArg,
    }),
    run: ({ campaignIds, customerId }) =>
      client.get('/ncc/campaigns', { nccCampaignIdList: campaignIds }, { customerId }),
  });

  registerReadTool(server, {
    name: 'get_campaign',
    title: '캠페인 단건 조회',
    description: 'nccCampaignId로 캠페인 하나의 상세 정보를 조회합니다.',
    inputSchema: z.object({
      campaignId: z.string().min(1).describe('nccCampaignId (예: cmp-a001-01-000000001234567)'),
      customerId: customerIdArg,
    }),
    run: ({ campaignId, customerId }) =>
      client.get(`/ncc/campaigns/${encodeURIComponent(campaignId)}`, undefined, { customerId }),
  });
}
