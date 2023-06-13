import crypto from "crypto";
import jwt from "jsonwebtoken";
import { UserTokenData } from "./types";

export function genSHA512(payload: any): string {
	return crypto.createHash("sha512").update(payload.toString()).digest("base64");
}

export function signJwt(payload: UserTokenData, expiresIn: string | number): string {
	return jwt.sign(payload, process.env.ZAP_OP_PRIVATE_KEY!, {
		algorithm: "HS256",
		expiresIn,
	});
}
