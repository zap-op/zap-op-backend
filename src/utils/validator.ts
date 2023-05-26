import validator from "validator";
import urlExistNodeJS from "url-exists-nodejs";
import { OAuth2Client, TokenPayload } from "google-auth-library";

export function isOnProduction(): boolean {
	return process.env["NODE_ENV"] === "production" || process.env["NODE_ENV"] === "prod";
}

export async function isValidURL(urlString: string): Promise<boolean> {
	return (
		!urlString.includes("localhost") &&
		!urlString.includes("127.0.0.1") &&
		validator.isURL(urlString, {
			protocols: ["http", "https"],
			require_protocol: true,
			allow_underscores: true,
			allow_protocol_relative_urls: true,
		}) &&
		(await urlExistNodeJS(urlString))
	);
}

if (!process.env.GOOGLE_CLIENT_ID) 
	throw "GOOGLE_CLIENT_ID not found";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function isValidGoogleIDToken(token: string): Promise<TokenPayload | undefined> {
	const ticket = await client.verifyIdToken({
		idToken: token,
		audience: process.env.GOOGLE_CLIENT_ID,
	});
	return ticket.getPayload();
}
