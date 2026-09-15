import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { loadConfig, type NaverAdsConfig } from './config.js';
import { createServer, SERVER_NAME } from './server.js';
import { SERVER_VERSION } from './version.js';

// stdout은 JSON-RPC 전용이다. 로그는 반드시 stderr로만 내보낸다.
const log = (message: string): void => {
  process.stderr.write(`[${SERVER_NAME}] ${message}\n`);
};

const HELP = `${SERVER_NAME} v${SERVER_VERSION}
네이버 검색광고 API를 감싼 stdio MCP 서버.

사용법
  npx -y github:2duckchun/naver-ads-mcp

  인자 없이 실행하면 stdin/stdout으로 MCP 프로토콜을 주고받습니다.
  사람이 직접 실행하는 명령이 아니라 MCP 클라이언트가 띄우는 프로세스입니다.

옵션
  -h, --help      이 도움말을 출력합니다.
  -v, --version   버전을 출력합니다.

필수 환경변수
  NAVER_SA_API_KEY       액세스라이선스
  NAVER_SA_SECRET_KEY    비밀키
  NAVER_SA_CUSTOMER_ID   광고계정 ID (숫자)

  광고시스템(https://manage.searchad.naver.com) > 도구 > API 사용 관리에서 발급합니다.

선택 환경변수
  NAVER_SA_BASE_URL      기본값 https://api.searchad.naver.com
  NAVER_SA_TIMEOUT_MS    기본값 15000
  NAVER_SA_MAX_RETRIES   기본값 2

Claude Code에 등록
  claude mcp add naver-ads \\
    --env NAVER_SA_API_KEY=... \\
    --env NAVER_SA_SECRET_KEY=... \\
    --env NAVER_SA_CUSTOMER_ID=... \\
    -- npx -y github:2duckchun/naver-ads-mcp

문서: https://github.com/2duckchun/naver-ads-mcp
`;

/** 설정이 없으면 서버를 띄울 이유가 없다. 사유를 stderr로 남기고 즉시 종료한다. */
function loadConfigOrExit(): NaverAdsConfig {
  try {
    return loadConfig();
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    log(`설정 방법은 \`npx -y github:2duckchun/naver-ads-mcp --help\`를 참고하세요.`);
    process.exit(1);
  }
}

function main(): void {
  const argv = process.argv.slice(2);

  // --help/--version은 사람이 터미널에서 부르는 경로다. MCP 세션을 시작하지
  // 않고 즉시 끝나므로 stdout을 써도 프로토콜과 충돌하지 않는다.
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${SERVER_VERSION}\n`);
    return;
  }

  const config = loadConfigOrExit();

  const handle = serveStdio(() => createServer(config), {
    onerror: (error) => log(`transport error: ${error.message}`),
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    log(`${signal} 수신, 종료합니다.`);
    void handle.close().finally(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log(`v${SERVER_VERSION} 기동 (customerId=${config.customerId}, ${config.baseUrl})`);
}

main();
