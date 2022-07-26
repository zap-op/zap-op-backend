import validator from "validator";
import {OAuth2Client} from "google-auth-library";

export function isValidURL(urlString: string) {
    return validator.isURL(urlString, {
        protocols: ["http", "https"],
        require_protocol: true,
        allow_underscores: true,
    });
}

if (!process.env.GOOGLE_CLIENT_ID)
    throw "GOOGLE_CLIENT_ID not found";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
export async function isValidGoogleIDToken(token: string) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload)
        throw "No payload";

    return payload;
}
