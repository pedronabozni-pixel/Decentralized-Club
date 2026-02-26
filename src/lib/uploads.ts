import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

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

  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });

  const ext = getExtension(file);
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(dir, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(fullPath, Buffer.from(bytes));

  return `/uploads/${folder}/${filename}`;
}
