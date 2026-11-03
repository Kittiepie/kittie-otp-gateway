import { setTimeout as sleep } from 'node:timers/promises';
import { ADMIN, startStack, type Stack } from './stack';

let stack: Stack;
let apiKey: string;
let adminToken: string;

interface Json {
  [key: string]: unknown;
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const res = await fetch(`${stack.apiUrl}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return {
    status: res.status,
    headers: res.headers,
    body: (await res.json().catch(() => ({}))) as Json,
  };
}

const asClient = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(path, { body, headers: { 'x-api-key': apiKey, ...headers } });

/** Polls Mailpit's API until the OTP email for `to` arrives, then reads the code from the subject. */
async function codeFromMailpit(to: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(
      `${stack.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const data = (await res.json()) as { messages?: { Subject: string }[] };
    const match = data.messages?.[0]?.Subject.match(/(\d{6})$/);
    if (match) return match[1];
    await sleep(250);
  }
  throw new Error(`No OTP email for ${to}`);
}

beforeAll(async () => {
  stack = await startStack();

  // Set up like an admin would: log in, create a client, keep its key.
  const login = await call('/admin/auth/login', { body: ADMIN });
  expect(login.status).toBe(200);
  adminToken = login.body.accessToken as string;

  const created = await call('/admin/clients', {
    body: { name: 'E2E client' },
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(created.status).toBe(201);
  apiKey = created.body.apiKey as string;
});

afterAll(async () => {
  await stack?.stop();
});

describe('OTP flow through api, RabbitMQ, worker and Mailpit', () => {
  it('delivers the code by email and verifies it exactly once', async () => {
    const to = 'happy-path@example.com';
    const requested = await asClient('/v1/otp/request', { recipient: to, channel: 'email' });
    expect(requested.status).toBe(202);
    const requestId = requested.body.requestId as string;

    const code = await codeFromMailpit(to);

    const verified = await asClient('/v1/otp/verify', { requestId, code });
    expect(verified).toMatchObject({ status: 200, body: { verified: true } });

    const again = await asClient('/v1/otp/verify', { requestId, code });
    expect(again.status).toBe(410);

    // The audit log saw every step, with the recipient masked.
    const log = await call(`/admin/logs/${requestId}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(log.body).toMatchObject({ status: 'VERIFIED', recipientMasked: 'h***@example.com' });
    expect((log.body.events as { type: string }[]).map((e) => e.type)).toEqual([
      'REQUESTED',
      'SENT',
      'VERIFIED',
    ]);
  });

  it('locks after 5 wrong codes, even for the right code', async () => {
    const to = 'locked@example.com';
    const { body } = await asClient('/v1/otp/request', { recipient: to, channel: 'email' });
    const requestId = body.requestId as string;
    const code = await codeFromMailpit(to);
    const wrong = code === '000000' ? '111111' : '000000';

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await asClient('/v1/otp/verify', { requestId, code: wrong })).status);
    }
    expect(statuses).toEqual([400, 400, 400, 400, 423]);
    expect((await asClient('/v1/otp/verify', { requestId, code })).status).toBe(423);
  });

  it('replays the first response for a repeated Idempotency-Key', async () => {
    const body = { recipient: 'idem@example.com', channel: 'email' };
    const headers = { 'Idempotency-Key': 'e2e-key-1' };
    const first = await asClient('/v1/otp/request', body, headers);
    const second = await asClient('/v1/otp/request', body, headers);

    expect(second.status).toBe(202);
    expect(second.body).toEqual(first.body);
    expect(second.headers.get('idempotent-replayed')).toBe('true');
  });

  it('rejects requests without a valid API key', async () => {
    const res = await call('/v1/otp/request', {
      body: { recipient: 'a@b.co', channel: 'email' },
      headers: { 'x-api-key': 'otp_000000000000.nope' },
    });
    expect(res.status).toBe(401);
  });
});
