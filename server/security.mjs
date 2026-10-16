import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function hashSecret(value) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 32).toString('hex')}`;
}
export function verifySecret(value, stored) {
  if (typeof value !== 'string' || value.length > 200 || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored ?? '')) return false;
  const [salt, expected] = stored.split(':');
  return timingSafeEqual(scryptSync(value, salt, 32), Buffer.from(expected, 'hex'));
}
