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

/**
 * Serverless filesystems are read-only apart from /tmp, and /tmp does not
 * survive between invocations. Rather than let uploads fail with a bare
 * `EROFS` — or, worse, appear to succeed and then lose the file — refuse to
 * use the dev adapter anywhere it cannot work, and say why.
 */
class UnconfiguredStorage implements StorageAdapter {
  private fail(): never {
    throw new Error(
      "No object storage is configured. The local-disk adapter cannot be used on a " +
        "serverless/read-only filesystem — uploaded documents would be lost. Implement " +
        "an S3-compatible or Vercel Blob StorageAdapter in src/lib/storage.ts before " +
        "using documents in this environment.",
    );
  }

  async put() {
    this.fail();
  }
  async read(): Promise<Buffer> {
    this.fail();
  }
  async delete() {
    this.fail();
  }
}

// TODO before relying on documents in production: replace with an
// S3-compatible or Vercel Blob adapter (STORAGE_* env vars are already
// stubbed in .env.example) and return it from here unconditionally.
const isEphemeralFilesystem = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

export const storage: StorageAdapter = isEphemeralFilesystem
  ? new UnconfiguredStorage()
  : new LocalDiskStorage();
