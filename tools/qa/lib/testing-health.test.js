'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { summariseHealth, buildRolloutReport, validateRolloutReadiness } = require('./testing-health');

test('summariseHealth: phân biệt pass lần đầu, retry-only pass và flaky', () => {
  const summary = summariseHealth([
    { id: 'run-1', status: 'pass', retryCount: 0, evidence: ['report.json'], reproducible: true },
    { id: 'run-2', status: 'pass', retryCount: 2, firstAttempt: false, evidence: ['report.json'], reproducible: true },
    { id: 'run-3', status: 'pass', retryCount: 1, flaky: true, evidence: ['report.json'], reproducible: true },
    { id: 'run-4', status: 'fail', retryCount: 0, quarantineReason: 'stale report', quarantined: true },
  ]);

  assert.equal(summary.totalRuns, 4);
  assert.equal(summary.firstAttemptPass, 1);
  assert.equal(summary.retriedPass, 2);
  assert.equal(summary.flaky, 1);
  assert.equal(summary.quarantined, 1);
  assert.equal(summary.readyForRollout, false);
  assert.equal(summary.falsePassRisk, true);
});

test('buildRolloutReport: retry-only pass và artifact thiếu phải block rollout', () => {
  const report = buildRolloutReport({
    scope: 'phase-8',
    owner: '@qa',
    startedAt: '2026-11-02T00:00:00Z',
    runs: [
      { id: 'run-1', status: 'pass', retryCount: 2, firstAttempt: false, evidence: [], missingArtifact: true },
      { id: 'run-2', status: 'pass', retryCount: 0, evidence: ['report.json'] },
    ],
  });

  assert.equal(report.ready, false);
  assert.match(report.issues.join(' '), /Retry-only pass/i);
  assert.match(report.issues.join(' '), /artifact/i);
  assert.equal(report.summary.falsePassRisk, true);
});

test('validateRolloutReadiness: chỉ chấp nhận report sạch, không flaky và có evidence đầy đủ', () => {
  const valid = validateRolloutReadiness({
    summary: {
      totalRuns: 3,
      falsePassRisk: false,
      missingArtifact: 0,
      evidenceMissing: 0,
      quarantined: 0,
      flaky: 0,
    },
  });

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);

  const blocked = validateRolloutReadiness({
    summary: {
      totalRuns: 0,
      falsePassRisk: true,
      missingArtifact: 1,
      evidenceMissing: 1,
      quarantined: 1,
      flaky: 1,
    },
  });

  assert.equal(blocked.valid, false);
  assert.equal(blocked.errors.length >= 5, true);
});
