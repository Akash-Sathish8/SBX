// PBKDF2-HMAC-SHA256 password hashing via Web Crypto, plugged into Better Auth
// as its custom hasher (emailAndPassword.password). Better Auth defaults to
// scrypt, which is pure-JS on Workers and blows the CPU budget; PBKDF2 runs
// native. Keeping the exact legacy format ("pbkdf2$<iters>$<saltB64>$<hashB64>")
// also means hashes minted by the pre-Better-Auth stack keep verifying.
const PBKDF2_ITER = 100_000 // Workers-CPU vs OWASP(600k) compromise; iters are stored so it's upgradeable

// ---- base64 <-> bytes (btoa/atob exist in Workers) ----
function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function unb64(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITER)
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(hash)}`
}

// Better Auth verify signature: ({ hash, password }) => boolean. Unparseable
// hashes (e.g. the legacy 'oauth:google' sentinel) just fail verification.
export async function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  if (!iterations) return false
  const salt = unb64(parts[2])
  const expected = unb64(parts[3])
  const actual = await pbkdf2(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
