import { randomBytes, scrypt as nodeScrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1_024) {
    throw new Error("Password must contain between 12 and 1024 characters");
  }

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });

  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  try {
    const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] = encodedHash.split("$");
    if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !saltValue || !hashValue) return false;

    const expected = Buffer.from(hashValue, "base64url");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
