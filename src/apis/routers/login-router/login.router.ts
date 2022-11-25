import express from "express";
import {isValidGoogleIDToken} from "../../../utils/validator";
import {signJwt} from "../../../utils/crypto";
import {userModel} from "../../../database/models/user.model";

const loginRouter = express.Router();

export const LOGIN_STATUS = {
    LOGIN_SUCCESS: {
        statusCode: 0,
        msg: "Login successfully"
    },
    TOKEN_NOT_FOUND: {
        statusCode: -1,
        msg: "No token found",
    },
    TOKEN_INVALID: {
        statusCode: -2,
        msg: "Invalid token",
    },
    USER_ADD_FAILED: {
        statusCode: -3,
        msg: "New user failed to add",
    },
    USER_ALREADY_LINKED: {
        statusCode: -4,
        msg: "Google account already used with different email",
    },
    EMAIL_ALREADY_USED: {
        statusCode: -5,
        msg: "Email already used",
    }
};

export interface GgUserData {
    sub: string,
    email?: string,
    emailVerified?: boolean,
    name?: string,
    picture?: string,
    givenName?: string,
    familyName?: string
}

export enum TOKEN_TYPE {
    GOOGLE = "ggToken",
    ACCESS = "accessToken",
    REFRESH = "refreshToken"
}

export const ACCESS_TOKEN_MAX_AGE = 60 * 60;
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

export interface JwtPayload {
    iss?: string | undefined;
    sub?: string | undefined;
    aud?: string | string[] | undefined;
    exp?: number | undefined;
    nbf?: number | undefined;
    iat?: number | undefined;
    jti?: string | undefined;
}

export type UserTokenData = JwtPayload & GgUserData & {
    userId: string,
    type: TOKEN_TYPE
};

loginRouter.post("/", async (req, res) => {
    if (!req.cookies[TOKEN_TYPE.GOOGLE] || (typeof req.cookies[TOKEN_TYPE.GOOGLE] !== "string"))
        return res.status(400).send({msg: LOGIN_STATUS.TOKEN_NOT_FOUND});

    let googleData = undefined;
    try {
        googleData = await isValidGoogleIDToken(req.cookies[TOKEN_TYPE.GOOGLE]);
    } catch (err) {
        console.error(err);
        return res.status(400).send({msg: LOGIN_STATUS.TOKEN_INVALID});
    }

    const userObj: GgUserData = {
        sub: googleData.sub,
        email: googleData.email,
        emailVerified: googleData.email_verified,
        name: googleData.name,
        picture: googleData.picture,
        givenName: googleData.given_name,
        familyName: googleData.family_name
    };
    let userId: string;

    try {
        const userBySub = await userModel.findOne({"sub": userObj.sub});
        if (!userBySub) {
            const userByEmail = await userModel.findOne({"email": userObj.email});
            if (userByEmail)
                return res.status(500).send({msg: LOGIN_STATUS.EMAIL_ALREADY_USED});

            const newUser = new userModel(userObj);
            userId = (await newUser.save()).id;
        }
        else {
            if (userBySub.email !== userObj.email)
                return res.status(500).send({msg: LOGIN_STATUS.USER_ALREADY_LINKED});
            userId = userBySub.id;
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send({msg: LOGIN_STATUS.USER_ADD_FAILED});
    }

    const accessToken = signJwt({...userObj, userId, type: TOKEN_TYPE.ACCESS}, ACCESS_TOKEN_MAX_AGE);
    const refreshToken = signJwt({...userObj, userId, type: TOKEN_TYPE.REFRESH}, REFRESH_TOKEN_MAX_AGE);
    res.status(200)
        .cookie(TOKEN_TYPE.ACCESS, accessToken, {maxAge: ACCESS_TOKEN_MAX_AGE})
        .cookie(TOKEN_TYPE.REFRESH, refreshToken, {maxAge: REFRESH_TOKEN_MAX_AGE})
        .send({msg: LOGIN_STATUS.LOGIN_SUCCESS});
});

export default loginRouter;
