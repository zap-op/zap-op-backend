import validator from "validator";
import urlExists from "url-exists-nodejs";
import { OAuth2Client } from "google-auth-library";

export function isOnProduction() {
	return process.env["NODE_ENV"] === "production";
}

export function isOnDevelopment() {
	return process.env["NODE_ENV"] === "development";
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
		(await urlExists(urlString))
	);
}

if (!process.env.GOOGLE_CLIENT_ID) throw "GOOGLE_CLIENT_ID not found";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function isValidGoogleIDToken(token: string) {
	const ticket = await client.verifyIdToken({
		idToken: token,
		audience: process.env.GOOGLE_CLIENT_ID,
	});
	const payload = ticket.getPayload();
	if (!payload) throw "No payload";
	return payload;
}
