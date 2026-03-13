import { access, readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

function getPersistentUploadRoot() {
  return process.env.UPLOAD_STORAGE_DIR
    ? path.resolve(process.env.UPLOAD_STORAGE_DIR)
    : path.join(process.cwd(), ".uploads");
}

function getLegacyUploadRoot() {
  return path.join(process.cwd(), "public", "uploads");
}

function getMimeType(filename: string) {
  const ext = path.extname(filename).toLowerCase();

  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".mov": "video/quicktime"
  };

  return map[ext] ?? "application/octet-stream";
}

async function findUploadFile(parts: string[]) {
  const safeParts = parts.filter(Boolean).map((part) => path.basename(part));
  if (safeParts.length === 0) return null;

  const candidates = [
    path.join(getPersistentUploadRoot(), ...safeParts),
    path.join(getLegacyUploadRoot(), ...safeParts)
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const filePath = await findUploadFile(parts);

  if (!filePath) {
    return new NextResponse("Arquivo nao encontrado", { status: 404 });
  }

  const file = await readFile(filePath);

  return new NextResponse(file, {
    headers: {
      "Content-Type": getMimeType(filePath),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
