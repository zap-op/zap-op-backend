import crypto from "crypto";

/**
 * Generate a SHA1 hash by timestamp
 * @return
 */
export function genSHA1() {
  return crypto
    .createHash("sha1")
    .update(Date.now().toString())
    .digest("base64");
}
