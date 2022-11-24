import {expressjwt} from "express-jwt";
import {Request, Response, NextFunction} from "express";
import {JwtPayload} from "jsonwebtoken";
import {signJwt} from "./crypto";
import {
    ACCESS_TOKEN_MAX_AGE,
    ACCESS_TOKEN_NAME,
    LOGIN_STATUS,
    REFRESH_TOKEN_NAME
} from "../apis/routers/login-router/login.router";

if (!process.env.ZAP_OP_PRIVATE_KEY)
    throw "ZAP_OP_PRIVATE_KEY not found";

export function parseAccessTokenMdw() {
    return expressjwt({
        secret: process.env.ZAP_OP_PRIVATE_KEY!,
        algorithms: ["HS256"],
        getToken: req => req.cookies[ACCESS_TOKEN_NAME],
        requestProperty: ACCESS_TOKEN_NAME,
        credentialsRequired: false
    });
}

export function parseRefreshTokenMdw() {
    return expressjwt({
        secret: process.env.ZAP_OP_PRIVATE_KEY!,
        algorithms: ["HS256"],
        getToken: req => req.cookies[REFRESH_TOKEN_NAME],
        requestProperty: REFRESH_TOKEN_NAME,
        credentialsRequired: false
    });
}

export function authenAccessMdw(req: JWTRequest, res: Response, next: NextFunction) {
    if (!req.access_token && !req.refresh_token)
        return res.status(400).send({ msg: LOGIN_STATUS.TOKEN_NOT_FOUND });

    if (!req.access_token) {
        const newAccessToken = signJwt({ ...req.refresh_token!, typ: ACCESS_TOKEN_NAME }, ACCESS_TOKEN_MAX_AGE);
        res.cookie(ACCESS_TOKEN_NAME, newAccessToken, { maxAge: ACCESS_TOKEN_MAX_AGE });
    }
    next();
}

export type JWTRequest<T = JwtPayload> = Request & {
    [ACCESS_TOKEN_NAME]?: T,
    [REFRESH_TOKEN_NAME]?: T
};
