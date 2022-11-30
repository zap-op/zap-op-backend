import {expressjwt} from "express-jwt";
import {Request, Response, NextFunction} from "express";
import {signJwt} from "./crypto";
import {LOGIN_STATUS} from "../submodules/utility/status";
import { ACCESS_TOKEN_MAX_AGE, TOKEN_TYPE } from "../submodules/utility/token";
import { UserTokenData } from "../apis/routers/login-router/login.router";

if (!process.env.ZAP_OP_PRIVATE_KEY)
    throw "ZAP_OP_PRIVATE_KEY not found";

export function parseAccessTokenMdw() {
    return expressjwt({
        secret: process.env.ZAP_OP_PRIVATE_KEY!,
        algorithms: ["HS256"],
        getToken: req => req.cookies[TOKEN_TYPE.ACCESS],
        requestProperty: TOKEN_TYPE.ACCESS,
        credentialsRequired: false
    });
}

export function parseRefreshTokenMdw() {
    return expressjwt({
        secret: process.env.ZAP_OP_PRIVATE_KEY!,
        algorithms: ["HS256"],
        getToken: req => req.cookies[TOKEN_TYPE.REFRESH],
        requestProperty: TOKEN_TYPE.REFRESH,
        credentialsRequired: false
    });
}

export function authenAccessMdw(req: JWTRequest, res: Response, next: NextFunction) {
    if (!req.accessToken && !req.refreshToken)
        return res.status(400).send(LOGIN_STATUS.TOKEN_NOT_FOUND);

    if (!req.accessToken) {
        const newAccessToken = Object.assign({}, req.refreshToken, { type: TOKEN_TYPE.ACCESS });
        delete newAccessToken.exp;

        req.accessToken = newAccessToken;
        res.cookie(TOKEN_TYPE.ACCESS, signJwt(newAccessToken, ACCESS_TOKEN_MAX_AGE), { maxAge: ACCESS_TOKEN_MAX_AGE });
    }
    next();
}

export type JWTRequest<T = UserTokenData> = Request & {
    [TOKEN_TYPE.ACCESS]?: T,
    [TOKEN_TYPE.REFRESH]?: T
};
