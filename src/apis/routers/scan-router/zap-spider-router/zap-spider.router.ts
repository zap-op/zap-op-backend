import express from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import SCAN_STATUS from "../scan.status";
import { isValidURL } from "../../../../utils/validator";
import { zapSpiderScanSessionModel } from "../../../../database/models/zap-spider.scan-session.model";
import { ZAPError } from "../../../../utils/errors/zap.error";
import ZAPService from "../../../../scan-services/zap-service/zap.service";

const zapSpiderRouter = express.Router();
const validator = new Validator({});

const postZapSpiderSchema: JSONSchema7 = {
  type: "object",
  properties: {
    url: {
      type: "string",
    },
    type: {
      type: "string",
    },
    scanConfig: {
      type: "object",
      properties: {
        maxChildren: {
          type: "number",
          minimum: 0,
          default: 1,
        },
        recurse: {
          type: "boolean",
          default: true,
        },
        contextName: {
          type: "string",
          default: "",
        },
        subtreeOnly: {
          type: "boolean",
          default: false,
        },
      },
    },
  },
  required: ["url", "type"],
};

zapSpiderRouter.post(
  "/",
  validator.validate({ body: postZapSpiderSchema }),
  async (req, res) => {
    const body = req.body;

    if (!isValidURL(body.url))
      return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

    try {
      const scanSession = new zapSpiderScanSessionModel({
        url: body.url,
        authId: body.authId,
        scanConfig: {
          maxChildren: body.scanConfig.maxChildren,
          recurse: body.scanConfig.recurse,
          contextName: body.scanConfig.contextName,
          subtreeOnly: body.scanConfig.subtreeOnly,
        },
      });
      await scanSession.save();

      return res.status(201).send({
        scanSession: scanSession._id,
        msg: SCAN_STATUS.SESSION_INITIALIZE_SUCCEED,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send({ msg: SCAN_STATUS.SESSION_INITIALIZE_FAIL });
    }
  }
);

zapSpiderRouter.get("/", async (req, res) => {
  const scanSession = req.query.scanSession;
  if (!scanSession)
    return res.status(500).send({ msg: SCAN_STATUS.INVALID_SESSION });

  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };
  res.writeHead(200, headers);

  try {
    const scanSessionDoc: any = await zapSpiderScanSessionModel.findById(
      scanSession
    );
    if (!scanSessionDoc) {
      throw ReferenceError("scanSessionDoc is not defined");
    }

    const zap = ZAPService.instance();
    const scanId = await zap.scan(
      scanSessionDoc.url,
      scanSessionDoc.__t,
      scanSessionDoc.scanConfig
    );
    if (isNaN(scanId)) {
      throw new ZAPError("scanId type not suitable");
    }

    req.on("close", () => {
      console.log(`client session ${scanSessionDoc._id} disconnect`);
    });

    zap.emit(res, scanSessionDoc.__t, scanId);
  } catch (error) {
    console.log(error);

    let errData = SCAN_STATUS.INTERNAL_ERROR;
    if (error instanceof ReferenceError) errData = SCAN_STATUS.INVALID_SESSION;
    else if (error instanceof ZAPError) errData = SCAN_STATUS.ZAP_SERVICE_ERROR;

    res.write(`event: error\ndata: ${JSON.stringify(errData)}\n\n`);
  }
});

export default zapSpiderRouter;
