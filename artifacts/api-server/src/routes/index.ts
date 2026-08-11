import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import authRouter from "./auth";
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
import { comicsPublicRouter, comicsAdminRouter } from "./comics";

const router: IRouter = Router();

router.use("/auth", authRouter);
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

// Comics — public list and admin CRUD
router.use("/comics", comicsPublicRouter);
router.use("/admin/comics", comicsAdminRouter);

// Comics artwork file serving (dev: reads from public/comics directory)
const comicsDir = path.resolve(process.cwd(), "artifacts/crime-wire/public/comics");
router.get("/files/comics/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(comicsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
