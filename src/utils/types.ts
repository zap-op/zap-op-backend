import express from "express";
import { UserTokenData } from "../submodules/utility/types";

export * from "../submodules/utility/types";

export type ProtectedRequest = express.Request & {
	session: {
		access_token: string;
		userData: UserTokenData;
		userId: string;
	};
};
