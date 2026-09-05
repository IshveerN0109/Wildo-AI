import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import openaiRouter from "./openai";
import notesRouter from "./notes";
import flashcardsRouter from "./flashcards";
import statsRouter from "./stats";
import streaksRouter from "./streaks";
import quizRouter from "./quiz";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(openaiRouter);
router.use(notesRouter);
router.use(flashcardsRouter);
router.use(statsRouter);
router.use(streaksRouter);
router.use(quizRouter);

export default router;
