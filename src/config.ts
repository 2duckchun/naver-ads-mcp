import { z } from 'zod';

/**
 * 네이버 검색광고 API 접속에 필요한 설정.
 *
 * API_KEY / SECRET_KEY / CUSTOMER_ID 는 네이버 검색광고 광고시스템의
 * [도구 > API 사용 관리]에서 발급한다. (https://manage.searchad.naver.com)
 */
const ConfigSchema = z.object({
  apiKey: z.string().min(1, 'NAVER_ADS_API_KEY가 비어 있습니다.'),
  secretKey: z.string().min(1, 'NAVER_ADS_SECRET_KEY가 비어 있습니다.'),
  customerId: z.string().regex(/^\d+$/, 'NAVER_ADS_CUSTOMER_ID는 숫자만 허용됩니다.'),
  baseUrl: z.url('NAVER_ADS_BASE_URL이 올바른 URL이 아닙니다.'),
  timeoutMs: z.coerce.number().int().positive(),
  maxRetries: z.coerce.number().int().min(0).max(5),
});

export type NaverAdsConfig = z.infer<typeof ConfigSchema>;

const DEFAULT_BASE_URL = 'https://api.searchad.naver.com';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * 환경변수를 읽어 설정을 만든다. 값이 비었거나 형식이 틀리면 어떤 변수가
 * 문제인지 한 번에 모아 던진다 — stdio 서버는 기동 실패 사유가 보이지 않으면
 * 디버깅이 어렵기 때문.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): NaverAdsConfig {
  const parsed = ConfigSchema.safeParse({
    apiKey: env.NAVER_ADS_API_KEY ?? '',
    secretKey: env.NAVER_ADS_SECRET_KEY ?? '',
    customerId: env.NAVER_ADS_CUSTOMER_ID ?? '',
    baseUrl: env.NAVER_ADS_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: env.NAVER_ADS_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    maxRetries: env.NAVER_ADS_MAX_RETRIES || DEFAULT_MAX_RETRIES,
  });

  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.message}`);
    throw new Error(`환경변수 설정이 올바르지 않습니다.\n${lines.join('\n')}`);
  }

  return parsed.data;
}
