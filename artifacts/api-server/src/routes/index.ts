import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import openaiRouter from "./openai";
import notesRouter from "./notes";
import flashcardsRouter from "./flashcards";
import statsRouter from "./stats";
import streaksRouter from "./streaks";
import quizRouter from "./quiz";
import oralPracticeRouter from "./oral-practice";
import studentProfileRouter from "./student-profile";
import storageRouter from "./storage";
import subscriptionRouter from "./subscription";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(openaiRouter);
router.use(notesRouter);
router.use(flashcardsRouter);
router.use(statsRouter);
router.use(streaksRouter);
router.use(quizRouter);
router.use(oralPracticeRouter);
router.use(studentProfileRouter);
router.use(storageRouter);
router.use(subscriptionRouter);
router.use(adminRouter);

export default router;
