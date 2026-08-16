function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifySecret(actual: string, expected: string) {
  if (!actual || !expected) return false;
  const [actualHash, expectedHash] = await Promise.all([sha256(actual), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    difference |= actualHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

function normalizeAnswer(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("zh-CN");
}

export async function hashSecurityAnswer(answer: string, existingSalt?: string) {
  const salt = existingSalt ? fromBase64(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizeAnswer(answer)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 },
    material,
    256,
  );
  return { salt: toBase64(salt), hash: toBase64(new Uint8Array(bits)) };
}

export async function verifySecurityAnswer(answer: string, salt: string, expectedHash: string) {
  const actual = await hashSecurityAnswer(answer, salt);
  if (actual.hash.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.hash.length; index += 1) {
    difference |= actual.hash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}
