import { Request, Response } from "express";
import * as submitAllService from "../services/contestSubmitAll.service";
import * as sessionService from "../services/contestSession.service";
import * as timerUtil from "../utils/contestTimer.util";
import { AppDataSource } from "../config/db";
import { Contest } from "../entities/contest.entity";

const contestRepo = () => AppDataSource.getRepository(Contest);

/**
 * Submit all solutions and finish contest
 * POST /api/contests/:contestId/submit-all
 */
export const submitAllAndFinish = async (req: Request, res: Response) => {
  try {
    const { contestId } = req.params;
    const user = (req as any).user;
    const authHeader = req.headers.authorization || "";

    console.log("\n----------------------------------------------------------------");
    console.log(`🏁 [Controller] Submit-All Initiated`);
    console.log(`👤 User: ${user.id}`);
    console.log(`🏆 Contest: ${contestId}`);
    console.log(`📦 Incoming Body (Should be empty):`, JSON.stringify(req.body));
    console.log("----------------------------------------------------------------\n");

    const result = await submitAllService.submitAllAndFinish(
      contestId,
      user.id,
      authHeader
    );

    console.log("\n----------------------------------------------------------------");
    console.log(`✅ [Controller] Submit-All Completed Successfully`);
    console.log(`📤 Sending Response: { message: "Submitted successfully" }`);
    console.log("----------------------------------------------------------------\n");

    // User requested simple response for frontend
    res.status(200).json({ message: "Submitted successfully" });
  } catch (err: any) {
    console.error("❌ [Controller] Submit-all error:", err);
    res.status(err.status || 500).json({ message: err.message || "Error processing submissions" });
  }
};

/**
 * Get timer status for current user
 * GET /api/contests/:contestId/timer
 */
export const getTimerStatus = async (req: Request, res: Response) => {
  try {
    const { contestId } = req.params;
    const user = (req as any).user;

    const contest = await contestRepo().findOneBy({ id: contestId });
    if (!contest) {
      res.status(404).json({ message: "Contest not found" });
      return;
    }

    const session = await sessionService.getLatestSession(contestId, user.id);
    const timerStatus = timerUtil.getTimerStatus(contest, session);

    res.json({
      ...timerStatus,
      sessionStatus: session?.status || null,
      durationMinutes: contest.durationMinutes || 0,
      formattedRemaining: timerUtil.formatDuration(timerStatus.remainingSeconds),
      formattedElapsed: timerUtil.formatDuration(timerStatus.elapsedSeconds)
    });
  } catch (err: any) {
    console.error("❌ [Controller] Timer status error:", err);
    res.status(err.status || 500).json({ message: err.message || "Error fetching timer status" });
  }
};
