import { Request, Response } from "express";
import * as contestService from "../services/contest.service";
import { isValidUUID } from "../utils/validation.util";

/** 🧩 Create a contest */
// Public createContest removed


/** 🔒 Create a secure contest */
export const createSecureContest = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const user = (req as any).user;

    console.log("📥 [Controller] Create SECURE contest called");

    const contest = await contestService.createSecureContest(payload, user.id);

    console.log("✅ Secure contest created:", contest.id);
    res.status(201).json({
      message: "Secure contest created successfully",
      data: contest,
      shareableLink: `${process.env.FRONTEND_URL}/contest/join/${contest.shareableLink}`
    });
  } catch (err: any) {
    console.error("❌ [Controller] Error creating secure contest:", err);
    res.status(err.status || 500).json({ message: err.message || "Error creating secure contest" });
  }
};

/** 📋 List all contests */
export const listContests = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const list = await contestService.listContests(skip, limit);
    console.log("📤 [Controller] Sending contest list to frontend. Total Count:", list.length);
    console.log("📋 Contest Names:", list.map(c => c.title));
    res.json(list);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error listing contests" });
  }
};

/** 🔍 Get single contest info */
export const getContest = async (req: Request, res: Response) => {
  console.log("Fetching contest ID:", req.params.id);

  if (!isValidUUID(req.params.id)) {
    res.status(400).json({ message: "Invalid contest ID format" });
    return;
  }

  try {
    const contest = await contestService.getContest(req.params.id);
    res.json(contest);
  } catch (err: any) {
    console.error("Contest fetch error:", err);
    res.status(err.status || 404).json({ message: err.message || "Contest not found" });
  }
};

/** ➕ Add problem to contest */
export const addProblemToContest = async (req: Request, res: Response) => {
  try {
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "Invalid contest ID format" });
      return;
    }

    const { problemId } = req.body;
    const cp = await contestService.addProblemToContest(req.params.id, problemId);
    res.status(201).json(cp);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error adding problem" });
  }
};

/** ❌ Remove problem from contest */
export const removeProblemFromContest = async (req: Request, res: Response) => {
  try {
    if (!isValidUUID(req.params.cpId)) {
      res.status(400).json({ message: "Invalid contest-problem ID format" });
      return;
    }
    await contestService.removeProblemFromContest(req.params.cpId);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status || 404).json({ message: err.message || "Error removing problem" });
  }
};

/** 🧍 Register current user for a contest */
export const registerForContest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: contestId } = req.params;

    if (!isValidUUID(contestId)) {
      res.status(400).json({ message: "Invalid contest ID format" });
      return;
    }

    const contest = await contestService.registerForContest(contestId, user.id);
    res.status(200).json({ message: "Successfully registered", contest });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Registration failed" });
  }
};

/** 🧑‍💻 Get contests created by logged-in organizer */
export const getCreatedContests = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contests = await contestService.getCreatedContestsByUser(user.id);
    res.json(contests);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error fetching created contests" });
  }
};

/** 🏁 Get contests registered by logged-in contestant */
export const getRegisteredContests = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contests = await contestService.getRegisteredContestsByUser(user.id);
    res.json(contests);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error fetching registered contests" });
  }
};

/** ✏️ Update contest */
export const updateContest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = req.body;

    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "Invalid contest ID format" });
      return;
    }

    const updatedContest = await contestService.updateContest(req.params.id, user.id, data);
    res.json({ message: "Contest updated successfully", data: updatedContest });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error updating contest" });
  }
};

/** ❌ Delete contest */
export const deleteContest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "Invalid contest ID format" });
      return;
    }

    await contestService.deleteContest(req.params.id, user.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error deleting contest" });
  }
};

/** 🔒 Get proctoring settings for a contest */
export const getProctoringSettings = async (req: Request, res: Response) => {
  try {
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "Invalid contest ID format" });
      return;
    }

    const contest = await contestService.getContest(req.params.id);

    // Only return proctoring settings for invite-only contests
    if (!contest.isInviteOnly) {
      res.json({
        proctoringEnabled: false,
        message: "Proctoring is not available for public contests"
      });
      return;
    }

    res.json({
      proctoringEnabled: true,
      settings: {
        enableVideoProctoring: contest.enableVideoProctoring,
        enableAudioMonitoring: contest.enableAudioMonitoring,
        enableCopyPasteDetection: contest.enableCopyPasteDetection,
        enableTabSwitchDetection: contest.enableTabSwitchDetection,
        enableScreenshotCapture: contest.enableScreenshotCapture,
        enableFaceRecognition: contest.enableFaceRecognition,
        requireCameraAccess: contest.requireCameraAccess,
        requireMicrophoneAccess: contest.requireMicrophoneAccess,
        enableFullscreenMode: contest.enableFullscreenMode,
        screenshotIntervalSeconds: contest.screenshotIntervalSeconds,
      }
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Error fetching proctoring settings" });
  }
};
