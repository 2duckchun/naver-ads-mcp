# naver-ads-mcp

네이버 검색광고 API를 감싼 **stdio MCP 서버**. 캠페인·광고그룹·키워드·소재 구조와 성과 지표를 MCP 클라이언트(Claude Code, Claude Desktop 등)에서 바로 조회합니다.

현재 범위는 **조회 전용**입니다. 생성·수정·삭제 툴은 아직 노출하지 않습니다.

## 요구 사항

- Node.js 20 이상
- 네이버 검색광고 API 라이선스 — [광고시스템](https://manage.searchad.naver.com) > 도구 > API 사용 관리에서 발급 (무료)

## 빠른 시작

이 저장소에서 바로 받아 씁니다. 별도 설치 단계는 없고, MCP 클라이언트가 알아서 프로세스를 띄웁니다.

```bash
npx -y github:2duckchun/naver-ads-mcp --help
```

특정 브랜치나 태그를 물리려면 `#`을 붙입니다.

```bash
npx -y github:2duckchun/naver-ads-mcp#v0.1.0 --help
```

## 환경변수

MCP 클라이언트 설정의 `env`로 넘깁니다(아래 등록 예시 참고). 로컬에서 소스를 직접 돌릴 때는 `.env.example`을 복사해 씁니다.

| 변수                   | 필수 | 기본값                           | 설명                              |
| ---------------------- | :--: | -------------------------------- | --------------------------------- |
| `NAVER_SA_API_KEY`     |  ●   |                                  | 액세스라이선스                    |
| `NAVER_SA_SECRET_KEY`  |  ●   |                                  | 비밀키                            |
| `NAVER_SA_CUSTOMER_ID` |  ●   |                                  | 광고계정 ID (숫자)                |
| `NAVER_SA_BASE_URL`    |      | `https://api.searchad.naver.com` | API 베이스 URL                    |
| `NAVER_SA_TIMEOUT_MS`  |      | `15000`                          | 요청 타임아웃                     |
| `NAVER_SA_MAX_RETRIES` |      | `2`                              | 429·5xx·네트워크 오류 재시도 횟수 |

값이 비었거나 형식이 틀리면 기동 시 **어떤 변수가 문제인지 한 번에** stderr로 출력하고 종료합니다.

## MCP 클라이언트 등록

### Claude Code

```bash
claude mcp add naver-ads \
  --env NAVER_SA_API_KEY=... \
  --env NAVER_SA_SECRET_KEY=... \
  --env NAVER_SA_CUSTOMER_ID=... \
  -- npx -y github:2duckchun/naver-ads-mcp
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "naver-ads": {
      "command": "npx",
      "args": ["-y", "github:2duckchun/naver-ads-mcp"],
      "env": {
        "NAVER_SA_API_KEY": "...",
        "NAVER_SA_SECRET_KEY": "...",
        "NAVER_SA_CUSTOMER_ID": "..."
      }
    }
  }
}
```

> 로컬 클론을 직접 물리려면 `command`를 `node`, `args`를 `["/절대경로/naver-ads-mcp/dist/index.js"]`로 바꾸면 됩니다.

## 툴

모두 `readOnlyHint`가 붙은 조회 전용입니다. 각 툴은 `customerId`를 선택 인자로 받아 호출 단위로 광고계정을 바꿀 수 있습니다(대행사 계정용).

| 툴                       | 엔드포인트                       | 용도                               |
| ------------------------ | -------------------------------- | ---------------------------------- |
| `list_campaigns`         | `GET /ncc/campaigns`             | 캠페인 목록                        |
| `get_campaign`           | `GET /ncc/campaigns/{id}`        | 캠페인 단건                        |
| `list_adgroups`          | `GET /ncc/adgroups`              | 광고그룹 목록                      |
| `get_adgroup`            | `GET /ncc/adgroups/{id}`         | 광고그룹 단건                      |
| `get_adgroup_targets`    | `GET /ncc/adgroups/{id}/targets` | 요일·시간, 지역, 매체 타게팅       |
| `list_keywords`          | `GET /ncc/keywords`              | 키워드 목록·입찰가                 |
| `get_keyword`            | `GET /ncc/keywords/{id}`         | 키워드 단건                        |
| `get_related_keywords`   | `GET /keywordstool`              | 연관 키워드·월간 검색량            |
| `list_ads`               | `GET /ncc/ads`                   | 광고 소재 목록                     |
| `get_ad`                 | `GET /ncc/ads/{id}`              | 광고 소재 단건                     |
| `list_ad_extensions`     | `GET /ncc/ad-extensions`         | 확장 소재                          |
| `get_stats`              | `GET /stats`                     | 성과 지표                          |
| `list_business_channels` | `GET /ncc/channels`              | 비즈채널                           |
| `list_customer_links`    | `GET /customer-links`            | 연결된 광고계정                    |
| `naver_ads_get`          | (임의 GET)                       | 전용 툴이 없는 엔드포인트용 탈출구 |

`get_stats`는 `ids`에 `nccCampaignId` / `nccAdgroupId` / `nccKeywordId` / `nccAdId`를 섞어 받고, 기간은 `since`+`until` 또는 `datePreset` 중 하나로 지정합니다. 둘 다 생략하면 네이버 기본 기간이 적용됩니다. `breakdown`으로 PC/모바일·요일·시간대·지역별 분해가 가능합니다.

> `/stats`는 `ids`를 **콤마 조인**으로, `fields`를 **JSON 배열**로 받습니다. 한쪽 형식을 반대로 보내면 전체가 400입니다(`ids` → `유효하지 않은 ID 형식입니다`, `fields` → `fields 파라미터 파싱 실패`). 이 비대칭은 `src/tools/__tests__/stats.test.ts`로 고정해 두었습니다.

## 인증 방식

네이버 검색광고 API는 요청마다 HMAC 서명을 요구합니다.

```
X-Timestamp: {epoch milliseconds}
X-API-KEY:   {액세스라이선스}
X-Customer:  {광고계정 ID}
X-Signature: base64(HMAC-SHA256(secretKey, "{timestamp}.{METHOD}.{path}"))
```

**서명 대상 경로에는 쿼리스트링이 들어가지 않습니다.** `/stats?ids=...`를 호출해도 서명에는 `/stats`만 씁니다. 이 규칙은 `src/naver/signature.ts`에 격리되어 있고 단위 테스트로 고정되어 있습니다.

서버 시각이 네이버와 수 분 이상 어긋나면 403이 납니다.

## 구조

```
src/
├── index.ts              진입점 — 설정 로드, serveStdio, 시그널 처리
├── server.ts             McpServer 조립
├── config.ts             환경변수 zod 검증
├── naver/
│   ├── signature.ts      HMAC 서명 + 인증 헤더
│   ├── client.ts         서명된 HTTP 클라이언트 (쿼리 직렬화·재시도·타임아웃)
│   └── errors.ts         NaverAdsApiError / NaverAdsTransportError
├── tools/
│   ├── define.ts         registerReadTool — 조회 툴 등록 헬퍼
│   ├── shared.ts         공통 인자·enum
│   └── *.ts              도메인별 툴
└── utils/result.ts       CallToolResult 직렬화
```

### 툴 추가하기

`registerReadTool`이 읽기 힌트·JSON 직렬화·에러 변환을 처리하므로, 툴 파일에는 "무엇을 어떤 인자로 부르는가"만 남습니다.

```ts
registerReadTool(server, {
  name: 'list_labels',
  title: '라벨 목록 조회',
  description: '광고계정에 등록된 라벨을 조회합니다. ...',
  inputSchema: z.object({ customerId: customerIdArg }),
  run: ({ customerId }) => client.get('/ncc/labels', undefined, { customerId }),
});
```

`src/tools/index.ts`의 `registerAllTools`에 등록 함수를 추가하면 끝입니다.

### 에러 처리 방침

네이버 API 오류는 예외로 던지지 않고 `isError: true` 툴 결과로 내려보냅니다. 프로토콜 오류로 던지면 모델이 원인을 보지 못해 스스로 교정할 수 없기 때문입니다. 결과에는 status·code·title·detail과 문의용 `transactionId`, 그리고 상태 코드별 조치 힌트가 함께 들어갑니다.

### stdout 규칙

stdout은 JSON-RPC 전용입니다. 로그는 반드시 stderr로 보내야 하며, Biome의 `suspicious/noConsole` 규칙을 error로 올려 실수를 막고 있습니다.

## 개발

```bash
git clone https://github.com/2duckchun/naver-ads-mcp.git
cd naver-ads-mcp
pnpm install
cp .env.example .env   # 발급받은 키 입력
```

```bash
pnpm dev            # tsx로 직접 실행 (.env 있으면 자동 로드)
pnpm build          # dist/ 재생성
pnpm test           # vitest
pnpm lint           # biome check (린트 + 포맷 + import 정렬)
pnpm lint:fix       # 자동 수정
pnpm check          # typecheck + lint + test
pnpm inspect        # MCP Inspector로 툴 확인 (pnpm build 후)
```

### dist 는 저장소에 커밋됩니다

빌드 산출물 `dist/` 를 추적하고, 설치 시점에 빌드하던 `prepare` 스크립트는 두지 않습니다.
설치 경로가 빌드 툴체인에 의존하지 않게 하려는 것입니다.

그래서 **`src/` 를 고쳤으면 `pnpm build` 후 `dist/` 도 함께 커밋해야 합니다.**
CI 가 `pnpm build` 를 돌린 뒤 `git diff --exit-code -- dist` 로 어긋남을 막습니다.

### 설치 경로별 동작

node 22 / npm 10.9.8 기준으로 확인했습니다.

| 방법                                                      | 결과                        |
| --------------------------------------------------------- | --------------------------- |
| `npx -y github:2duckchun/naver-ads-mcp`                     | 정상                        |
| `npm install github:2duckchun/naver-ads-mcp` (로컬)         | 정상                        |
| `git clone` → `npm pack` → `npm install -g <tarball>`       | 정상                        |
| `npm install -g github:2duckchun/naver-ads-mcp`             | **깨짐** — 아래 참고        |

`npm install -g` 에 git 주소를 직접 주면 npm 이 전역 `node_modules` 항목을 npm 캐시
안의 임시 클론 디렉터리(`_cacache/tmp/git-clone*`)로 심링크합니다. 그 디렉터리는 설치
직후 지워지므로 링크가 끊기고, 종료코드는 0인데 실행파일은 없는 상태가 됩니다.

이건 이 패키지에 국한된 문제가 아닙니다. 무관한 저장소(`github:isaacs/rimraf`)도 `-g`
로는 실패합니다(이쪽은 exit 127). npm 10.x 의 git 스펙 + `-g` 조합 문제로 보이며,
`dist` 를 커밋해도 이 경로는 살아나지 않습니다.

Docker 이미지에 넣는다면 tarball 경로를 쓰세요. `dist` 가 커밋되어 있으므로 클론에
빌드 툴체인이 필요 없고, 설치 후 클론을 지워도 실행파일이 남습니다.

```dockerfile
RUN git clone --depth 1 --branch v0.1.0 \
      https://github.com/2duckchun/naver-ads-mcp.git /src \
 && cd /src && npm install -g "$(npm pack | tail -1)" \
 && rm -rf /src
```

## 알려진 제약

- `get_stats`의 `timeIncrement: '1'`(일별 추이)은 `/stats`에서 "지원하지 않는 기능입니다"(400)로 거부될 수 있습니다. 일별 데이터는 대용량 리포트(`/stat-reports`) 쪽 기능입니다.
- `get_stats`의 `breakdown`은 **최근 7일 이내** 기간에서만 동작합니다. 더 긴 기간과 함께 쓰면 400입니다.
- `list_customer_links`는 **대행사(매니저) 계정 전용**입니다. 일반 광고주 계정으로 부르면 본문 없는 404가 돌아옵니다.
- 목록 조회 툴의 선택 파라미터는 확실한 것만 노출했습니다. 페이지네이션(`baseSearchId`, `recordSize`)이나 `selector` 같은 파라미터가 필요하면 `naver_ads_get`으로 우회하세요.
- 응답은 타입 없이 그대로 통과시킵니다. 도메인 타입은 필요한 시점에 붙이는 편이 낫다고 판단했습니다.

## 다음 단계 후보

- 쓰기 툴 (`POST`/`PUT`/`DELETE`) — `NAVER_SA_ALLOW_WRITE` 같은 안전장치와 함께
- 대용량 리포트 (`/stat-reports`, `/master-reports`) — 잡 생성 → 폴링 → 다운로드
- 입찰가 추정 (`/estimate/*`)
- 자주 쓰는 분석 절차를 MCP Prompt로 제공

## 참고

- [네이버 검색광고 API 문서](https://naver.github.io/searchad-apidoc/)
- [naver/searchad-apidoc (샘플·에러코드)](https://github.com/naver/searchad-apidoc)
