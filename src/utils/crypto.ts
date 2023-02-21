import crypto from "crypto";
import jwt from "jsonwebtoken";
import {UserTokenData} from "../submodules/utility/user";

/**
 * Generate a SHA1 hash by timestamp
 * @return
 */
export function genSHA512(payload?: any) {
    return crypto
        .createHash("sha512")
        .update(payload ? payload.toString() : Date.now().toString())
        .digest("base64");
}

export function signJwt(payload: UserTokenData, expiresIn: string | number) {
    return jwt.sign(payload, process.env.ZAP_OP_PRIVATE_KEY!, {
        algorithm: "HS256",
        expiresIn
    });
}
