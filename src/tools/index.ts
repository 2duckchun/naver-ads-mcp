import type { McpServer } from '@modelcontextprotocol/server';

import type { NaverAdsClient } from '../naver/client.js';
import { registerAccountTools } from './account.js';
import { registerAdgroupTools } from './adgroups.js';
import { registerAdTools } from './ads.js';
import { registerCampaignTools } from './campaigns.js';
import { registerKeywordTools } from './keywords.js';
import { registerRawTools } from './raw.js';
import { registerStatTools } from './stats.js';

/** 조회 전용 툴 전체를 서버에 등록한다. */
export function registerAllTools(server: McpServer, client: NaverAdsClient): void {
  registerCampaignTools(server, client);
  registerAdgroupTools(server, client);
  registerKeywordTools(server, client);
  registerAdTools(server, client);
  registerStatTools(server, client);
  registerAccountTools(server, client);
  registerRawTools(server, client);
}
