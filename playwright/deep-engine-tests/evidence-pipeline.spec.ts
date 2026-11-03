import { expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evidenceTest as test } from '../tests/fixtures/evidence.fixture';
import { createEvidenceCollector, type EvidenceIo } from '../tests/support/evidence-collector';
import { resolveInsideRoot, sha256 } from '../tests/support/evidence-integrity';
import { evaluateExport, validateEvidenceManifest } from '../tests/support/evidence-manifest';
import { verifyEvidenceBundle } from '../tests/support/evidence-receipt';
import { REDACTED, redactArgv } from '../tests/support/evidence-redaction';
import { readSourceIdentity, type RunContext } from '../tests/support/evidence-run';
import {
  cloneBundle,
  gitHead,
  listFiles,
  newCanary,
  prepareNestedRun,
  readManifests,
  runNested,
} from './evidence-pipeline.harness';

/**
 * Phase 1 — Evidence foundation (PLAN-16, TC-16-P1-1..3).
 * Public caller: một Playwright run thật (process con) dùng fixture `evidence` + evidence-reporter,
 * sau đó verifier đọc lại bundle từ đĩa. Fault injection đi qua cùng đường đó.
 */
const HEALTHY_SPEC = `
test.describe('@REQ-16-P1 nested healthy control', () => {
  for (const n of [1, 2]) {
    test(\`TC-16-P1-1 - AC-16-P1-1 healthy \${n}\`, async ({ evidence }) => {
      evidence.attach('screen.png', Buffer.from('SYNTHETIC-PNG-' + n), { mime: 'image/png', synthetic: true });
      evidence.attach('state.json', { step: n, persisted: true });
      evidence.observe({ expectedSource: 'AC-16-P1-1', expected: 'persisted', actual: 'persisted', anchor: 'healthy.spec.ts' });
      expect(n).toBeGreaterThan(0);
    });
  }
});
`;

const SECRET_SPEC = `
const pw = process.env.TEST_USER_PASSWORD as string;
const canary = process.env.EVIDENCE_SECRET_CANARIES as string;
test.describe('@REQ-16-P1 nested secrets', () => {
  test('TC-16-P1-2 - AC-16-P1-2 redacts nested payloads', async ({ evidence }) => {
    evidence.attach('request.json', {
      url: 'https://app.test/api/orders?token=' + canary + '&page=1',
      headers: { Authorization: 'Bearer ' + canary, 'X-Trace': 'trace-1' },
      body: JSON.stringify({ user: 'qa-alias', password: pw, nested: { otp: canary } }),
    });
    evidence.attach('console.log', 'login ok with ' + pw + '\\nCookie: session=' + canary, { mime: 'text/plain' });
    evidence.attach('dom.html', '<input name="pw" value="' + pw + '">', { mime: 'text/html' });
    evidence.attach('screenshot.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from(pw)]), { mime: 'image/png', synthetic: true });
    evidence.attach('trace.zip', Buffer.from('PK-synthetic-trace'), { mime: 'application/zip' });
    expect(evidence.errors).toHaveLength(0);
  });
  test('TC-16-P1-2 - AC-16-P1-2 assertion message carries a secret', async ({ evidence }) => {
    evidence.attach('note.txt', 'about to fail', { mime: 'text/plain' });
    expect('token=' + canary).toBe('token=expected');
  });
});
`;

const FAULT_SPEC = `
import * as fs from 'node:fs';
import * as path from 'node:path';
test.describe('@REQ-16-P1 nested write failure', () => {
  test('TC-16-P1-3 - AC-16-P1-3 write failure on a passing test', async ({ evidence }) => {
    fs.mkdirSync(path.join(evidence.attemptDir, 'screen.png'), { recursive: true });
    expect(evidence.attach('screen.png', Buffer.from('x'), { mime: 'image/png' })).toBeNull();
  });
});
test.describe('@REQ-16-P1 nested teardown failure', () => {
  test.afterEach(async ({ evidence }) => {
    await evidence.cleanup('drop-user', () => { throw new Error('cleanup boom'); }, () => ({ users: ['alias-1'] }));
    throw new Error('teardown boom');
  });
  test('TC-16-P1-3 - AC-16-P1-3 original failure kept with teardown failure', async ({ evidence }) => {
    evidence.attach('state.json', { order: 'alias-order-1' });
    expect(1, 'original assertion').toBe(2);
  });
});
test.describe('@REQ-16-P1 nested retry', () => {
  test.describe.configure({ retries: 1 });
  test('TC-16-P1-3 - AC-16-P1-3 flaky attempt keeps both manifests', async ({ evidence }) => {
    evidence.attach('attempt.json', { retry: test.info().retry });
    expect(test.info().retry, 'first attempt fails on purpose').toBe(1);
  });
});
`;

