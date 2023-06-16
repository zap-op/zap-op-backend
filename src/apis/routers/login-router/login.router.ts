import { Router } from "express";
import { isOnProduction, isValidGoogleIDToken } from "../../../utils/validator";
import { signJwt } from "../../../utils/crypto";
import { userModel } from "../../../models/user.model";
import { LOGIN_STATUS, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE, TOKEN_TYPE, GgUserData } from "../../../utils/types";
import { mainProc } from "../../../services/logging.service";

export function getLoginRouter(): Router {
	const loginRouter = Router();

	loginRouter.post("/", async (req, res) => {
		if (!req.cookies[TOKEN_TYPE.GOOGLE] || typeof req.cookies[TOKEN_TYPE.GOOGLE] !== "string") return res.status(400).send(LOGIN_STATUS.TOKEN_NOT_FOUND);

		let googleData = undefined;
		try {
			googleData = await isValidGoogleIDToken(req.cookies[TOKEN_TYPE.GOOGLE]);
		} catch (err) {
			mainProc.error(`Error while validating Google token: ${err}`);
			return res.status(400).send(LOGIN_STATUS.TOKEN_INVALID);
		}

		if (!googleData) return res.status(400).send(LOGIN_STATUS.TOKEN_INVALID);

		const userObj: GgUserData = {
			sub: googleData.sub,
			email: googleData.email,
			emailVerified: googleData.email_verified,
			name: googleData.name,
			picture: googleData.picture,
			givenName: googleData.given_name,
			familyName: googleData.family_name,
		};
		let userId: string;

		try {
			const userBySub = await userModel.findOne({
				sub: userObj.sub,
			});
			if (!userBySub) {
				const userByEmail = await userModel.findOne({
					email: userObj.email,
				});
				if (userByEmail) return res.status(400).send(LOGIN_STATUS.EMAIL_ALREADY_USED);

				const newUser = new userModel(userObj);
				userId = (await newUser.save()).id;
			} else {
				if (userBySub.email !== userObj.email) return res.status(400).send(LOGIN_STATUS.USER_ALREADY_LINKED);
				userId = userBySub.id;
			}
		} catch (error) {
			mainProc.error(`Error while adding new user: ${error}`);
			return res.status(500).send(LOGIN_STATUS.USER_ADD_FAILED);
		}

		const accessToken = signJwt(
			{
				...userObj,
				userId,
				type: TOKEN_TYPE.ACCESS,
			},
			ACCESS_TOKEN_MAX_AGE,
		);
		const refreshToken = signJwt(
			{
				...userObj,
				userId,
				type: TOKEN_TYPE.REFRESH,
			},
			REFRESH_TOKEN_MAX_AGE,
		);

		if (isOnProduction()) {
			res.cookie(TOKEN_TYPE.ACCESS, accessToken, {
				maxAge: ACCESS_TOKEN_MAX_AGE,
				domain: `.${process.env.CORS_ORIGIN}`,
			}).cookie(TOKEN_TYPE.REFRESH, refreshToken, {
				maxAge: REFRESH_TOKEN_MAX_AGE,
				domain: `.${process.env.CORS_ORIGIN}`,
			});
		} else {
			res.cookie(TOKEN_TYPE.ACCESS, accessToken, {
				maxAge: ACCESS_TOKEN_MAX_AGE,
			}).cookie(TOKEN_TYPE.REFRESH, refreshToken, {
				maxAge: REFRESH_TOKEN_MAX_AGE,
			});
		}
		res.status(200).send(LOGIN_STATUS.LOGIN_SUCCESS);
	});

	return loginRouter;
}
