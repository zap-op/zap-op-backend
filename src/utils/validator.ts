import validator from "validator";
import urlExists from "url-exists-nodejs";
import * as jwt from "jsonwebtoken";
import { UserTokenData } from "../submodules/utility/auth";

export function isOnProduction() {
	return process.env["NODE_ENV"] === "production" || process.env["NODE_ENV"] === "prod";
}

export async function isValidURL(urlString: string) {
	return (
		!urlString.includes("localhost") &&
		!urlString.includes("127.0.0.1") &&
		validator.isURL(urlString, {
			protocols: ["http", "https"],
			require_protocol: true,
			allow_underscores: true,
			allow_protocol_relative_urls: true,
		}) &&
		await urlExists(urlString)
	);
}

export function getUserDataFromAccessToken(jwtAccessToken: string) {
	const payload = jwt.decode(jwtAccessToken);
	if (!payload || typeof payload === 'string')
		return null;

	if (!payload.email || !payload.email_verified || !payload.preferred_username)
		return null;

	return {
		verifiedEmail: payload.email,
		username: payload.preferred_username,
		givenName: payload.given_name,
		familyName: payload.family_name
	} as UserTokenData;
}
