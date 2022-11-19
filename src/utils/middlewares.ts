import {expressjwt} from "express-jwt";
import {Request, Response, NextFunction} from "express";
import {JwtPayload} from "jsonwebtoken";
import {signJwt} from "./crypto";

if (!process.env.ZAP_OP_PRIVATE_KEY)
    throw "ZAP_OP_PRIVATE_KEY not found";

export function parseAccessTokenMdw() {
    return expressjwt({
        secret: process.env.ZAP_OP_PRIVATE_KEY!,
        algorithms: ["HS256"],
        getToken: req => req.cookies.access_token,
        requestProperty: "access_token"
    });
}

export function renewAccessTokenMdw(req: JWTRequest, res: Response, next: NextFunction) {
    const accessToken = signJwt(req.access_token, "1d");
    res.cookie('access_token', accessToken, { maxAge: 24 * 60 * 60 });
    next();
}

export type JWTRequest<T = JwtPayload> = Request & {
    access_token: T,
};
