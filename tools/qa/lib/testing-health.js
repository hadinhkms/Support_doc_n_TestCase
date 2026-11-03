'use strict';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasEvidence(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const evidence = asArray(entry.evidence);
  return evidence.length > 0 || Boolean(entry.artifactPath || entry.tracePath || entry.reportPath);
}

function summariseHealth(entries) {
  const rows = asArray(entries);
  const summary = {
    totalRuns: rows.length,
    firstAttemptPass: 0,
    retriedPass: 0,
    flaky: 0,
    quarantined: 0,
    missingArtifact: 0,
    evidenceMissing: 0,
    reproducibleRuns: 0,
    falsePassRisk: false,
    readyForRollout: false,
    issues: [],
  };

  for (const entry of rows) {
    const retryCount = Number(entry.retryCount || 0);
    const wasRetry = retryCount > 0 || entry.passedAfterRetry === true || entry.firstAttempt === false;
    const status = String(entry.status || '').toLowerCase();

    if (status === 'pass' && !wasRetry) summary.firstAttemptPass += 1;
    if (status === 'pass' && wasRetry) summary.retriedPass += 1;
    if (entry.flaky === true || entry.flaky === 'true') summary.flaky += 1;
    if (entry.quarantined === true || entry.quarantineReason) summary.quarantined += 1;
    if (entry.missingArtifact === true) summary.missingArtifact += 1;
    if (!hasEvidence(entry)) summary.evidenceMissing += 1;
    if (entry.reproducible === true) summary.reproducibleRuns += 1;

    if (status === 'pass' && wasRetry) {
      summary.falsePassRisk = true;
      summary.issues.push(`pass-only-after-retry:${entry.id || 'unknown-run'}`);
    }
    if (entry.quarantineReason && /expired|stale|missing/i.test(entry.quarantineReason)) {
      summary.issues.push(`quarantine:${entry.id || 'unknown-run'}`);
    }
  }

  summary.readyForRollout =
    summary.totalRuns > 0 &&
    summary.falsePassRisk === false &&
    summary.missingArtifact === 0 &&
    summary.evidenceMissing === 0 &&
    summary.quarantined === 0 &&
    summary.flaky === 0;

  return summary;
}

function buildRolloutReport({ scope, owner, startedAt, notes, runs = [] }) {
  const summary = summariseHealth(runs);
  const issues = [...summary.issues];

  if (summary.falsePassRisk) {
    issues.push('Retry-only pass was not accepted as rollout evidence');
  }
  if (summary.missingArtifact > 0) {
    issues.push('Artifact upload or trace evidence is incomplete');
  }
  if (summary.evidenceMissing > 0) {
    issues.push('Required evidence for at least one run is missing');
  }

  return {
    scope,
    owner,
    startedAt,
    notes: notes || '',
    summary,
    ready: summary.readyForRollout,
    issues,
  };
}

function validateRolloutReadiness(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Rollout report is required');
  }

  const { summary = {} } = report;
  const errors = [];

  if (summary.totalRuns === 0) {
    errors.push('No runs were recorded for rollout decision');
  }
  if (summary.falsePassRisk) {
    errors.push('Retry-only success is not valid rollout evidence');
  }
  if (summary.missingArtifact > 0) {
    errors.push('Missing artifacts must be resolved before rollout');
  }
  if (summary.evidenceMissing > 0) {
    errors.push('Missing evidence blocks rollout readiness');
  }
  if (summary.quarantined > 0) {
    errors.push('Quarantined or stale evidence must be cleared');
  }
  if (summary.flaky > 0) {
    errors.push('Flaky execution data prevented rollout approval');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  summariseHealth,
  buildRolloutReport,
  validateRolloutReadiness,
};
