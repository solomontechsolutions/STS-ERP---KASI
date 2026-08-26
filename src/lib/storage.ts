import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Swappable object-storage interface (Section 11/15.2 of the build brief:
 * "an object storage service ... never stored as base64 in the database").
 * Only ONE implementation should be active per environment — swap
 * `storage` below for an S3-compatible or Vercel Blob adapter before
 * deploying anywhere with an ephemeral filesystem (Vercel serverless
 * included). The local-disk adapter is dev-only.
 */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const UPLOAD_ROOT = join(process.cwd(), ".data", "uploads");

class LocalDiskStorage implements StorageAdapter {
  async put(key: string, data: Buffer) {
    const path = join(UPLOAD_ROOT, key);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, data);
  }

  async read(key: string) {
    return readFile(join(UPLOAD_ROOT, key));
  }

  async delete(key: string) {
    await unlink(join(UPLOAD_ROOT, key)).catch(() => undefined);
  }
}

// TODO before any non-local deployment: replace with an S3-compatible or
// Vercel Blob adapter (STORAGE_* env vars are already stubbed in .env.example).
export const storage: StorageAdapter = new LocalDiskStorage();
