import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "money_check_admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "123456aA@";
const SESSION_SECRET = "money-check-temporary-admin-session-2026-v1";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(expiresAt: number) {
  return createHmac("sha256", SESSION_SECRET).update(`admin:${expiresAt}`).digest("base64url");
}

export function credentialsAreValid(username: string, password: string) {
  return safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD);
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE;
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isAdminSessionValid(value: string | undefined) {
  if (!value) return false;
  const [expiresValue, signature, ...extra] = value.split(".");
  if (!expiresValue || !signature || extra.length) return false;
  const expiresAt = Number(expiresValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(expiresAt));
}
