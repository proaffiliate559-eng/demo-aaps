import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrToken, verifyQrToken } from '../../lib/qr-token';
import { classifyScan } from '../../lib/qr-classify';
import { normalizePhone, maskPhone } from '../../lib/phone';
import { toAppError } from '../../lib/errors';
import { rateLimit } from '../../lib/rate-limit';
import { can } from '../../lib/permissions';

const SECRET = 'x'.repeat(40);
const T = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';

test('valid token verifies and returns ids', () => {
  const { token } = createQrToken(T, C, SECRET, 1_000_000);
  const r = verifyQrToken(token, SECRET, T, 1_000_000 + 60_000);
  assert.deepEqual(r.ok && [r.tenantId, r.customerId], [T, C]);
});

test('token expires after TTL', () => {
  const { token } = createQrToken(T, C, SECRET, 1_000_000);
  const r = verifyQrToken(token, SECRET, T, 1_000_000 + 121_000);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, 'expired');
});

test('tampered payload is rejected', () => {
  const { token } = createQrToken(T, C, SECRET);
  const [p, body, sig] = token.split('.');
  const forged = JSON.parse(Buffer.from(body, 'base64url').toString());
  forged.c = '33333333-3333-4333-8333-333333333333';
  const bad = [p, Buffer.from(JSON.stringify(forged)).toString('base64url'), sig].join('.');
  const r = verifyQrToken(bad, SECRET, T);
  assert.equal(!r.ok && r.reason, 'bad_signature');
});

test('wrong secret and wrong tenant are rejected', () => {
  const { token } = createQrToken(T, C, SECRET);
  assert.equal((verifyQrToken(token, 'y'.repeat(40), T) as { reason: string }).reason, 'bad_signature');
  assert.equal((verifyQrToken(token, SECRET, C) as { reason: string }).reason, 'wrong_tenant');
});

test('short secret is refused', () => {
  assert.throws(() => createQrToken(T, C, 'short'));
});

test('scanner classifies QR contents', () => {
  const { token } = createQrToken(T, C, SECRET);
  assert.equal(classifyScan(token).kind, 'customer');
  assert.deepEqual(classifyScan('CR:R:ABCD2345'), { kind: 'redemption', code: 'ABCD2345' });
  assert.deepEqual(classifyScan('abcd2345'), { kind: 'redemption', code: 'ABCD2345' });
  assert.equal(classifyScan('https://x.in/q/AB').kind, 'url');
  assert.equal(classifyScan('hello').kind, 'unknown');
});

test('phone normalisation matches the database rules', () => {
  assert.equal(normalizePhone('98765 43210'), '+919876543210');
  assert.equal(normalizePhone('919876543210'), '+919876543210');
  assert.equal(normalizePhone('+91-98765-43210'), '+919876543210');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('5876543210'), null);
  assert.equal(maskPhone('+919876543210'), '+91 98•••••210');
});

test('database business errors become friendly messages', () => {
  assert.deepEqual(toAppError({ code: 'P0001', hint: 'duplicate_bill', message: 'This bill number was already recorded' }),
    { code: 'duplicate_bill', message: 'This bill number was already recorded', status: 409 });
  assert.equal(toAppError({ code: '42501' }).status, 403);
  assert.equal(toAppError(new Error('boom')).status, 500);
});

test('rate limiter blocks after the limit and resets', () => {
  const k = 'test-' + Math.random();
  assert.equal(rateLimit(k, 2, 1000, 0).ok, true);
  assert.equal(rateLimit(k, 2, 1000, 1).ok, true);
  assert.equal(rateLimit(k, 2, 1000, 2).ok, false);
  assert.equal(rateLimit(k, 2, 1000, 1001).ok, true);
});

test('UI permissions mirror database roles', () => {
  assert.equal(can('cashier', 'record_purchases'), true);
  assert.equal(can('cashier', 'manage_loyalty'), false);
  assert.equal(can('manager', 'manage_staff'), false);
  assert.equal(can('owner', 'manage_billing'), true);
  assert.equal(can('marketing', 'redeem_rewards'), false);
});
