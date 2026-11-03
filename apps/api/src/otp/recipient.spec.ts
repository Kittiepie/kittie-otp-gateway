import { isValidRecipient, maskRecipient, normalizeRecipient } from './recipient';

describe('recipient helpers', () => {
  it('normalizes emails and phone numbers', () => {
    expect(normalizeRecipient('email', '  Alice@Example.COM ')).toBe('alice@example.com');
    expect(normalizeRecipient('sms', '+84 (90) 123-4567')).toBe('+84901234567');
  });

  it.each([
    ['email', 'a@b.co', true],
    ['email', 'not-an-email', false],
    ['sms', '+84901234567', true],
    ['sms', '0901234567', true],
    ['sms', '12345', false],
    ['sms', 'call-me', false],
  ] as const)('validates %s %s -> %s', (channel, value, valid) => {
    expect(isValidRecipient(channel, value)).toBe(valid);
  });

  it('masks recipients as in NFR-04', () => {
    expect(maskRecipient('email', 'alice@gmail.com')).toBe('a***@gmail.com');
    expect(maskRecipient('sms', '0901234512')).toBe('09******12');
  });
});
