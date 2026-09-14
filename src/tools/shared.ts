import { z } from 'zod';

/**
 * 모든 툴이 공유하는 광고계정 오버라이드.
 * 대행사 계정처럼 여러 CUSTOMER_ID를 다룰 때 호출 단위로 바꿔 쓴다.
 */
export const customerIdArg = z
  .string()
  .regex(/^\d+$/, 'customerId는 숫자 문자열이어야 합니다.')
  .optional()
  .describe('조회할 광고계정 CUSTOMER_ID. 생략하면 NAVER_SA_CUSTOMER_ID를 사용합니다.');

/** `/stats`가 지원하는 지표. */
export const STAT_FIELDS = [
  'impCnt',
  'clkCnt',
  'ctr',
  'cpc',
  'avgRnk',
  'ccnt',
  'salesAmt',
  'recentAvgCpc',
  'recentAvgRnk',
  'drtCrto',
] as const;

/** `/stats`가 지원하는 기간 프리셋. */
export const DATE_PRESETS = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'lastweek',
  'lastmonth',
  'lastquarter',
] as const;

/** `/stats`가 지원하는 분해 축. */
export const BREAKDOWNS = ['pcMblTp', 'dayw', 'hh24', 'regnNo'] as const;

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.');

/** 조회 전용 툴에 붙이는 공통 힌트. */
export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
