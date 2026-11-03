import { isSafeRelativePath, sha256 } from './evidence-integrity';
import { redactText } from './evidence-redaction';

/**
 * Repro recipe tối giản (reproduction-protocol §2) — người khác dựng lại state và chạy lại
 * mà không cần máy/phiên của tác giả. Recipe là DỮ LIỆU: chỉ sinh argv từ field đã validate,
 * không shell, không lệnh tự do, không giá trị env/secret/storageState (NFR B5).
 */
export const RECIPE_SCHEMA_VERSION = 'repro-recipe/1';

export interface ReproRecipe {
  schemaVersion: typeof RECIPE_SCHEMA_VERSION;
  id: string;
  businessContext: string;
  trace: { req: string[]; ac: string[]; tc: string[] };
  expected: { source: string | null; sha256: string | null };
  source: { qaRevision: string | null; appBuild: string | null };
  environment: Record<string, string | null>;
  roles: { alias: string; howToCreate: string }[];
  dataset: { schema: string; seedBase: number; reset: string };
  command: {
    tool: 'playwright-test';
    spec: string;
    specSha256: string;
    grep: string | null;
    repeatEach: number;
    workers: number;
  };
  /** Chỉ TÊN biến; người tái hiện tự cấp giá trị synthetic của họ. */
  envNames: string[];
  steps: string[];
  observable: {
    scenario: string;
    signature: string | null;
    signatureText: string | null;
    numerator: number;
    denominator: number;
  };
  limitations: string[];
}

export interface RecipeCheckOptions {
  /** Revision QA hiện tại của người tái hiện; khác recipe → STALE_RECIPE. */
  head?: string;
  secrets?: readonly string[];
  /** Đọc spec theo đường dẫn tương đối để so hash; null = không có file. */
  readSpec?: (relPath: string) => Buffer | null;
}

// Allowlist cho grep: đủ cho regex title (`|`, `[]`, `()`), không có nháy/%/$/; để kể cả khi một consumer
// lỡ chạy qua shell cũng không ghép được lệnh. Bản thân recipeArgs không bao giờ dùng shell.
const GREP_SAFE = /^[A-Za-z0-9 _.:@#[\]()|*+?^-]{1,200}$/;
// Env có thể đổi hành vi runtime/runner — không cho recipe khai.
const FORBIDDEN_ENV = /^(NODE_|PATH$|PW_|PLAYWRIGHT_|EVIDENCE_|DEBUG$)/;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const SESSION_HINT = /storageState|\.auth[\\/]|"cookies"\s*:|STORAGE_STATE|SESSION_FILE/i;
const isInt = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

function shapeProblems(r: ReproRecipe): string[] {
  const problems: string[] = [];
  if (r?.schemaVersion !== RECIPE_SCHEMA_VERSION) return [`UNSUPPORTED_RECIPE: ${String(r?.schemaVersion)}`];
  for (const key of ['id', 'businessContext'] as const) {
    if (typeof r[key] !== 'string' || !r[key].trim()) problems.push(`MISSING_FIELD: ${key}`);
  }
  if (!Array.isArray(r.steps) || r.steps.length === 0) problems.push('MISSING_FIELD: steps');
  if (!r.dataset || !Number.isInteger(r.dataset.seedBase) || !r.dataset.reset) problems.push('MISSING_FIELD: dataset seed/reset');
  if (!r.expected?.source || !r.expected?.sha256) problems.push('SPEC_GAP: recipe has no authoritative expected source/hash');
  if (!r.source?.qaRevision) problems.push('MISSING_FIELD: source.qaRevision');
  return problems;
}

function commandProblems(c: ReproRecipe['command']): string[] {
  if (!c) return ['MISSING_FIELD: command'];
  const problems: string[] = [];
  if (c.tool !== 'playwright-test') problems.push(`UNKNOWN_TOOL: ${String(c.tool)}`);
  if (typeof c.spec !== 'string' || !isSafeRelativePath(c.spec) || !/\.spec\.ts$/.test(c.spec) || /(^|\/)node_modules\//.test(c.spec)) {
    problems.push(`UNSAFE_PATH: command.spec '${String(c.spec)}'`);
  }
  if (c.grep !== null && (typeof c.grep !== 'string' || !GREP_SAFE.test(c.grep) || c.grep.startsWith('-'))) {
    problems.push('UNSAFE_ARG: command.grep');
  }
  if (!isInt(c.repeatEach, 3, 10)) problems.push(`REPEAT_EACH_OUT_OF_RANGE: ${String(c.repeatEach)} (3..10)`);
  if (!isInt(c.workers, 1, 8)) problems.push(`WORKERS_OUT_OF_RANGE: ${String(c.workers)}`);
  return problems;
}

export function validateRecipe(input: unknown, options: RecipeCheckOptions = {}): string[] {
  const recipe = input as ReproRecipe;
  const problems = shapeProblems(recipe);
  if (problems[0]?.startsWith('UNSUPPORTED_RECIPE')) return problems;
  problems.push(...commandProblems(recipe.command));
  for (const name of Array.isArray(recipe.envNames) ? recipe.envNames : ['<missing>']) {
    if (typeof name !== 'string' || !ENV_NAME.test(name)) problems.push(`ENV_VALUE_EMBEDDED: '${String(name)}' is not a bare env name`);
    else if (FORBIDDEN_ENV.test(name)) problems.push(`FORBIDDEN_ENV: '${name}' changes the runtime/runner`);
  }
  const text = JSON.stringify(recipe);
  if (SESSION_HINT.test(text)) problems.push('SESSION_STATE: recipe references a stored login/session');
  if (redactText(text, options.secrets ?? []) !== text) problems.push('SECRET_LIKE_CONTENT: recipe would change under redaction');
  if (options.head && recipe.source?.qaRevision !== options.head) {
    problems.push(`STALE_RECIPE: recipe ${recipe.source?.qaRevision} != current ${options.head}`);
  }
  if (options.readSpec && typeof recipe.command?.spec === 'string' && isSafeRelativePath(recipe.command.spec)) {
    const spec = options.readSpec(recipe.command.spec);
    if (!spec) problems.push(`SPEC_MISSING: ${recipe.command.spec}`);
    else if (sha256(spec) !== recipe.command.specSha256) problems.push(`SPEC_CHANGED: ${recipe.command.spec}`);
  }
  return problems;
}

/** Argv cho `playwright test -c <config>` — chỉ từ field đã validate; recipe lỗi thì từ chối. */
export function recipeArgs(recipe: ReproRecipe, options: RecipeCheckOptions & { readSpec: RecipeCheckOptions['readSpec'] }): string[] {
  // Không có readSpec thì không kiểm được specSha256 → không chạy.
  const problems = options.readSpec ? validateRecipe(recipe, options) : ['SPEC_UNVERIFIED: readSpec is required to run'];
  if (problems.length > 0) throw new Error(`RECIPE_REJECTED: ${problems.join('; ')}`);
  const c = recipe.command;
  const args = [c.spec, `--repeat-each=${c.repeatEach}`, '--retries=0', `--workers=${c.workers}`];
  return c.grep ? [...args, '--grep', c.grep] : args;
}

/** Env tái hiện chỉ gồm các tên recipe khai báo, giá trị do người tái hiện cấp. */
export function replayEnv(recipe: ReproRecipe, provided: Record<string, string>) {
  const env: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of recipe.envNames) {
    if (provided[name]) env[name] = provided[name];
    else missing.push(name);
  }
  return { env, problems: missing.map((n) => `MISSING_ENV: ${n}`) };
}
