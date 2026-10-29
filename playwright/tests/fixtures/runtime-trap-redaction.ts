export type RuntimeFailureSource = 'pageerror' | 'console.error' | 'requestfailed' | 'http-5xx';

export interface RuntimeFailureRecord {
  source: RuntimeFailureSource;
  message: string;
  url?: string;
  method?: string;
  status?: number;
  resourceType?: string;
  timestamp: string;
  redactedHeaders?: Record<string, string>;
}

export interface RuntimeAllowRule {
  source: RuntimeFailureSource | '*';
  pattern: RegExp | string;
  status?: number;
  reason: string;
}

export interface RuntimeTrap {
  readonly records: ReadonlyArray<RuntimeFailureRecord>;
  allow(rule: RuntimeAllowRule): void;
  allowRecord(record: RuntimeFailureRecord): void;
  clearAllowed(): void;
  getUnexpectedRecords(): RuntimeFailureRecord[];
  flushBrowserQueue(): Promise<void>;
  assertClean(): void;
}

export interface InternalRuntimeTrap extends RuntimeTrap {
  getUnacknowledgedForTeardown(): RuntimeFailureRecord[];
}

const SENSITIVE_HEADER_NAME =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token)$/i;
const SENSITIVE_KEY_PART = /(token|secret|password|passwd|api[-_]?key|session|sid)/i;
const SENSITIVE_QUERY_PARAM =
  /([?&](?:token|access_token|refresh_token|api_key|apikey|password|secret|auth|key|session|sid)=)([^&#\s]+)/gi;
const SENSITIVE_AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;

export function redactSensitiveText(input: string): string {
  if (!input) return input;
  return input
    .replace(SENSITIVE_QUERY_PARAM, '$1[REDACTED]')
    .replace(SENSITIVE_AUTH_SCHEME, '$1 [REDACTED]');
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAME.test(key) || SENSITIVE_KEY_PART.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSensitiveText(value);
    }
  }
  return out;
}

export function matchesAllowRule(record: RuntimeFailureRecord, rule: RuntimeAllowRule): boolean {
  if (rule.source !== '*' && rule.source !== record.source) {
    return false;
  }
  if (rule.status !== undefined && rule.status !== record.status) {
    return false;
  }
  const haystacks = [record.message, record.url ?? ''];
  const { pattern } = rule;
  if (typeof pattern === 'string') {
    return haystacks.some((h) => h.includes(pattern));
  }
  return haystacks.some((h) => pattern.test(h));
}

function isCriticalResourceType(resourceType: string): boolean {
  return resourceType === 'document' || resourceType === 'xhr' || resourceType === 'fetch';
}

export function isBenignAbortedSubresource(
  url: string,
  resourceType: string,
  errorText: string,
): boolean {
  if (isCriticalResourceType(resourceType)) {
    return false;
  }
  if (url.endsWith('/favicon.ico')) {
    return true;
  }
  return /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(errorText);
}

