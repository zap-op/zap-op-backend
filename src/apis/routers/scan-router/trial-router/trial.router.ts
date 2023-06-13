import { Router } from "express";
import { isValidURL } from "../../../../utils/validator";
import { SCAN_STATUS } from "../../../../utils/types";
import { serializeSSEEvent } from "../../../../utils/network";
import { mainProc, userSession } from "../../../../services/logging.service";
import { sharedClientId, spiderResults, spiderStart, spiderStop } from "../../../../services/zapClient.service";
import { spiderSharedStatusStream } from "../../../../services/zapMonitor.service";

export function getTrialRouter(): Router {
	const trialRouter = Router();

	trialRouter.get("/", async (req, res) => {
		const headers = {
			"Content-Type": "text/event-stream",
			Connection: "keep-alive",
			"Cache-Control": "no-store",
			"X-Accel-Buffering": "no",
		};
		res.writeHead(200, headers);

		const urlToScan = req.query.url;
		if (typeof urlToScan !== "string" || !(await isValidURL(urlToScan))) return res.write(serializeSSEEvent("error", SCAN_STATUS.INVAVLID_URL));

		try {
			const startResult = await spiderStart(sharedClientId, urlToScan, {
				maxChildren: 5,
				recurse: true,
				contextName: "",
				subtreeOnly: false,
			});
			if (!startResult) return res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INITIALIZE_FAIL));

			res.write(serializeSSEEvent("id", { id: startResult.scanId }));

			const status$ = spiderSharedStatusStream(startResult.scanId);
			if (!status$) return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_ID));

			const writer = status$.subscribe({
				next: (status) => res.write(serializeSSEEvent("status", status)),
				error: (err) => {
					mainProc.error(`Error while polling ZAP spider results: ${err}`);
					res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INTERNAL_ERROR));
				},
			});

			req.on("close", () => {
				userSession.info("One trial session disconnected");
				writer.unsubscribe();
				spiderStop(sharedClientId, startResult.scanId, true);
			});
		} catch (error) {
			mainProc.error(`Error while polling ZAP spider results: ${error}`);
			res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INTERNAL_ERROR));
		}
	});

	trialRouter.get("/results", async (req, res) => {
		const scanId = req.query.id;
		if (typeof scanId !== "string" || isNaN(parseInt(scanId))) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		const offset = req.query.offset ?? "0";
		if (typeof offset !== "string" || isNaN(parseInt(offset))) return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

		const results = await spiderResults(sharedClientId, scanId, parseInt(offset));
		if (!results) return res.status(400).send(SCAN_STATUS.INVALID_ID_OR_ZAP_INTERNAL_ERROR);

		return res.status(200).send(results);
	});

	return trialRouter;
}
