import crypto from "crypto";
import jwt from "jsonwebtoken";

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

export function signJwt(payload: object, expiresIn: string | number) {
    return jwt.sign(payload, process.env.ZAP_OP_PRIVATE_KEY!, {
        algorithm: "HS256",
        expiresIn
    });
}
