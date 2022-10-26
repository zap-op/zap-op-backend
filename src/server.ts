import "dotenv/config";

import database from "./database/database.js";
if (!database) throw Error("Failed to connect DB");

console.log("Connected to DB");

import express from "express";
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

import cors from "cors";
if (process.env.CORS_ORIGIN) app.use(cors({ origin: process.env.CORS_ORIGIN }));

import cookieParser from "cookie-parser";
app.use(cookieParser());

import { initRoutes } from "./apis/route.js";
initRoutes(app);

app.use((req, res) => {
  res.status(404).json({ msg: req.originalUrl + " not found" });
});

import { ValidationError } from "express-json-validator-middleware";
app.use((err: any, _req: any, res: any, next: any) => {
  if (res.headersSent) return next(err);

  if (!(err instanceof ValidationError)) return next(err);

  res.status(400).json({
    msg: err.validationErrors,
  });

  next();
});

const port = process.env.PORT || 8888;
const server = app.listen(port, () => {
  const addr = server.address();
  console.log("Started REST server", addr);
});