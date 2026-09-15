#!/usr/bin/env node

// src/index.ts
import { serveStdio } from "@modelcontextprotocol/server/stdio";

// src/config.ts
import { z } from "zod";
var ConfigSchema = z.object({
  apiKey: z.string().min(1, "NAVER_SA_API_KEY\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4."),
  secretKey: z.string().min(1, "NAVER_SA_SECRET_KEY\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4."),
  customerId: z.string().regex(/^\d+$/, "NAVER_SA_CUSTOMER_ID\uB294 \uC22B\uC790\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4."),
  baseUrl: z.url("NAVER_SA_BASE_URL\uC774 \uC62C\uBC14\uB978 URL\uC774 \uC544\uB2D9\uB2C8\uB2E4."),
  timeoutMs: z.coerce.number({ error: "NAVER_SA_TIMEOUT_MS\uB294 \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4." }).int("NAVER_SA_TIMEOUT_MS\uB294 \uC815\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4.").positive("NAVER_SA_TIMEOUT_MS\uB294 1 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4."),
  maxRetries: z.coerce.number({ error: "NAVER_SA_MAX_RETRIES\uB294 \uC22B\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4." }).int("NAVER_SA_MAX_RETRIES\uB294 \uC815\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4.").min(0, "NAVER_SA_MAX_RETRIES\uB294 0 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.").max(5, "NAVER_SA_MAX_RETRIES\uB294 5 \uC774\uD558\uC5EC\uC57C \uD569\uB2C8\uB2E4.")
});
var DEFAULT_BASE_URL = "https://api.searchad.naver.com";
var DEFAULT_TIMEOUT_MS = 15e3;
var DEFAULT_MAX_RETRIES = 2;
function loadConfig(env = process.env) {
  const parsed = ConfigSchema.safeParse({
    apiKey: env.NAVER_SA_API_KEY ?? "",
    secretKey: env.NAVER_SA_SECRET_KEY ?? "",
    customerId: env.NAVER_SA_CUSTOMER_ID ?? "",
    baseUrl: env.NAVER_SA_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: env.NAVER_SA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    maxRetries: env.NAVER_SA_MAX_RETRIES || DEFAULT_MAX_RETRIES
  });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  - ${issue.message}`);
    throw new Error(`\uD658\uACBD\uBCC0\uC218 \uC124\uC815\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.
${lines.join("\n")}`);
  }
  return parsed.data;
}

// src/server.ts
import { McpServer } from "@modelcontextprotocol/server";

// src/naver/errors.ts
var REDACTED = "***";
var MIN_REDACTABLE_LENGTH = 8;
function redactSecrets(text, secrets) {
  if (text === void 0) return void 0;
  let out = text;
  for (const secret of secrets) {
    if (secret.length < MIN_REDACTABLE_LENGTH) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}
var NaverAdsApiError = class extends Error {
  method;
  path;
  status;
  transactionId;
  code;
  title;
  detail;
  rawBody;
  constructor(ctx) {
    const summary = ctx.title ?? ctx.detail ?? ctx.rawBody ?? "(\uC751\uB2F5 \uBCF8\uBB38 \uC5C6\uC74C)";
    super(`\uB124\uC774\uBC84 \uAC80\uC0C9\uAD11\uACE0 API ${ctx.status} \u2014 ${ctx.method} ${ctx.path}: ${summary}`);
    this.name = "NaverAdsApiError";
    this.method = ctx.method;
    this.path = ctx.path;
    this.status = ctx.status;
    this.transactionId = ctx.transactionId;
    this.code = ctx.code;
    this.title = ctx.title;
    this.detail = ctx.detail;
    this.rawBody = ctx.rawBody;
  }
  /** 모델이 그대로 읽을 수 있도록 구조화한다. */
  toJSON() {
    return {
      error: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      title: this.title,
      detail: this.detail,
      request: { method: this.method, path: this.path },
      transactionId: this.transactionId,
      hint: hintFor(this.status)
    };
  }
};
function hintFor(status) {
  switch (status) {
    case 401:
    case 403:
      return "API_KEY / SECRET_KEY / CUSTOMER_ID \uC870\uD569\uACFC \uC11C\uBC84 \uC2DC\uAC01(X-Timestamp)\uC744 \uD655\uC778\uD558\uC138\uC694. \uC2DC\uAC01\uC774 \uC218 \uBD84 \uC774\uC0C1 \uC5B4\uAE0B\uB098\uBA74 \uC11C\uBA85\uC774 \uAC70\uBD80\uB429\uB2C8\uB2E4.";
    case 404:
      return "\uACBD\uB85C \uB610\uB294 \uB9AC\uC18C\uC2A4 ID\uAC00 \uC874\uC7AC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. nccCampaignId\xB7nccAdgroupId \uAC19\uC740 ID \uD615\uC2DD\uC744 \uD655\uC778\uD558\uC138\uC694.";
    case 429:
      return "\uD638\uCD9C \uD55C\uB3C4\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uC7AC\uC2DC\uB3C4\uD558\uAC70\uB098 \uC870\uD68C \uBC94\uC704\uB97C \uC881\uD788\uC138\uC694.";
    default:
      return void 0;
  }
}
var NaverAdsTransportError = class extends Error {
  method;
  path;
  constructor(method, path, cause, secrets = []) {
    super(
      `\uB124\uC774\uBC84 \uAC80\uC0C9\uAD11\uACE0 API \uC694\uCCAD \uC2E4\uD328 \u2014 ${method} ${path}: ${redactSecrets(describe(cause), secrets)}`
    );
    this.name = "NaverAdsTransportError";
    this.method = method;
    this.path = path;
    this.cause = cause;
  }
};
function describe(cause) {
  if (cause instanceof Error) {
    return cause.name === "TimeoutError" || cause.name === "AbortError" ? "\uD0C0\uC784\uC544\uC6C3" : cause.message;
  }
  return String(cause);
}

// src/naver/signature.ts
import { createHmac } from "crypto";
function buildSignature({ timestamp, method, path, secretKey }) {
  const message = `${timestamp}.${method}.${path}`;
  return createHmac("sha256", secretKey).update(message, "utf8").digest("base64");
}
function buildAuthHeaders(input) {
  return {
    "X-Timestamp": String(input.timestamp),
    "X-API-KEY": input.apiKey,
    "X-Customer": input.customerId,
    "X-Signature": buildSignature(input)
  };
}

// src/naver/client.ts
var RETRYABLE_STATUS = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var NaverAdsClient = class {
  constructor(config) {
    this.config = config;
  }
  config;
  get defaultCustomerId() {
    return this.config.customerId;
  }
  /** 에러 메시지에서 지워야 할 값. 설정을 아는 곳이 여기뿐이라 여기서 넘긴다. */
  get secrets() {
    return [this.config.apiKey, this.config.secretKey];
  }
  async get(path, query, opts) {
    return this.request({ method: "GET", path, query, ...opts });
  }
  async post(path, body, query, opts) {
    return this.request({ method: "POST", path, body, query, ...opts });
  }
  async put(path, body, query, opts) {
    return this.request({ method: "PUT", path, body, query, ...opts });
  }
  async delete(path, query, opts) {
    return this.request({ method: "DELETE", path, query, ...opts });
  }
  async request(options) {
    let lastError;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      if (attempt > 0) await delay(backoffMs(attempt), options.signal);
      try {
        return await this.send(options);
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.config.maxRetries) throw error;
      }
    }
    throw lastError;
  }
  async send(options) {
    const { method, path, query, body, customerId, signal } = options;
    const url = new URL(path, this.config.baseUrl);
    appendQuery(url, query);
    const headers = {
      ...buildAuthHeaders({
        timestamp: Date.now(),
        method,
        path,
        secretKey: this.config.secretKey,
        apiKey: this.config.apiKey,
        customerId: customerId ?? this.config.customerId
      }),
      Accept: "application/json"
    };
    const init = {
      method,
      headers,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)]) : AbortSignal.timeout(this.config.timeoutMs)
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json; charset=UTF-8";
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw new NaverAdsTransportError(method, path, cause, this.secrets);
    }
    const text = await response.text();
    const parsed = safeJsonParse(text);
    if (!response.ok) {
      const payload = parsed ?? {};
      throw new NaverAdsApiError({
        method,
        path,
        status: response.status,
        transactionId: response.headers.get("X-Transaction-ID") ?? void 0,
        code: asScalar(payload.code),
        // 네이버가 응답 본문에 되돌려준 키를 그대로 실어 나르지 않는다.
        title: redactSecrets(asString(payload.title), this.secrets),
        detail: redactSecrets(asString(payload.detail) ?? asString(payload.message), this.secrets),
        rawBody: parsed === void 0 ? redactSecrets(asString(truncate(text)), this.secrets) : void 0
      });
    }
    return parsed ?? null;
  }
};
function appendQuery(url, query) {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      url.searchParams.set(key, value.join(","));
    } else if (typeof value === "object") {
      url.searchParams.set(key, JSON.stringify(value));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}
function isRetryable(error) {
  if (error instanceof NaverAdsTransportError) return true;
  return error instanceof NaverAdsApiError && RETRYABLE_STATUS.has(error.status);
}
function backoffMs(attempt) {
  return 200 * 2 ** attempt;
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal ? abortError(signal) : new Error("\uC694\uCCAD\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function abortError(signal) {
  return signal.reason instanceof Error ? signal.reason : new Error("\uC694\uCCAD\uC774 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", { cause: signal.reason });
}
function safeJsonParse(text) {
  if (text.trim() === "") return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function asString(value) {
  return typeof value === "string" && value !== "" ? value : void 0;
}
function asScalar(value) {
  return typeof value === "string" || typeof value === "number" ? value : void 0;
}
function truncate(text, max = 500) {
  return text.length > max ? `${text.slice(0, max)}\u2026` : text;
}

// src/tools/account.ts
import { z as z3 } from "zod";

// src/utils/result.ts
function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function errorResult(error) {
  const payload = error instanceof NaverAdsApiError ? error.toJSON() : {
    error: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error)
  };
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], isError: true };
}

// src/tools/shared.ts
import { z as z2 } from "zod";
var customerIdArg = z2.string().regex(/^\d+$/, "customerId\uB294 \uC22B\uC790 \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.").optional().describe("\uC870\uD68C\uD560 \uAD11\uACE0\uACC4\uC815 CUSTOMER_ID. \uC0DD\uB7B5\uD558\uBA74 NAVER_SA_CUSTOMER_ID\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.");
var STAT_FIELDS = [
  "impCnt",
  "clkCnt",
  "ctr",
  "cpc",
  "avgRnk",
  "ccnt",
  "salesAmt",
  "recentAvgCpc",
  "recentAvgRnk",
  "drtCrto"
];
var DATE_PRESETS = [
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "lastweek",
  "lastmonth",
  "lastquarter"
];
var BREAKDOWNS = ["pcMblTp", "dayw", "hh24", "regnNo"];
var isoDate = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD \uD615\uC2DD\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
var readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

// src/tools/define.ts
function registerReadTool(server, def) {
  const inputSchema = def.inputSchema;
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema,
      annotations: readOnly
    },
    async (args) => {
      try {
        return jsonResult(await def.run(args));
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

// src/tools/account.ts
function registerAccountTools(server, client) {
  registerReadTool(server, {
    name: "list_business_channels",
    title: "\uBE44\uC988\uCC44\uB110 \uBAA9\uB85D \uC870\uD68C",
    description: "\uAD11\uACE0\uACC4\uC815\uC5D0 \uB4F1\uB85D\uB41C \uBE44\uC988\uCC44\uB110(\uC6F9\uC0AC\uC774\uD2B8, \uC804\uD654\uBC88\uD638, \uB124\uC774\uBC84 \uD1A1\uD1A1, \uC1FC\uD551\uBAB0 \uB4F1)\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4. \uAD11\uACE0\uADF8\uB8F9\uC774 \uC5F0\uACB0\uD558\uB294 \uB300\uC0C1\uC785\uB2C8\uB2E4.",
    inputSchema: z3.object({ customerId: customerIdArg }),
    run: ({ customerId }) => client.get("/ncc/channels", void 0, { customerId })
  });
  registerReadTool(server, {
    name: "list_customer_links",
    title: "\uC5F0\uACB0\uB41C \uAD11\uACE0\uACC4\uC815 \uC870\uD68C",
    description: "\uB300\uD589\uC0AC \uACC4\uC815\uC5D0 \uC5F0\uACB0\uB41C \uAD11\uACE0\uC8FC \uACC4\uC815 \uBAA9\uB85D\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4. \uC5EC\uAE30\uC11C \uC5BB\uC740 customerId\uB97C \uB2E4\uB978 \uD234\uC758 customerId \uC778\uC790\uB85C \uB118\uACA8 \uC5EC\uB7EC \uACC4\uC815\uC744 \uC624\uAC08 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB300\uD589\uC0AC(\uB9E4\uB2C8\uC800) \uACC4\uC815\uC5D0\uC11C\uB9CC \uC4F8 \uC218 \uC788\uACE0, \uC77C\uBC18 \uAD11\uACE0\uC8FC \uACC4\uC815\uC73C\uB85C \uBD80\uB974\uBA74 \uBCF8\uBB38 \uC5C6\uB294 404\uAC00 \uB3CC\uC544\uC635\uB2C8\uB2E4.",
    inputSchema: z3.object({
      type: z3.string().optional().describe("\uC5F0\uACB0 \uC720\uD615 \uD544\uD130. \uB300\uD589\uC0AC\uAC00 \uAD00\uB9AC\uD558\uB294 \uAD11\uACE0\uC8FC \uBAA9\uB85D\uC740 MYCLIENTS\uC785\uB2C8\uB2E4."),
      customerId: customerIdArg
    }),
    run: ({ type, customerId }) => client.get("/customer-links", { type }, { customerId })
  });
}

// src/tools/adgroups.ts
import { z as z4 } from "zod";
function registerAdgroupTools(server, client) {
  registerReadTool(server, {
    name: "list_adgroups",
    title: "\uAD11\uACE0\uADF8\uB8F9 \uBAA9\uB85D \uC870\uD68C",
    description: "\uCEA0\uD398\uC778\uC5D0 \uC18D\uD55C \uAD11\uACE0\uADF8\uB8F9 \uBAA9\uB85D\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4. \uAD11\uACE0\uADF8\uB8F9\uC740 \uC785\uCC30\uAC00\xB7\uC18C\uC7AC\xB7\uD0A4\uC6CC\uB4DC\uB97C \uBB36\uB294 \uB2E8\uC704\uC785\uB2C8\uB2E4. campaignId\uB97C \uC0DD\uB7B5\uD558\uBA74 \uAD11\uACE0\uACC4\uC815 \uC804\uCCB4 \uAD11\uACE0\uADF8\uB8F9\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z4.object({
      campaignId: z4.string().optional().describe("\uC870\uD68C\uD560 \uCEA0\uD398\uC778\uC758 nccCampaignId. list_campaigns\uB85C \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694."),
      adgroupIds: z4.array(z4.string()).max(100).optional().describe("\uD2B9\uC815 \uAD11\uACE0\uADF8\uB8F9\uB9CC \uC870\uD68C\uD560 \uB54C\uC758 nccAdgroupId \uBAA9\uB85D."),
      customerId: customerIdArg
    }),
    run: ({ campaignId, adgroupIds, customerId }) => client.get(
      "/ncc/adgroups",
      { nccCampaignId: campaignId, nccAdgroupIdList: adgroupIds },
      { customerId }
    )
  });
  registerReadTool(server, {
    name: "get_adgroup",
    title: "\uAD11\uACE0\uADF8\uB8F9 \uB2E8\uAC74 \uC870\uD68C",
    description: "nccAdgroupId\uB85C \uAD11\uACE0\uADF8\uB8F9 \uD558\uB098\uC758 \uC0C1\uC138 \uC815\uBCF4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z4.object({
      adgroupId: z4.string().min(1).describe("nccAdgroupId (\uC608: grp-a001-01-000000012345678)"),
      customerId: customerIdArg
    }),
    run: ({ adgroupId, customerId }) => client.get(`/ncc/adgroups/${encodeURIComponent(adgroupId)}`, void 0, { customerId })
  });
  registerReadTool(server, {
    name: "get_adgroup_targets",
    title: "\uAD11\uACE0\uADF8\uB8F9 \uD0C0\uAC8C\uD305 \uC870\uD68C",
    description: "\uAD11\uACE0\uADF8\uB8F9\uC5D0 \uC124\uC815\uB41C \uD0C0\uAC8C\uD305(\uC694\uC77C\xB7\uC2DC\uAC04, \uC9C0\uC5ED, \uB9E4\uCCB4, PC/\uBAA8\uBC14\uC77C \uB4F1)\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z4.object({
      adgroupId: z4.string().min(1).describe("nccAdgroupId"),
      customerId: customerIdArg
    }),
    run: ({ adgroupId, customerId }) => client.get(`/ncc/adgroups/${encodeURIComponent(adgroupId)}/targets`, void 0, {
      customerId
    })
  });
}

// src/tools/ads.ts
import { z as z5 } from "zod";
function registerAdTools(server, client) {
  registerReadTool(server, {
    name: "list_ads",
    title: "\uAD11\uACE0 \uC18C\uC7AC \uBAA9\uB85D \uC870\uD68C",
    description: "\uAD11\uACE0\uADF8\uB8F9\uC5D0 \uB4F1\uB85D\uB41C \uAD11\uACE0 \uC18C\uC7AC(\uC81C\uBAA9\xB7\uC124\uBA85\xB7\uC5F0\uACB0 URL)\uC640 \uAC80\uC218 \uC0C1\uD0DC\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z5.object({
      adgroupId: z5.string().min(1).describe("\uC870\uD68C\uD560 \uAD11\uACE0\uADF8\uB8F9\uC758 nccAdgroupId"),
      customerId: customerIdArg
    }),
    run: ({ adgroupId, customerId }) => client.get("/ncc/ads", { nccAdgroupId: adgroupId }, { customerId })
  });
  registerReadTool(server, {
    name: "get_ad",
    title: "\uAD11\uACE0 \uC18C\uC7AC \uB2E8\uAC74 \uC870\uD68C",
    description: "nccAdId\uB85C \uAD11\uACE0 \uC18C\uC7AC \uD558\uB098\uC758 \uC0C1\uC138 \uC815\uBCF4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z5.object({
      adId: z5.string().min(1).describe("nccAdId"),
      customerId: customerIdArg
    }),
    run: ({ adId, customerId }) => client.get(`/ncc/ads/${encodeURIComponent(adId)}`, void 0, { customerId })
  });
  registerReadTool(server, {
    name: "list_ad_extensions",
    title: "\uD655\uC7A5 \uC18C\uC7AC \uBAA9\uB85D \uC870\uD68C",
    description: "\uCEA0\uD398\uC778 \uB610\uB294 \uAD11\uACE0\uADF8\uB8F9\uC5D0 \uBD99\uC740 \uD655\uC7A5 \uC18C\uC7AC(\uC804\uD654\uBC88\uD638, \uC704\uCE58\uC815\uBCF4, \uD64D\uBCF4\uBB38\uAD6C \uB4F1)\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z5.object({
      ownerId: z5.string().min(1).describe("\uD655\uC7A5 \uC18C\uC7AC\uB97C \uC18C\uC720\uD55C nccCampaignId \uB610\uB294 nccAdgroupId"),
      customerId: customerIdArg
    }),
    run: ({ ownerId, customerId }) => client.get("/ncc/ad-extensions", { ownerId }, { customerId })
  });
}

// src/tools/campaigns.ts
import { z as z6 } from "zod";
function registerCampaignTools(server, client) {
  registerReadTool(server, {
    name: "list_campaigns",
    title: "\uCEA0\uD398\uC778 \uBAA9\uB85D \uC870\uD68C",
    description: "\uAD11\uACE0\uACC4\uC815\uC758 \uCEA0\uD398\uC778 \uBAA9\uB85D\uC744 \uC870\uD68C\uD569\uB2C8\uB2E4. \uCEA0\uD398\uC778\uC740 \uD30C\uC6CC\uB9C1\uD06C\xB7\uC1FC\uD551\uAC80\uC0C9\xB7\uD30C\uC6CC\uCEE8\uD150\uCE20 \uB4F1 \uAD11\uACE0 \uC720\uD615\uACFC \uC608\uC0B0\uC744 \uAD00\uB9AC\uD558\uB294 \uCD5C\uC0C1\uC704 \uB2E8\uC704\uC785\uB2C8\uB2E4. \uBC18\uD658\uB418\uB294 nccCampaignId\uB294 list_adgroups\uC758 \uC785\uB825\uAC12\uC774 \uB429\uB2C8\uB2E4.",
    inputSchema: z6.object({
      campaignIds: z6.array(z6.string()).max(100).optional().describe("\uD2B9\uC815 \uCEA0\uD398\uC778\uB9CC \uC870\uD68C\uD560 \uB54C\uC758 nccCampaignId \uBAA9\uB85D. \uC0DD\uB7B5\uD558\uBA74 \uC804\uCCB4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4."),
      customerId: customerIdArg
    }),
    run: ({ campaignIds, customerId }) => client.get("/ncc/campaigns", { nccCampaignIdList: campaignIds }, { customerId })
  });
  registerReadTool(server, {
    name: "get_campaign",
    title: "\uCEA0\uD398\uC778 \uB2E8\uAC74 \uC870\uD68C",
    description: "nccCampaignId\uB85C \uCEA0\uD398\uC778 \uD558\uB098\uC758 \uC0C1\uC138 \uC815\uBCF4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z6.object({
      campaignId: z6.string().min(1).describe("nccCampaignId (\uC608: cmp-a001-01-000000001234567)"),
      customerId: customerIdArg
    }),
    run: ({ campaignId, customerId }) => client.get(`/ncc/campaigns/${encodeURIComponent(campaignId)}`, void 0, { customerId })
  });
}

// src/tools/keywords.ts
import { z as z7 } from "zod";
function registerKeywordTools(server, client) {
  registerReadTool(server, {
    name: "list_keywords",
    title: "\uD0A4\uC6CC\uB4DC \uBAA9\uB85D \uC870\uD68C",
    description: "\uAD11\uACE0\uADF8\uB8F9\uC5D0 \uB4F1\uB85D\uB41C \uD0A4\uC6CC\uB4DC \uBAA9\uB85D\uACFC \uC785\uCC30\uAC00\xB7\uC0C1\uD0DC\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4. \uB178\uCD9C\xB7\uD074\uB9AD\xB7\uBE44\uC6A9 \uAC19\uC740 \uC131\uACFC \uC9C0\uD45C\uB294 \uD3EC\uD568\uB418\uC9C0 \uC54A\uC73C\uBBC0\uB85C get_stats\uB97C \uD568\uAED8 \uC4F0\uC138\uC694.",
    inputSchema: z7.object({
      adgroupId: z7.string().min(1).describe("\uC870\uD68C\uD560 \uAD11\uACE0\uADF8\uB8F9\uC758 nccAdgroupId. list_adgroups\uB85C \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694."),
      customerId: customerIdArg
    }),
    run: ({ adgroupId, customerId }) => client.get("/ncc/keywords", { nccAdgroupId: adgroupId }, { customerId })
  });
  registerReadTool(server, {
    name: "get_keyword",
    title: "\uD0A4\uC6CC\uB4DC \uB2E8\uAC74 \uC870\uD68C",
    description: "nccKeywordId\uB85C \uD0A4\uC6CC\uB4DC \uD558\uB098\uC758 \uC0C1\uC138 \uC815\uBCF4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4.",
    inputSchema: z7.object({
      keywordId: z7.string().min(1).describe("nccKeywordId (\uC608: nkw-a001-01-000000123456789)"),
      customerId: customerIdArg
    }),
    run: ({ keywordId, customerId }) => client.get(`/ncc/keywords/${encodeURIComponent(keywordId)}`, void 0, { customerId })
  });
  registerReadTool(server, {
    name: "get_related_keywords",
    title: "\uC5F0\uAD00 \uD0A4\uC6CC\uB4DC \uBC0F \uAC80\uC0C9\uB7C9 \uC870\uD68C",
    description: "\uD0A4\uC6CC\uB4DC\uB3C4\uAD6C API\uB85C \uD78C\uD2B8 \uD0A4\uC6CC\uB4DC\uC758 \uC5F0\uAD00 \uD0A4\uC6CC\uB4DC\uC640 \uC6D4\uAC04 \uAC80\uC0C9\uC218\xB7\uD074\uB9AD\uC218\xB7\uACBD\uC7C1\uC815\uB3C4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4. \uAD11\uACE0 \uB4F1\uB85D \uC5EC\uBD80\uC640 \uBB34\uAD00\uD558\uAC8C \uC870\uD68C\uD560 \uC218 \uC788\uC5B4 \uD0A4\uC6CC\uB4DC \uBC1C\uAD74\uC5D0 \uC501\uB2C8\uB2E4. \uD78C\uD2B8\uB294 \uCD5C\uB300 5\uAC1C\uC785\uB2C8\uB2E4.",
    inputSchema: z7.object({
      hintKeywords: z7.array(z7.string().min(1)).min(1).max(5).describe("\uC5F0\uAD00 \uD0A4\uC6CC\uB4DC\uB97C \uBF51\uC744 \uAE30\uC900 \uD0A4\uC6CC\uB4DC. \uACF5\uBC31 \uC5C6\uC774 \uB123\uB294 \uD3B8\uC774 \uACB0\uACFC\uAC00 \uC88B\uC2B5\uB2C8\uB2E4."),
      showDetail: z7.boolean().default(true).describe("\uC6D4\uAC04 \uAC80\uC0C9\uC218\xB7\uD074\uB9AD\uC218 \uB4F1 \uC0C1\uC138 \uC9C0\uD45C \uD3EC\uD568 \uC5EC\uBD80."),
      customerId: customerIdArg
    }),
    run: ({ hintKeywords, showDetail, customerId }) => client.get(
      "/keywordstool",
      { hintKeywords: hintKeywords.join(","), showDetail: showDetail ? 1 : 0 },
      { customerId }
    )
  });
}

// src/tools/raw.ts
import { z as z8 } from "zod";
function registerRawTools(server, client) {
  registerReadTool(server, {
    name: "naver_ads_get",
    title: "\uC784\uC758 \uC5D4\uB4DC\uD3EC\uC778\uD2B8 GET \uD638\uCD9C",
    description: "\uC804\uC6A9 \uD234\uC774 \uC5C6\uB294 \uB124\uC774\uBC84 \uAC80\uC0C9\uAD11\uACE0 API \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uB97C \uC9C1\uC811 GET \uD638\uCD9C\uD569\uB2C8\uB2E4. \uC804\uC6A9 \uD234(list_campaigns, get_stats \uB4F1)\uC774 \uC788\uC73C\uBA74 \uADF8\uCABD\uC744 \uC4F0\uC138\uC694. \uC774 \uD234\uC740 /ncc/labels \uCC98\uB7FC \uC544\uC9C1 \uAC10\uC2F8\uC9C0 \uC54A\uC740 \uACBD\uB85C\uC6A9\uC785\uB2C8\uB2E4. \uC5D4\uB4DC\uD3EC\uC778\uD2B8 \uBA85\uC138\uB294 https://naver.github.io/searchad-apidoc \uC744 \uCC38\uACE0\uD558\uC138\uC694.",
    inputSchema: z8.object({
      path: z8.string().regex(/^\/[^\s?#]*$/, "path\uB294 /\uB85C \uC2DC\uC791\uD558\uACE0 \uCFFC\uB9AC\uC2A4\uD2B8\uB9C1(?)\uC744 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC544\uC57C \uD569\uB2C8\uB2E4.").describe("\uD638\uCD9C\uD560 \uACBD\uB85C. \uC608: /ncc/labels"),
      query: z8.record(
        z8.string(),
        // 각 브랜치의 설명은 문서인 동시에 스키마 이식성 장치다. 설명이 없으면
        // zod가 union을 `type: ["string","number","boolean"]`으로 접는데, 이
        // 배열 형태를 읽지 못해 툴 자체를 거부하는 MCP 클라이언트가 있다.
        // 설명이 붙으면 anyOf로 방출된다. raw.test.ts가 이 형태를 고정한다.
        z8.union([
          z8.string().describe("\uBB38\uC790\uC5F4 \uAC12"),
          z8.number().describe("\uC22B\uC790 \uAC12"),
          z8.boolean().describe("\uBD88\uB9AC\uC5B8 \uAC12")
        ])
      ).optional().describe("\uCFFC\uB9AC \uD30C\uB77C\uBBF8\uD130. \uAC12\uC774 JSON\uC774\uC5B4\uC57C \uD558\uB294 \uD30C\uB77C\uBBF8\uD130\uB294 \uC9C1\uB82C\uD654\uB41C \uBB38\uC790\uC5F4\uB85C \uB123\uC73C\uC138\uC694."),
      customerId: customerIdArg
    }),
    run: ({ path, query, customerId }) => client.get(path, query, { customerId })
  });
}

// src/tools/stats.ts
import { z as z9 } from "zod";
function registerStatTools(server, client) {
  registerReadTool(server, {
    name: "get_stats",
    title: "\uC131\uACFC \uC9C0\uD45C \uC870\uD68C",
    description: "\uCEA0\uD398\uC778\xB7\uAD11\uACE0\uADF8\uB8F9\xB7\uD0A4\uC6CC\uB4DC\xB7\uC18C\uC7AC\uC758 \uC131\uACFC \uC9C0\uD45C\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4. ids\uB294 \uC885\uB958\uB97C \uAC00\uB9AC\uC9C0 \uC54A\uACE0 nccCampaignId / nccAdgroupId / nccKeywordId / nccAdId\uB97C \uBAA8\uB450 \uBC1B\uC2B5\uB2C8\uB2E4. since+until\uACFC datePreset \uC911 \uD558\uB098\uB9CC \uC9C0\uC815\uD558\uC138\uC694. \uB458 \uB2E4 \uC0DD\uB7B5\uD558\uBA74 \uB124\uC774\uBC84 \uAE30\uBCF8 \uAE30\uAC04\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.",
    inputSchema: z9.object({
      ids: z9.array(z9.string().min(1)).min(1).max(100).describe("\uC9C0\uD45C\uB97C \uC870\uD68C\uD560 \uB300\uC0C1 ID \uBAA9\uB85D. \uD55C \uBC88\uC5D0 \uCD5C\uB300 100\uAC1C."),
      fields: z9.array(z9.enum(STAT_FIELDS)).min(1).default(["impCnt", "clkCnt", "ctr", "cpc", "salesAmt"]).describe(
        "\uC870\uD68C\uD560 \uC9C0\uD45C. impCnt=\uB178\uCD9C\uC218, clkCnt=\uD074\uB9AD\uC218, ctr=\uD074\uB9AD\uB960, cpc=\uD074\uB9AD\uB2F9\uBE44\uC6A9, salesAmt=\uAD11\uACE0\uBE44, ccnt=\uC804\uD658\uC218, avgRnk=\uD3C9\uADE0\uB178\uCD9C\uC21C\uC704, drtCrto=\uC9C1\uC811\uC804\uD658\uC728."
      ),
      since: isoDate.optional().describe("\uC870\uD68C \uC2DC\uC791\uC77C (YYYY-MM-DD). until\uACFC \uD568\uAED8 \uC9C0\uC815\uD569\uB2C8\uB2E4."),
      until: isoDate.optional().describe("\uC870\uD68C \uC885\uB8CC\uC77C (YYYY-MM-DD). since\uC640 \uD568\uAED8 \uC9C0\uC815\uD569\uB2C8\uB2E4."),
      datePreset: z9.enum(DATE_PRESETS).optional().describe("\uAE30\uAC04 \uD504\uB9AC\uC14B. since/until \uB300\uC2E0 \uC501\uB2C8\uB2E4."),
      timeIncrement: z9.enum(["allDays", "1"]).default("allDays").describe(
        'allDays=\uAE30\uAC04 \uD569\uACC4, 1=\uC77C\uBCC4 \uCD94\uC774. 1\uC740 \uACC4\uC815\uC5D0 \uB530\uB77C "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uAE30\uB2A5\uC785\uB2C8\uB2E4"(400)\uB85C \uAC70\uBD80\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uAC70\uBD80\uB418\uBA74 allDays\uB85C \uB2E4\uC2DC \uBD80\uB974\uC138\uC694.'
      ),
      breakdown: z9.enum(BREAKDOWNS).optional().describe(
        "\uBD84\uD574 \uCD95. pcMblTp=PC/\uBAA8\uBC14\uC77C, dayw=\uC694\uC77C, hh24=\uC2DC\uAC04\uB300, regnNo=\uC9C0\uC5ED. \uCD5C\uADFC 7\uC77C \uC774\uB0B4 \uAE30\uAC04\uC5D0\uC11C\uB9CC \uC4F8 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
      ),
      customerId: customerIdArg
    }),
    run: ({ ids, fields, since, until, datePreset, timeIncrement, breakdown, customerId }) => {
      if (since && !until || !since && until) {
        throw new Error("since\uC640 until\uC740 \uD568\uAED8 \uC9C0\uC815\uD574\uC57C \uD569\uB2C8\uB2E4.");
      }
      if (since && datePreset) {
        throw new Error("since/until\uACFC datePreset\uC740 \uB3D9\uC2DC\uC5D0 \uC4F8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD558\uB098\uB9CC \uC9C0\uC815\uD558\uC138\uC694.");
      }
      return client.get(
        "/stats",
        {
          // ids는 콤마 조인, fields는 JSON 배열 — /stats는 둘을 다르게 받는다.
          // ids를 JSON으로 보내면 "유효하지 않은 ID 형식입니다"(400, code 11001),
          // fields를 콤마로 보내면 "fields 파라미터 파싱 실패"가 난다.
          // 단건이어도 ids로 보낸다 — 응답 형태가 일관돼 모델이 파싱하기 쉽다.
          ids,
          fields: JSON.stringify(fields),
          timeIncrement,
          ...since && until ? { timeRange: JSON.stringify({ since, until }) } : {},
          ...datePreset ? { datePreset } : {},
          ...breakdown ? { breakdown } : {}
        },
        { customerId }
      );
    }
  });
}

// src/tools/index.ts
function registerAllTools(server, client) {
  registerCampaignTools(server, client);
  registerAdgroupTools(server, client);
  registerKeywordTools(server, client);
  registerAdTools(server, client);
  registerStatTools(server, client);
  registerAccountTools(server, client);
  registerRawTools(server, client);
}

// src/version.ts
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
function readVersion() {
  try {
    const path = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    if (typeof pkg === "object" && pkg !== null && "version" in pkg) {
      const { version } = pkg;
      if (typeof version === "string") return version;
    }
  } catch {
  }
  return "0.0.0";
}
var SERVER_VERSION = readVersion();

// src/server.ts
var SERVER_NAME = "naver-ads-mcp";
function createServer(config) {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: "\uB124\uC774\uBC84 \uAC80\uC0C9\uAD11\uACE0" },
    { capabilities: { tools: {} } }
  );
  registerAllTools(server, new NaverAdsClient(config));
  return server;
}

// src/index.ts
var log = (message) => {
  process.stderr.write(`[${SERVER_NAME}] ${message}
`);
};
var HELP = `${SERVER_NAME} v${SERVER_VERSION}
\uB124\uC774\uBC84 \uAC80\uC0C9\uAD11\uACE0 API\uB97C \uAC10\uC2FC stdio MCP \uC11C\uBC84.

\uC0AC\uC6A9\uBC95
  npx -y github:2duckchun/naver-ads-mcp

  \uC778\uC790 \uC5C6\uC774 \uC2E4\uD589\uD558\uBA74 stdin/stdout\uC73C\uB85C MCP \uD504\uB85C\uD1A0\uCF5C\uC744 \uC8FC\uACE0\uBC1B\uC2B5\uB2C8\uB2E4.
  \uC0AC\uB78C\uC774 \uC9C1\uC811 \uC2E4\uD589\uD558\uB294 \uBA85\uB839\uC774 \uC544\uB2C8\uB77C MCP \uD074\uB77C\uC774\uC5B8\uD2B8\uAC00 \uB744\uC6B0\uB294 \uD504\uB85C\uC138\uC2A4\uC785\uB2C8\uB2E4.

\uC635\uC158
  -h, --help      \uC774 \uB3C4\uC6C0\uB9D0\uC744 \uCD9C\uB825\uD569\uB2C8\uB2E4.
  -v, --version   \uBC84\uC804\uC744 \uCD9C\uB825\uD569\uB2C8\uB2E4.

\uD544\uC218 \uD658\uACBD\uBCC0\uC218
  NAVER_SA_API_KEY       \uC561\uC138\uC2A4\uB77C\uC774\uC120\uC2A4
  NAVER_SA_SECRET_KEY    \uBE44\uBC00\uD0A4
  NAVER_SA_CUSTOMER_ID   \uAD11\uACE0\uACC4\uC815 ID (\uC22B\uC790)

  \uAD11\uACE0\uC2DC\uC2A4\uD15C(https://manage.searchad.naver.com) > \uB3C4\uAD6C > API \uC0AC\uC6A9 \uAD00\uB9AC\uC5D0\uC11C \uBC1C\uAE09\uD569\uB2C8\uB2E4.

\uC120\uD0DD \uD658\uACBD\uBCC0\uC218
  NAVER_SA_BASE_URL      \uAE30\uBCF8\uAC12 https://api.searchad.naver.com
  NAVER_SA_TIMEOUT_MS    \uAE30\uBCF8\uAC12 15000
  NAVER_SA_MAX_RETRIES   \uAE30\uBCF8\uAC12 2

Claude Code\uC5D0 \uB4F1\uB85D
  claude mcp add naver-ads \\
    --env NAVER_SA_API_KEY=... \\
    --env NAVER_SA_SECRET_KEY=... \\
    --env NAVER_SA_CUSTOMER_ID=... \\
    -- npx -y github:2duckchun/naver-ads-mcp

\uBB38\uC11C: https://github.com/2duckchun/naver-ads-mcp
`;
function loadConfigOrExit() {
  try {
    return loadConfig();
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    log(`\uC124\uC815 \uBC29\uBC95\uC740 \`npx -y github:2duckchun/naver-ads-mcp --help\`\uB97C \uCC38\uACE0\uD558\uC138\uC694.`);
    process.exit(1);
  }
}
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${SERVER_VERSION}
`);
    return;
  }
  const config = loadConfigOrExit();
  const handle = serveStdio(() => createServer(config), {
    onerror: (error) => log(`transport error: ${error.message}`)
  });
  const shutdown = (signal) => {
    log(`${signal} \uC218\uC2E0, \uC885\uB8CC\uD569\uB2C8\uB2E4.`);
    void handle.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  log(`v${SERVER_VERSION} \uAE30\uB3D9 (customerId=${config.customerId}, ${config.baseUrl})`);
}
main();
