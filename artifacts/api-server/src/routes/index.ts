import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscriptionsRouter from "./subscriptions";
import tipsRouter from "./tips";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/tips", tipsRouter);

export default router;
