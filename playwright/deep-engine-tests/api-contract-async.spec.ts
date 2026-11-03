import { test, expect } from '../tests/fixtures/test-fixtures';
import { expectAsyncDeadlineGuard, expectContractSchema, expectIdempotentDelivery } from '../tests/support/contract-async-guards';

const orderContract = {
  type: 'object' as const,
  required: ['orderId', 'status', 'items'] as const,
  additionalProperties: false,
  properties: {
    orderId: { type: 'string' as const, required: true },
    status: { type: 'string' as const, required: true, enum: ['created', 'paid', 'shipped'] as const },
    items: {
      type: 'array' as const,
      required: true,
      items: {
        type: 'object' as const,
        properties: {
          sku: { type: 'string' as const, required: true },
          qty: { type: 'number' as const, required: true },
        },
      },
    },
  },
} as const satisfies import('../tests/support/contract-async-guards').ContractShape;

test.describe('@REQ-16-P7 Contract, async and data integrity checks (TC-16-P7-1..3)', () => {
  test('HM-12 - TC-16-P7-1 - AC-16-P7-1: valid contract passes and invalid nested payload is rejected @p0', async () => {
    const validOrder = {
      orderId: 'ORD-1001',
      status: 'paid',
      items: [{ sku: 'SKU-9', qty: 2 }],
    };

    expect(() => expectContractSchema({ orderId: 'ORD-1002', status: 'queued', items: [{ sku: 'SKU-9', qty: '2' }] }, orderContract, 'order')).toThrow(/queued|must be number/i);
    expectContractSchema(validOrder, orderContract, 'order');
    expect(validOrder.items[0]?.qty).toBe(2);
  });

  test('HM-12 - TC-16-P7-2 - AC-16-P7-2: duplicate and out-of-order events are deduplicated without double side effect @p0', async () => {
    const events = [
      { eventId: 'evt-001', correlationId: 'corr-42', sequence: 1, status: 'accepted' as const, receivedAt: '2026-11-03T12:00:00Z' },
      { eventId: 'evt-001', correlationId: 'corr-42', sequence: 1, status: 'accepted' as const, receivedAt: '2026-11-03T12:00:00Z' },
      { eventId: 'evt-002', correlationId: 'corr-42', sequence: 2, status: 'accepted' as const, receivedAt: '2026-11-03T12:00:03Z' },
      { eventId: 'evt-003', correlationId: 'corr-42', sequence: 3, status: 'rejected' as const, receivedAt: '2026-11-03T12:00:05Z' },
    ];

    const result = expectIdempotentDelivery(events);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.accepted).toEqual(['evt-001', 'evt-002', 'evt-003']);
    expect(result.sideEffects).toBe(2);

    const malformed = [
      { eventId: 'evt-090', correlationId: 'corr-99', sequence: 2, status: 'accepted' as const, receivedAt: '2026-11-03T12:03:00Z' },
      { eventId: 'evt-091', correlationId: 'corr-99', sequence: 1, status: 'accepted' as const, receivedAt: '2026-11-03T12:03:10Z' },
    ];

    expect(() => expectIdempotentDelivery(malformed)).toThrow(/Out-of-order/i);
  });

  test('HM-12 - TC-16-P7-3 - AC-16-P7-3: stale event beyond deadline is quarantined and timeline remains auditable @p1', async () => {
    const events = [
      { eventId: 'evt-700', correlationId: 'corr-800', sequence: 1, status: 'accepted' as const, receivedAt: '2026-11-03T12:01:30Z' },
      { eventId: 'evt-701', correlationId: 'corr-800', sequence: 2, status: 'dlq' as const, receivedAt: '2026-11-03T12:01:40Z' },
      { eventId: 'evt-702', correlationId: 'corr-800', sequence: 3, status: 'accepted' as const, receivedAt: '2026-11-03T12:00:10Z' },
    ];

    const result = expectAsyncDeadlineGuard(events, '2026-11-03T12:02:00Z', 90_000);
    expect(result.quarantined).toContain('evt-702');
    expect(result.accepted).toEqual(['evt-700', 'evt-701']);
    expect(result.reason).toContain('evt-702');
  });
});
