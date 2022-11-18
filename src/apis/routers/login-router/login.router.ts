import express from "express";
import {isValidGoogleIDToken} from "../../../utils/validator";
import {signJwt} from "../../../utils/crypto";
import {userModel} from "../../../database/models/user.model";

const loginRouter = express.Router();

const LOGIN_STATUS = {
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
    }
};

loginRouter.post("/", async (req, res) => {
    if (!req.cookies.token || (typeof req.cookies.token !== "string"))
        return res.status(400).send({ msg: LOGIN_STATUS.TOKEN_NOT_FOUND });

    let googleData = undefined;
    try {
        googleData = await isValidGoogleIDToken(req.cookies.token);
    }
    catch(err) {
        console.error(err);
        return res.status(400).send({ msg: LOGIN_STATUS.TOKEN_INVALID });
    }

    const userObj = {
        sub: googleData.sub,
        email: googleData.email,
        email_verified: googleData.email_verified,
        name: googleData.name,
        picture: googleData.picture,
        given_name: googleData.given_name,
        family_name: googleData.family_name
    };

    try {
        const user = await userModel.findOne({ "email": userObj.email });
        if (!user) {
            const newUser = new userModel(userObj);
            await newUser.save();
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send({ msg: LOGIN_STATUS.USER_ADD_FAILED });
    }

    const signedAccessToken = signJwt(userObj, "1h");
    const refreshToken = signJwt({}, "7d");
    res.status(200).json({ new_token: signedAccessToken, refresh_token: refreshToken });
});

export default loginRouter;
