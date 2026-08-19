function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripPkcs7Padding(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return bytes;
  const pad = bytes[bytes.length - 1];
  if (pad <= 0 || pad > 16 || pad > bytes.length) return bytes;
  for (let i = bytes.length - pad; i < bytes.length; i++) {
    if (bytes[i] !== pad) return bytes;
  }
  return bytes.slice(0, bytes.length - pad);
}

export async function verifyLarkSignature(
  timestamp: string,
  nonce: string,
  encryptKey: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  if (!signature) return false;
  const prefix = new TextEncoder().encode(timestamp + nonce + encryptKey);
  const bodyBytes = new TextEncoder().encode(rawBody);
  const combined = new Uint8Array(prefix.length + bodyBytes.length);
  combined.set(prefix);
  combined.set(bodyBytes, prefix.length);
  const hash = await crypto.subtle.digest("SHA-256", combined);
  const computed = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === signature.toLowerCase();
}

export async function decryptLarkPayload(
  encrypted: string,
  encryptKey: string
): Promise<string> {
  const keyHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(encryptKey)
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );
  const bytes = base64ToBytes(encrypted);
  if (bytes.length <= 16) {
    throw new Error("invalid encrypted payload");
  }
  const iv = bytes.slice(0, 16);
  const ciphertext = bytes.slice(16);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    key,
    ciphertext
  );
  const unpadded = stripPkcs7Padding(new Uint8Array(decrypted));
  return new TextDecoder().decode(unpadded);
}
