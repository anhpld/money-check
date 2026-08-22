import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const REMOTE_AVATAR_TIMEOUT_MS = 8_000;
const AVATAR_KEY_PATTERN = /^[0-9a-f-]{36}-[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;

const AVATAR_TYPES = {
  "image/jpeg": { extension: "jpg", signature: (data: Buffer) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: "png", signature: (data: Buffer) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", signature: (data: Buffer) => data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;

export class AvatarValidationError extends Error {}

function avatarDirectory() {
  const configuredDirectory = process.env.AVATAR_STORAGE_DIR?.trim();
  return path.resolve(/*turbopackIgnore: true*/ configuredDirectory || path.join(process.cwd(), "storage", "avatars"));
}

function avatarPath(key: string) {
  if (!AVATAR_KEY_PATTERN.test(key) || path.basename(key) !== key) {
    throw new AvatarValidationError("Tên file ảnh đại diện không hợp lệ.");
  }
  return path.join(/*turbopackIgnore: true*/ avatarDirectory(), key);
}

function mimeTypeFromKey(key: string) {
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  throw new AvatarValidationError("Định dạng ảnh đại diện không hợp lệ.");
}

export function getAvatarUpload(formData: FormData) {
  const value = formData.get("avatar");
  return value instanceof File && value.size > 0 ? value : null;
}

function isAllowedFacebookHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "fbcdn.net"
    || normalized.endsWith(".fbcdn.net")
    || normalized === "facebook.com"
    || normalized.endsWith(".facebook.com");
}

export function isAllowedRemoteAvatarUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isAllowedFacebookHost(url.hostname);
  } catch {
    return false;
  }
}

async function saveAvatarData(data: Buffer, mimeType: string, userId: string) {
  if (data.byteLength > MAX_AVATAR_BYTES) {
    throw new AvatarValidationError("Ảnh đại diện không được vượt quá 2 MB.");
  }

  const type = AVATAR_TYPES[mimeType as keyof typeof AVATAR_TYPES];
  if (!type) {
    throw new AvatarValidationError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.");
  }

  if (!type.signature(data)) {
    throw new AvatarValidationError("Nội dung file ảnh không hợp lệ.");
  }

  const key = `${userId}-${randomUUID()}.${type.extension}`;
  await mkdir(avatarDirectory(), { recursive: true });
  await writeFile(avatarPath(key), data, { flag: "wx" });
  return key;
}

export async function saveUploadedAvatar(file: File, userId: string) {
  if (file.size > MAX_AVATAR_BYTES) {
    throw new AvatarValidationError("Ảnh đại diện không được vượt quá 2 MB.");
  }
  return saveAvatarData(Buffer.from(await file.arrayBuffer()), file.type, userId);
}

export async function saveRemoteAvatar(imageUrl: string, userId: string) {
  if (!isAllowedRemoteAvatarUrl(imageUrl)) {
    throw new AvatarValidationError("URL ảnh phải thuộc CDN Facebook và sử dụng HTTPS.");
  }

  const response = await fetch(imageUrl, {
    cache: "no-store",
    headers: { Accept: "image/jpeg,image/png,image/webp" },
    redirect: "follow",
    signal: AbortSignal.timeout(REMOTE_AVATAR_TIMEOUT_MS),
  });
  if (!response.ok || !isAllowedRemoteAvatarUrl(response.url)) {
    throw new AvatarValidationError("Không thể tải ảnh đại diện từ Facebook.");
  }

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_AVATAR_BYTES) {
    throw new AvatarValidationError("Ảnh đại diện không được vượt quá 2 MB.");
  }

  const mimeType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const data = Buffer.from(await response.arrayBuffer());
  return saveAvatarData(data, mimeType, userId);
}

export async function readStoredAvatar(key: string) {
  const data = await readFile(/*turbopackIgnore: true*/ avatarPath(key));
  return { data, mimeType: mimeTypeFromKey(key) };
}

export async function deleteStoredAvatar(key: string | null | undefined) {
  if (!key) return;
  try {
    await unlink(avatarPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function clearStoredAvatars() {
  let entries;
  try {
    entries = await readdir(/*turbopackIgnore: true*/ avatarDirectory(), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  await Promise.all(entries
    .filter((entry) => entry.isFile() && AVATAR_KEY_PATTERN.test(entry.name))
    .map((entry) => deleteStoredAvatar(entry.name)));
}
