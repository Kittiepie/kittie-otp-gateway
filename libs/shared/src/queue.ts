import { OTP_CHANNELS, type OtpChannel } from './otp.js';

/**
 * RabbitMQ topology shared by the api (publisher) and the worker (consumer).
 *
 *   api ──publish(send)──▶ [otp exchange] ──send──▶ otp.send ──▶ worker
 *                               │  ▲                              │ fails
 *                         retry │  │ dead-letter after TTL        │
 *                               ▼  │                              │
 *                          otp.send.retry ◀──publish(retry)───────┤
 *                               dead ──▶ otp.send.dlq ◀──publish(dead) after the last try
 */
export const OTP_EXCHANGE = 'otp';

export const ROUTING_KEYS = {
  send: 'send',
  retry: 'retry',
  dead: 'dead',
} as const;

export const QUEUES = {
  send: 'otp.send',
  retry: 'otp.send.retry',
  dlq: 'otp.send.dlq',
} as const;

/** Total delivery tries, including the first one (FR-08). */
export const MAX_SEND_ATTEMPTS = 3;

/** How long a failed job waits in the retry queue: 5 s after try 1, 15 s after try 2. */
export function retryDelayMs(failedAttempt: number): number {
  return 5_000 * 3 ** (failedAttempt - 1);
}

/** The message body on `otp.send`. The plain code only travels inside the private network. */
export interface SendOtpJob {
  requestId: string;
  channel: OtpChannel;
  recipient: string;
  code: string;
  /** 1 for the first try, incremented on every retry. */
  attempt: number;
}

export function isSendOtpJob(value: unknown): value is SendOtpJob {
  if (typeof value !== 'object' || value === null) return false;
  const job = value as Record<string, unknown>;
  return (
    typeof job.requestId === 'string' &&
    typeof job.recipient === 'string' &&
    typeof job.code === 'string' &&
    typeof job.attempt === 'number' &&
    OTP_CHANNELS.includes(job.channel as OtpChannel)
  );
}

/** The subset of an amqplib channel needed to declare the topology. */
export interface TopologyChannel {
  assertExchange(name: string, type: string, options?: object): Promise<unknown>;
  assertQueue(name: string, options?: object): Promise<unknown>;
  bindQueue(queue: string, exchange: string, routingKey: string): Promise<unknown>;
}

/**
 * Declares exchange, queues and bindings. Safe to call from every process on every start:
 * RabbitMQ only creates what is missing. Arguments must match exactly between callers, or
 * RabbitMQ closes the channel with PRECONDITION_FAILED, which is why this lives in one place.
 */
export async function assertOtpTopology(channel: TopologyChannel): Promise<void> {
  await channel.assertExchange(OTP_EXCHANGE, 'direct', { durable: true });

  await channel.assertQueue(QUEUES.send, {
    durable: true,
    // A message the worker rejects (e.g. malformed JSON) goes straight to the DLQ.
    arguments: {
      'x-dead-letter-exchange': OTP_EXCHANGE,
      'x-dead-letter-routing-key': ROUTING_KEYS.dead,
    },
  });
  await channel.assertQueue(QUEUES.retry, {
    durable: true,
    // Nobody consumes this queue. When a message's TTL (`expiration`) runs out, RabbitMQ
    // dead-letters it back to the exchange with routing key `send`, i.e. into otp.send again.
    arguments: {
      'x-dead-letter-exchange': OTP_EXCHANGE,
      'x-dead-letter-routing-key': ROUTING_KEYS.send,
    },
  });
  await channel.assertQueue(QUEUES.dlq, { durable: true });

  await channel.bindQueue(QUEUES.send, OTP_EXCHANGE, ROUTING_KEYS.send);
  await channel.bindQueue(QUEUES.retry, OTP_EXCHANGE, ROUTING_KEYS.retry);
  await channel.bindQueue(QUEUES.dlq, OTP_EXCHANGE, ROUTING_KEYS.dead);
}
