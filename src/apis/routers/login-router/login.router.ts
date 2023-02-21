import express from "express";
import {isValidGoogleIDToken} from "../../../utils/validator";
import {signJwt} from "../../../utils/crypto";
import {userModel} from "../../../database/models/user.model";
import {LOGIN_STATUS} from "../../../submodules/utility/status";
import {ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, TOKEN_TYPE} from "../../../submodules/utility/token";
import {GgUserData} from "../../../submodules/utility/user";
import {mainProc} from "../../../utils/log";

const loginRouter = express.Router();

loginRouter.post("/", async (req, res) => {
    if (!req.cookies[TOKEN_TYPE.GOOGLE] || (typeof req.cookies[TOKEN_TYPE.GOOGLE] !== "string"))
        return res.status(400).send(LOGIN_STATUS.TOKEN_NOT_FOUND);

    let googleData = undefined;
    try {
        googleData = await isValidGoogleIDToken(req.cookies[TOKEN_TYPE.GOOGLE]);
    } catch (err) {
        mainProc.error(err);
        return res.status(400).send(LOGIN_STATUS.TOKEN_INVALID);
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
                return res.status(500).send(LOGIN_STATUS.EMAIL_ALREADY_USED);

            const newUser = new userModel(userObj);
            userId = (await newUser.save()).id;
        } else {
            if (userBySub.email !== userObj.email)
                return res.status(500).send(LOGIN_STATUS.USER_ALREADY_LINKED);
            userId = userBySub.id;
        }
    } catch (error) {
        mainProc.error(error);
        return res.status(500).send(LOGIN_STATUS.USER_ADD_FAILED);
    }

    const accessToken = signJwt({...userObj, userId, type: TOKEN_TYPE.ACCESS}, ACCESS_TOKEN_MAX_AGE);
    const refreshToken = signJwt({...userObj, userId, type: TOKEN_TYPE.REFRESH}, REFRESH_TOKEN_MAX_AGE);
    res.status(200)
        .cookie(TOKEN_TYPE.ACCESS, accessToken, {maxAge: ACCESS_TOKEN_MAX_AGE, domain: `.${process.env.CORS_ORIGIN}`})
        .cookie(TOKEN_TYPE.REFRESH, refreshToken, {
            maxAge: REFRESH_TOKEN_MAX_AGE,
            domain: `.${process.env.CORS_ORIGIN}`
        })
        .send(LOGIN_STATUS.LOGIN_SUCCESS);
});

export default loginRouter;
