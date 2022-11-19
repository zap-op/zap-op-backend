import {Schema} from "mongoose";
import database from "../database";

export const SCAN_SESSION_COLLECTION =
  "scan_sessions" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const scanSessionModel = database!.model(
  SCAN_SESSION_COLLECTION,
  new database!.Schema(
    {
      url: {
        type: String,
        required: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
      },
    },
    {
      timestamps: {
        createdAt: true,
        updatedAt: true,
      },
    }
  )
);
