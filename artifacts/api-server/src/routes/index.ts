import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionsRouter from "./subscriptions";
import tipsRouter from "./tips";
import issuesRouter from "./issues";
import pressClubRouter from "./press-club";
import lettersRouter from "./letters";
import correctionsRouter from "./corrections";
import reportsRouter from "./reports";
import uploadsRouter from "./uploads";
import caseFilesRouter from "./case-files";
import recordsRequestsRouter from "./records-requests";
import advertisersRouter from "./advertisers";
import adminLogRouter from "./admin-log";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/tips", tipsRouter);
router.use("/issues", issuesRouter);
router.use("/press-club", pressClubRouter);
router.use("/letters", lettersRouter);
router.use("/corrections", correctionsRouter);
router.use("/reports", reportsRouter);
router.use("/uploads", uploadsRouter);
router.use("/case-files", caseFilesRouter);
router.use("/records-requests", recordsRequestsRouter);
router.use("/advertisers", advertisersRouter);
router.use("/admin-log", adminLogRouter);
router.use("/settings", settingsRouter);

export default router;