function baseContext(root: string): RunContext {
  return {
    runId: 'probe',
    root,
    argv: ['playwright', 'test'],
    cwd: root,
    startedAt: new Date().toISOString(),
    source: readSourceIdentity(path.resolve(__dirname, '..')),
  };
}

const PROBE_ID = {
  testId: 'probe-test',
  title: 'TC-16-P1-3 - AC-16-P1-3 probe',
  file: 'probe.spec.ts',
  project: 'chromium',
  retryIndex: 0,
  repeatIndex: 0,
  workerIndex: 0,
  parallelIndex: 0,
  shard: null,
  tags: ['@REQ-16-P1'],
  environment: {},
};

test.describe('@REQ-16-P1 Phase 1 - Evidence pipeline (TC-16-P1-1..3)', () => {
  // Mỗi test spawn Playwright run con; chạy tuần tự trong một worker để không tranh tài nguyên.
  test.describe.configure({ mode: 'default', timeout: 180_000 });

  test('HM-10 - TC-16-P1-1 - AC-16-P1-1: healthy control records identity, command, counts and hashes per attempt', async ({ evidence }) => {
    const head = gitHead();
    const run = runNested(prepareNestedRun('healthy', { 'healthy.spec.ts': HEALTHY_SPEC }), [
      '--workers=2',
      '--repeat-each=2',
    ]);
    evidence.attach('nested-healthy-receipt.json', run.receipt ?? { missing: true, output: run.output });
    expect(run.exitCode, run.output).toBe(0);
    const receipt = run.receipt!;
    expect(receipt.execution.exitCode).toBe(run.exitCode);
    expect(receipt.execution.argv).toEqual(['playwright', 'test', '-c', 'nested.config.ts', '--workers=2', '--repeat-each=2']);
    expect(receipt.source.qaRevision).toBe(head);
    expect(typeof receipt.source.dirty).toBe('boolean');
    expect(receipt.trust).toBe(receipt.source.dirty ? 'INVESTIGATION_ONLY' : 'TRUSTED_CANDIDATE');
    expect(receipt.counts).toMatchObject({ matched: 4, expected: 4, unexpected: 0, flaky: 0, attempts: 4 });
    expect(receipt.junit?.sha256).toBe(sha256(fs.readFileSync(path.join(run.runRoot, 'junit.xml'))));
    expect(receipt.verdict).toEqual({ evidence: 'COMPLETE', problems: [] });

    const manifests = readManifests(run);
    expect(manifests).toHaveLength(4);
    expect(new Set(manifests.map((m) => m.attempt.attemptId)).size).toBe(4);
    expect(new Set(manifests.map((m) => m.attempt.repeatIndex))).toEqual(new Set([0, 1]));
    for (const m of manifests) {
      expect(validateEvidenceManifest(m)).toEqual({ valid: true, errors: [] });
      expect(m.identity.trace).toEqual({ req: ['REQ-16-P1'], ac: ['AC-16-P1-1'], tc: ['TC-16-P1-1'] });
      expect(m.source.qaRevision).toBe(head);
      expect(m.worktree.dirty === false || /^[0-9a-f]{64}$/.test(m.worktree.diffDigest ?? '')).toBe(true);
      expect(m.environment).toMatchObject({ node: process.version, configHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
      expect(m.artifacts.map((a) => a.name)).toEqual(['screen.png', 'state.json']);
    }
    const screenPaths = manifests.flatMap((m) => m.artifacts.filter((a) => a.name === 'screen.png').map((a) => a.path));
    expect(new Set(screenPaths).size).toBe(4);

    const verification = verifyEvidenceBundle(run.runRoot, { expectedRevision: head });
    expect(verification.problems).toEqual([]);
    expect(verification.ok).toBe(true);
  });

  test('HM-10 - TC-16-P1-2 - AC-16-P1-2: secret canaries never reach shareable JSON/log/DOM; binaries and JUnit are restricted', async ({ evidence }) => {
    const pw = newCanary('Pw');
    const canary = newCanary('CANARY-P1');
    const run = runNested(
      prepareNestedRun('secrets', { 'secrets.spec.ts': SECRET_SPEC }),
      ['--workers=1'],
      { TEST_USER_PASSWORD: pw, EVIDENCE_SECRET_CANARIES: canary },
    );
    expect(run.exitCode, run.output).toBe(1);
    const receipt = run.receipt!;
    expect(receipt.execution.exitCode).toBe(1);
    expect(receipt.counts).toMatchObject({ matched: 2, expected: 1, unexpected: 1 });

    const manifests = readManifests(run);
    const artifacts = manifests.flatMap((m) => m.artifacts);
    const byName = Object.fromEntries(artifacts.map((a) => [a.name, a]));
    expect(byName['request.json'].sensitivity).toBe('SHAREABLE');
    expect(byName['console.log'].sensitivity).toBe('SHAREABLE');
    expect(byName['dom.html'].sensitivity).toBe('SHAREABLE');
    expect(byName['screenshot.png'].sensitivity).toBe('RESTRICTED');
    expect(byName['trace.zip'].sensitivity).toBe('RESTRICTED');
    expect(receipt.junit?.sensitivity).toBe('RESTRICTED');

    const request = JSON.parse(fs.readFileSync(path.join(run.runRoot, byName['request.json'].path), 'utf8'));
    expect(request.headers).toEqual({ Authorization: REDACTED, 'X-Trace': 'trace-1' });
    expect(request.url).toBe(`https://app.test/api/orders?token=${REDACTED}&page=1`);

    const restricted = new Set([...artifacts.filter((a) => a.sensitivity === 'RESTRICTED').map((a) => a.path), 'junit.xml']);
    const shareable = listFiles(run.runRoot).filter((rel) => !restricted.has(rel));
    expect(shareable).toEqual(expect.arrayContaining(['run-receipt.json', byName['request.json'].path]));
    const leaks = shareable.filter((rel) => {
      const text = fs.readFileSync(path.join(run.runRoot, rel)).toString('utf8');
      return text.includes(pw) || text.includes(canary);
    });
    expect(leaks).toEqual([]);
    const failing = manifests.find((m) => m.outcome.status === 'failed')!;
    expect(failing.outcome.errors.join('\n')).toContain(`token=${REDACTED}`);

    const exportDecision = evaluateExport(manifests);
    expect(exportDecision.allowed).toBe(false);
    expect(exportDecision.blocked).toEqual(expect.arrayContaining([byName['screenshot.png'].path, byName['trace.zip'].path]));

    expect(redactArgv(['playwright', 'test', '--token', canary, `--url=https://x.test/?api_key=${canary}`])).toEqual([
      'playwright', 'test', '--token', REDACTED, `--url=https://x.test/?api_key=${REDACTED}`,
    ]);
    const leakyManifest = { ...manifests[0], execution: { ...manifests[0].execution, argv: ['test', `Bearer ${canary}`] } };
    expect(validateEvidenceManifest(leakyManifest).errors.join()).toContain('SECRET_LEAK_DETECTED');
    evidence.attach('nested-secrets-receipt.json', receipt);
  });

  test('HM-10 - TC-16-P1-3 - AC-16-P1-3: missing/tampered/stale evidence, write and cleanup failures are reported separately', async ({ evidence }) => {
    const head = gitHead();
    const faults = runNested(prepareNestedRun('faults', { 'faults.spec.ts': FAULT_SPEC }), ['--workers=2']);
    evidence.attach('nested-faults-receipt.json', faults.receipt ?? { missing: true, output: faults.output });
    expect(faults.exitCode, faults.output).toBe(1);
    const receipt = faults.receipt!;
    expect(receipt.counts).toMatchObject({ matched: 3, unexpected: 2, flaky: 1, attempts: 4 });
    expect(receipt.verdict.evidence).toBe('INCOMPLETE');
    expect(receipt.verdict.problems.join('\n')).toMatch(/COLLECTION_ERROR[\s\S]*PARTIAL_EVIDENCE/);

    const manifests = readManifests(faults);
    const write = manifests.find((m) => m.identity.title.includes('write failure'))!;
    expect(write.status).toBe('PARTIAL');
    expect(write.outcome.status).toBe('passed');
    expect(write.collection.errors.map((e) => e.stage)).toEqual(['write']);
    expect(receipt.attempts.find((a) => a.title.includes('write failure'))?.status).toBe('failed');

    const teardown = manifests.find((m) => m.identity.title.includes('teardown failure'))!;
    expect(teardown.outcome.errors.join('\n')).toMatch(/original assertion[\s\S]*teardown boom/);
    expect(teardown.cleanup).toEqual([expect.objectContaining({ label: 'drop-user', outcome: 'FAILED', error: 'cleanup boom' })]);
    const before = teardown.artifacts.find((a) => a.name === 'before-cleanup-drop-user.json')!;
    expect(Date.parse(before.capturedAt)).toBeLessThanOrEqual(Date.parse(teardown.cleanup[0].at));

    const flaky = manifests.filter((m) => m.identity.title.includes('flaky'));
    expect(flaky.map((m) => [m.attempt.retryIndex, m.outcome.status])).toEqual([[0, 'failed'], [1, 'passed']]);
    expect(verifyEvidenceBundle(faults.runRoot).ok).toBe(false);

    // Tamper / stale / missing trên bản sao của một bundle khỏe.
    const healthy = runNested(prepareNestedRun('tamper', { 'healthy.spec.ts': HEALTHY_SPEC }), ['--workers=2']);
    expect(healthy.receipt?.verdict.evidence, healthy.output).toBe('COMPLETE');
    const art = readManifests(healthy)[0].artifacts[0];
    const manifestRel = healthy.receipt!.attempts[0].manifest!.path;
    const probe = (label: string, mutate: (root: string) => void, opts?: { expectedRevision?: string }) => {
      const root = cloneBundle(healthy, label);
      mutate(root);
      return verifyEvidenceBundle(root, opts).problems.join('\n');
    };
    expect(probe('size', (r) => fs.appendFileSync(path.join(r, art.path), 'x'))).toContain('SIZE_MISMATCH');
    expect(probe('hash', (r) => fs.writeFileSync(path.join(r, art.path), Buffer.alloc(art.bytes, 0x41)))).toContain(
      'HASH_MISMATCH',
    );
    expect(probe('missing', (r) => fs.rmSync(path.join(r, art.path)))).toContain('MISSING_ARTIFACT');
    expect(probe('manifest', (r) => fs.appendFileSync(path.join(r, manifestRel), ' '))).toContain('MANIFEST_TAMPERED');
    expect(probe('junit', (r) => fs.rmSync(path.join(r, 'junit.xml')))).toContain('JUNIT_UNREADABLE');
    expect(probe('stale', () => undefined, { expectedRevision: '0'.repeat(40) })).toContain('STALE_REVISION');
    expect(probe('clean', () => undefined, { expectedRevision: head })).toBe('');
    const traversal = probe('traversal', (r) => {
      const receiptPath = path.join(r, 'run-receipt.json');
      const tampered = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      tampered.attempts[0].manifest.path = '../../../package.json';
      tampered.junit.path = 'C:/Windows/win.ini';
      fs.writeFileSync(receiptPath, JSON.stringify(tampered));
    });
    expect(traversal).toMatch(/MANIFEST_UNREADABLE: \.\.\/\.\.\/\.\.\/package\.json: UNSAFE_PATH/);
    expect(traversal).toContain('JUNIT_UNREADABLE: UNSAFE_PATH');

    // Junction/symlink thư mục trỏ ra ngoài run root bị chặn.
    const escapeRoot = cloneBundle(healthy, 'escape');
    fs.symlinkSync(path.resolve(__dirname), path.join(escapeRoot, 'outside'), 'junction');
    expect(() => resolveInsideRoot(escapeRoot, 'outside/evidence-pipeline.spec.ts')).toThrow(/SYMLINK_REJECTED/);

    // Tombstone: hết hạn mà vẫn ACTIVE bị từ chối; EXPIRED_UNAVAILABLE được chấp nhận và báo unavailable.
    const expired = { ...readManifests(healthy)[0] };
    expired.artifacts = [{ ...art, expiresAt: '2020-01-01T00:00:00Z' }];
    expect(validateEvidenceManifest(expired).errors.join()).toContain('EXPIRED_ARTIFACT_VIOLATION');
    expired.artifacts = [{ ...art, expiresAt: '2020-01-01T00:00:00Z', status: 'EXPIRED_UNAVAILABLE' }];
    expect(validateEvidenceManifest(expired).valid).toBe(true);

    // Disk full / permission denied / trùng namespace qua IO injection trên collector.
    const probeRoot = path.join(faults.dir, 'collector-probes');
    const diskFull: EvidenceIo = {
      mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
      writeNew: () => {
        throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      },
      read: (file) => fs.readFileSync(file),
    };
    const full = createEvidenceCollector(baseContext(probeRoot), PROBE_ID, { io: diskFull });
    expect(full.attach('screen.png', Buffer.from('x'), { mime: 'image/png' })).toBeNull();
    const fullResult = full.finalize({ status: 'failed', expectedStatus: 'passed', errors: ['original failure'] });
    expect(fullResult.manifestPath).toBeNull();
    expect(fullResult.manifest.status).toBe('PARTIAL');
    expect(fullResult.manifest.outcome.errors).toEqual(['original failure']);
    expect(full.errors.map((e) => e.stage)).toEqual(['write', 'manifest']);

    const first = createEvidenceCollector(baseContext(probeRoot), { ...PROBE_ID, testId: 'dup' });
    first.attach('screen.png', Buffer.from('first'), { mime: 'image/png', synthetic: true });
    const second = createEvidenceCollector(baseContext(probeRoot), { ...PROBE_ID, testId: 'dup' });
    expect(second.attemptDir).not.toBe(first.attemptDir);
    expect(second.errors.map((e) => e.message).join()).toContain('ATTEMPT_NAMESPACE_COLLISION');
    second.attach('screen.png', Buffer.from('second'), { mime: 'image/png', synthetic: true });
    expect(fs.readFileSync(path.join(first.attemptDir, 'screen.png'), 'utf8')).toBe('first');
  });
});
