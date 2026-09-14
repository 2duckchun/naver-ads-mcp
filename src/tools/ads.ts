import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { customerIdArg } from './shared.js';

export function registerAdTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'list_ads',
    title: '광고 소재 목록 조회',
    description: '광고그룹에 등록된 광고 소재(제목·설명·연결 URL)와 검수 상태를 조회합니다.',
    inputSchema: z.object({
      adgroupId: z.string().min(1).describe('조회할 광고그룹의 nccAdgroupId'),
      customerId: customerIdArg,
    }),
    run: ({ adgroupId, customerId }) =>
      client.get('/ncc/ads', { nccAdgroupId: adgroupId }, { customerId }),
  });

  registerReadTool(server, {
    name: 'get_ad',
    title: '광고 소재 단건 조회',
    description: 'nccAdId로 광고 소재 하나의 상세 정보를 조회합니다.',
    inputSchema: z.object({
      adId: z.string().min(1).describe('nccAdId'),
      customerId: customerIdArg,
    }),
    run: ({ adId, customerId }) =>
      client.get(`/ncc/ads/${encodeURIComponent(adId)}`, undefined, { customerId }),
  });

  registerReadTool(server, {
    name: 'list_ad_extensions',
    title: '확장 소재 목록 조회',
    description:
      '캠페인 또는 광고그룹에 붙은 확장 소재(전화번호, 위치정보, 홍보문구 등)를 조회합니다.',
    inputSchema: z.object({
      ownerId: z.string().min(1).describe('확장 소재를 소유한 nccCampaignId 또는 nccAdgroupId'),
      customerId: customerIdArg,
    }),
    run: ({ ownerId, customerId }) => client.get('/ncc/ad-extensions', { ownerId }, { customerId }),
  });
}
