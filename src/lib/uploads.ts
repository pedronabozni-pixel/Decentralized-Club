import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

function getUploadStorageRoot() {
  return process.env.UPLOAD_STORAGE_DIR
    ? path.resolve(process.env.UPLOAD_STORAGE_DIR)
    : path.join(process.cwd(), ".uploads");
}

function getExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;

  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg"
  };

  return map[file.type] ?? "bin";
}

export async function saveImageUpload(file: File | null, folder: string) {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) return null;

  const dir = path.join(getUploadStorageRoot(), folder);
  await mkdir(dir, { recursive: true });

  const ext = getExtension(file);
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(dir, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(fullPath, Buffer.from(bytes));

  return `/uploads/${folder}/${filename}`;
}

function getVideoExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;

  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/quicktime": "mov"
  };

  return map[file.type] ?? "bin";
}

export async function saveVideoUpload(file: File | null, folder: string) {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("video/")) return null;

  const dir = path.join(getUploadStorageRoot(), folder);
  await mkdir(dir, { recursive: true });

  const ext = getVideoExtension(file);
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(dir, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(fullPath, Buffer.from(bytes));

  return `/uploads/${folder}/${filename}`;
}
