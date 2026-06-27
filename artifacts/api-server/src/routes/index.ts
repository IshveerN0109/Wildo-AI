import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import notesRouter from "./notes";
import flashcardsRouter from "./flashcards";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(openaiRouter);
router.use(notesRouter);
router.use(flashcardsRouter);
router.use(statsRouter);

export default router;
