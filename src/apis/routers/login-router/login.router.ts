import express from "express";
import { getUserDataFromAccessToken } from "../../../utils/validator";
import { userModel } from "../../../models/user.model";
import { mainProc } from "../../../services/logging.service";
import { ProtectedRequest, LOGIN_STATUS } from "../../../utils/types";

export function initLoginRouter() {
    const loginRouter = express.Router();

    loginRouter.post("/", async (req: ProtectedRequest, res) => {
        if (!req.session.access_token) return res.status(400).send(LOGIN_STATUS.TOKEN_NOT_FOUND);

        const userData = getUserDataFromAccessToken(req.session.access_token);
        if (!userData)
            return res.status(400).send(LOGIN_STATUS.TOKEN_INVALID);

        req.session.userData = userData;

        try {
            const userByEmail = await userModel.findOne({
                verifiedEmail: userData.verifiedEmail,
            });
            if (userByEmail) return res.status(400).send(LOGIN_STATUS.EMAIL_ALREADY_USED);

            const newUser = new userModel(userData);

            req.session.userId = (await newUser.save()).id;
        } catch (error) {
            mainProc.error(error);
            return res.status(500).send(LOGIN_STATUS.USER_ADD_FAILED);
        }

        res.status(200).send(LOGIN_STATUS.LOGIN_SUCCESS);
    });

    return loginRouter;
}