import express from "express";

const loginRouter = express.Router();

loginRouter.post("/", (_req, res) => {
  res.status(200).json({ msg: "succeed" });
});

export default loginRouter;
