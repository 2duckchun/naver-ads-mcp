import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import type { NaverAdsClient } from '../naver/client.js';
import { registerReadTool } from './define.js';
import { BREAKDOWNS, customerIdArg, DATE_PRESETS, isoDate, STAT_FIELDS } from './shared.js';

export function registerStatTools(server: McpServer, client: NaverAdsClient): void {
  registerReadTool(server, {
    name: 'get_stats',
    title: '성과 지표 조회',
    description:
      '캠페인·광고그룹·키워드·소재의 성과 지표를 조회합니다. ids는 종류를 가리지 않고 nccCampaignId / nccAdgroupId / nccKeywordId / nccAdId를 모두 받습니다. since+until과 datePreset 중 하나만 지정하세요. 둘 다 생략하면 네이버 기본 기간이 적용됩니다.',
    inputSchema: z.object({
      ids: z
        .array(z.string().min(1))
        .min(1)
        .max(100)
        .describe('지표를 조회할 대상 ID 목록. 한 번에 최대 100개.'),
      fields: z
        .array(z.enum(STAT_FIELDS))
        .min(1)
        .default(['impCnt', 'clkCnt', 'ctr', 'cpc', 'salesAmt'])
        .describe(
          '조회할 지표. impCnt=노출수, clkCnt=클릭수, ctr=클릭률, cpc=클릭당비용, salesAmt=광고비, ccnt=전환수, avgRnk=평균노출순위, drtCrto=직접전환율.',
        ),
      since: isoDate.optional().describe('조회 시작일 (YYYY-MM-DD). until과 함께 지정합니다.'),
      until: isoDate.optional().describe('조회 종료일 (YYYY-MM-DD). since와 함께 지정합니다.'),
      datePreset: z.enum(DATE_PRESETS).optional().describe('기간 프리셋. since/until 대신 씁니다.'),
      timeIncrement: z
        .enum(['allDays', '1'])
        .default('allDays')
        .describe('allDays=기간 합계, 1=일별 추이.'),
      breakdown: z
        .enum(BREAKDOWNS)
        .optional()
        .describe('분해 축. pcMblTp=PC/모바일, dayw=요일, hh24=시간대, regnNo=지역.'),
      customerId: customerIdArg,
    }),
    run: ({ ids, fields, since, until, datePreset, timeIncrement, breakdown, customerId }) => {
      if ((since && !until) || (!since && until)) {
        throw new Error('since와 until은 함께 지정해야 합니다.');
      }
      if (since && datePreset) {
        throw new Error('since/until과 datePreset은 동시에 쓸 수 없습니다. 하나만 지정하세요.');
      }

      return client.get(
        '/stats',
        {
          // 단건이어도 ids로 보낸다 — 응답 형태가 일관돼 모델이 파싱하기 쉽다.
          ids: JSON.stringify(ids),
          fields: JSON.stringify(fields),
          timeIncrement,
          ...(since && until ? { timeRange: JSON.stringify({ since, until }) } : {}),
          ...(datePreset ? { datePreset } : {}),
          ...(breakdown ? { breakdown } : {}),
        },
        { customerId },
      );
    },
  });
}
