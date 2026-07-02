import { randomBytes, scrypt } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

async function readPassword() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8").replace(/[\r\n]+$/, "");
  }
  process.stderr.write("Password (12+ characters): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";
  return new Promise((resolve) => {
    process.stdin.on("data", (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) process.exit(130);
        if (byte === 13 || byte === 10) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write("\n");
          resolve(value);
          return;
        }
        if (byte === 127) value = value.slice(0, -1);
        else value += String.fromCharCode(byte);
      }
    });
  });
}

const password = await readPassword();
if (password.length < 12 || password.length > 1024) {
  process.stderr.write("Password must contain between 12 and 1024 characters.\n");
  process.exit(1);
}
const salt = randomBytes(16);
const derived = await new Promise((resolve, reject) => {
  scrypt(password, salt, KEY_LENGTH, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error); else resolve(key);
  });
});
process.stdout.write(["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("base64url"), derived.toString("base64url")].join("$") + "\n");
