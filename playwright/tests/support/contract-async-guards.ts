export type JsonFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type ContractField = {
  type: JsonFieldType;
  required?: boolean;
  enum?: readonly (string | number | boolean)[];
  properties?: Record<string, ContractField>;
  items?: ContractField;
};

export type ContractShape = {
  type: 'object';
  required: readonly string[];
  additionalProperties?: boolean;
  properties: Record<string, ContractField>;
};

function valueType(value: unknown): JsonFieldType {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'object';
  return typeof value as JsonFieldType;
}

export function expectContractSchema(payload: unknown, schema: ContractShape, label = 'payload'): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${label} must be an object`);
  }

  const record = payload as Record<string, unknown>;
  for (const field of schema.required) {
    if (!(field in record)) {
      throw new Error(`${label} missing required field: ${field}`);
    }
  }

  for (const [key, field] of Object.entries(schema.properties)) {
    const value = record[key];
    if (value === undefined) continue;
    if (field.enum && !field.enum.includes(value as never)) {
      throw new Error(`${label}.${key} has unsupported value '${String(value)}'`);
    }
    if (field.type === 'array') {
      if (!Array.isArray(value)) throw new Error(`${label}.${key} must be an array`);
      if (field.items && field.items.properties) {
        for (const item of value) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`${label}.${key}[] must be objects`);
          }
          expectContractSchema(item, { type: 'object', required: Object.keys(field.items.properties!).filter((name) => field.items!.properties![name].required), properties: field.items.properties! }, `${label}.${key}[]`);
        }
      }
      continue;
    }
    if (field.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label}.${key} must be an object`);
      }
      if (field.properties) {
        expectContractSchema(value, { type: 'object', required: Object.keys(field.properties).filter((name) => field.properties![name].required), properties: field.properties }, `${label}.${key}`);
      }
      continue;
    }
    if (valueType(value) !== field.type) {
      throw new Error(`${label}.${key} must be ${field.type}, got ${valueType(value)}`);
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in schema.properties)) {
        throw new Error(`${label} contains unsupported field: ${key}`);
      }
    }
  }
}

export type QueueEvent = {
  eventId: string;
  correlationId: string;
  sequence: number;
  status: 'accepted' | 'rejected' | 'dlq';
  receivedAt: string;
};

export function expectIdempotentDelivery(events: readonly QueueEvent[]): { accepted: string[]; duplicatesRemoved: number; sideEffects: number } {
  const seen = new Set<string>();
  const unique: QueueEvent[] = [];
  for (const event of events) {
    if (!seen.has(event.eventId)) {
      seen.add(event.eventId);
      unique.push(event);
    }
  }
  for (let idx = 1; idx < unique.length; idx++) {
    if (unique[idx].sequence <= unique[idx - 1].sequence) {
      throw new Error(`Out-of-order or duplicated delivery for correlation ${unique[idx].correlationId}`);
    }
  }
  return {
    accepted: unique.map((event) => event.eventId),
    duplicatesRemoved: events.length - unique.length,
    sideEffects: unique.filter((event) => event.status === 'accepted').length,
  };
}

export function expectAsyncDeadlineGuard(
  events: readonly QueueEvent[],
  nowIso: string,
  deadlineMs: number,
): { quarantined: string[]; accepted: string[]; reason: string } {
  const now = new Date(nowIso).getTime();
  const quarantined: string[] = [];
  const accepted: string[] = [];
  for (const event of events) {
    const age = now - new Date(event.receivedAt).getTime();
    if (age > deadlineMs) {
      quarantined.push(event.eventId);
    } else {
      accepted.push(event.eventId);
    }
  }
  if (quarantined.length > 0) {
    return { quarantined, accepted, reason: `events ${quarantined.join(', ')} exceeded deadline of ${deadlineMs}ms` };
  }
  return { quarantined: [], accepted, reason: 'within deadline' };
}
