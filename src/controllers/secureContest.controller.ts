import { Request, Response } from "express";
import * as secureContestService from "../services/secureContest.service";
import { isValidUUID } from "../utils/validation.util";

/** 📋 List organizer's secure contests */
export const listSecureContests = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const contests = await secureContestService.listSecureContests(user.id);
        res.json(contests);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

/** 🔍 Get secure contest details */
export const getSecureContest = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }

        const user = (req as any).user;
        const contest = await secureContestService.getSecureContest(contestId, user.id);
        res.json(contest);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

/** ✏️ Update secure contest */
export const updateSecureContest = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }

        const user = (req as any).user;
        const updated = await secureContestService.updateSecureContest(contestId, user.id, req.body);
        res.json({
            message: "Secure contest updated successfully",
            contest: updated
        });
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

/** 🗑️ Delete secure contest with cascade */
export const deleteSecureContest = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }

        const user = (req as any).user;
        const result = await secureContestService.deleteSecureContest(contestId, user.id);
        res.json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};
