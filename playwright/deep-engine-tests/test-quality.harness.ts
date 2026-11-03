import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvidenceManifest } from '../tests/support/evidence-manifest';
import { applyMutant, generateMutants, type Mutant } from '../tests/support/mutation-engine';
import { BASELINE_TITLE, mutantTitle, type AttemptLike } from '../tests/support/mutation-score';
import type { PropertyReport } from '../tests/support/prop-check';
import { prepareNestedRun, readManifests, runNested, type NestedRun } from './evidence-pipeline.harness';

/**
 * Harness cho test-quality.spec.ts (PLAN-16 Phase 5): mọi kiểm đi qua Playwright run thật (process
 * con, evidence reporter). Mutant chỉ sống trong `sandbox/<id>/` (bản sao bao đóng import của file
 * đích) — file repo không bao giờ bị sửa.
 */
const posix = (p: string) => p.split(path.sep).join('/');
const PW_ROOT = path.resolve(__dirname, '..');
const HERE = posix(__dirname);
let runCounter = 0;

const PROPERTY_SPEC = `
import { checkProperty } from '${posix(PW_ROOT)}/tests/support/prop-check';
import { percentile } from '${posix(PW_ROOT)}/tests/support/perf-metrics';
import { redactText } from '${posix(PW_ROOT)}/tests/support/evidence-redaction';
import { brokenPercentile, naiveRedact } from '${HERE}/test-quality.reference';
import { percentileProperty, redactionProperty } from '${HERE}/test-quality.properties';
const seed = Number(process.env.PROP_SEED ?? 20261103);
const cases = [
  ['real percentile', percentileProperty, percentile],
  ['real redaction', redactionProperty, (t) => redactText(t)],
  ['broken percentile', percentileProperty, brokenPercentile],
  ['broken redaction', redactionProperty, naiveRedact],
];
test.describe('@REQ-REF-Q nested properties', () => {
  for (const [label, prop, impl] of cases) {
    test('TC-REF-Q - AC-REF-Q property ' + label, async ({ evidence }) => {
      const report = checkProperty(prop.name, prop.arb, prop.predicate(impl), { seed, numRuns: 300, source: prop.source });
      evidence.attach('property-report.json', report);
      expect(report.status, JSON.stringify(report.failure)).toBe('PASSED');
    });
  }
});
`;

export function preparePropertyDir(label: string): string {
  return prepareNestedRun(label, { 'properties.spec.ts': PROPERTY_SPEC });
}

export function runProperties(dir: string, seed: number): NestedRun {
  return runNested(dir, ['specs/properties.spec.ts', '--workers=1'], { PROP_SEED: String(seed), EVIDENCE_RECORD_ENV: 'PROP_SEED' }, true, `r${++runCounter}`);
}

export function propertyReports(run: NestedRun): Map<string, PropertyReport> {
  const out = new Map<string, PropertyReport>();
  for (const m of readManifests(run)) {
    const a = m.artifacts.find((x) => x.name === 'property-report.json');
    if (a) out.set(m.identity.title.replace(/^.*property /, ''), JSON.parse(fs.readFileSync(path.join(run.runRoot, a.path), 'utf8')));
  }
  return out;
}

/** Bao đóng import tương đối (`./x`, `../y`) của một file TS trong repo playwright. */
function importClosure(rel: string, seen = new Set<string>()): Set<string> {
  if (seen.has(rel)) return seen;
  seen.add(rel);
  const src = fs.readFileSync(path.join(PW_ROOT, rel), 'utf8');
  for (const m of src.matchAll(/from '(\.\.?\/[^']+)'/g)) {
    const next = posix(path.normalize(path.join(path.dirname(rel), m[1]))) + '.ts';
    if (fs.existsSync(path.join(PW_ROOT, next))) importClosure(next, seen);
  }
  return seen;
}

export interface MutationRun {
  dir: string;
  target: string;
  mutants: Mutant[];
  run: NestedRun | null;
}

/** Sinh mutant cho `target` (đường dẫn tương đối trong playwright/), dựng sandbox + spec chạy suite `suite`. */
export function prepareMutation(
  label: string,
  opts: { target: string; suite: 'perfMetricsSuite' | 'referenceSuite'; startLine?: number; endLine?: number; operators?: string[]; extra?: Mutant[] },
): MutationRun {
  const source = fs.readFileSync(path.join(PW_ROOT, opts.target), 'utf8');
  const generated = generateMutants(source, { file: opts.target, startLine: opts.startLine, endLine: opts.endLine, operators: opts.operators });
  // `extra`: mutant dựng tay (vd làm hỏng cú pháp) để kiểm phân loại INVALID qua runner thật.
  const mutants = [...generated, ...(opts.extra ?? [])];
  const list = JSON.stringify(mutants.map((m) => m.id));
  const spec = `
import * as path from 'node:path';
import { SUITES } from '${HERE}/test-quality.kill-suites';
const suite = SUITES['${opts.suite}'];
test.describe.configure({ mode: 'parallel' });
test('${BASELINE_TITLE}', async () => {
  await suite(require('${posix(path.join(PW_ROOT, opts.target))}'));
});
for (const id of ${list}) {
  test('${mutantTitle('')}' + id, async () => {
    test.setTimeout(5_000);
    let mod: any = null;
    try {
      // require (CJS): Playwright transpile TS; import() với đường dẫn tuyệt đối Windows cần file:// URL.
      mod = require(path.join(__dirname, '..', 'sandbox', id, '${opts.target}'));
    } catch (err) {
      test.skip(true, 'INVALID_MUTANT: ' + String(err).slice(0, 200));
    }
    await suite(mod);
  });
}
`;
  const dir = prepareNestedRun(label, { 'mutants.spec.ts': spec });
  const closure = importClosure(opts.target);
  for (const m of mutants) {
    for (const rel of closure) {
      const to = path.join(dir, 'sandbox', m.id, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      const text = fs.readFileSync(path.join(PW_ROOT, rel), 'utf8');
      fs.writeFileSync(to, rel === opts.target ? applyMutant(text, m) : text);
    }
  }
  return { dir, target: opts.target, mutants, run: null };
}

export function runMutation(mr: MutationRun): MutationRun {
  const run = runNested(mr.dir, ['specs/mutants.spec.ts', '--workers=4'], {}, true, `r${++runCounter}`);
  return { ...mr, run };
}

/** Attempt của run mutation, lấy từ receipt (status) + manifest (thông điệp lỗi) — nguồn là runner thật. */
export function mutationAttempts(run: NestedRun): AttemptLike[] {
  const manifests = new Map<string, EvidenceManifest>(readManifests(run).map((m) => [m.identity.testId, m]));
  return (run.receipt?.attempts ?? []).map((a) => ({
    title: a.title,
    status: a.status,
    error: manifests.get(a.testId)?.outcome.errors[0]?.split('\n')[0] ?? null,
  }));
}

export const nestedIndex = (runs: NestedRun[]) =>
  runs.map((r) => ({ runId: r.receipt?.runId ?? null, runRoot: posix(path.relative(PW_ROOT, r.runRoot)), exitCode: r.exitCode, recordedEnv: r.receipt?.execution.recordedEnv ?? {} }));
