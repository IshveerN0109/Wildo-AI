import { Router, type IRouter } from "express";
import plansRouter from "./plans";
import creditPacksRouter from "./credit-packs";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(plansRouter);
router.use(creditPacksRouter);
router.use(dashboardRouter);

export default router;
