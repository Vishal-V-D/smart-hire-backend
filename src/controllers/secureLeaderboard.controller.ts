import { Request, Response } from "express";
import * as secureLeaderboardService from "../services/secureLeaderboard.service";
import { isValidUUID } from "../utils/validation.util";

/** 🏆 Get secure leaderboard */
export const getSecureLeaderboard = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }

        const user = (req as any).user;
        const isOrganizer = user.role === "ORGANIZER" || user.role === "ADMIN";

        const result = await secureLeaderboardService.getSecureLeaderboard(
            contestId, user.id, isOrganizer
        );
        res.json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

/** 🔄 Toggle visibility */
export const toggleVisibility = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const { show } = req.body;

        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }
        if (typeof show !== "boolean") {
            res.status(400).json({ message: "'show' must be boolean" });
            return;
        }

        const user = (req as any).user;
        const result = await secureLeaderboardService.toggleVisibility(contestId, user.id, show);
        res.json({ message: `Leaderboard ${show ? "shown" : "hidden"}`, ...result });
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

/** 📊 Update column configuration */
export const updateColumns = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const columns = req.body;

        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }

        const user = (req as any).user;
        const result = await secureLeaderboardService.updateColumnConfig(contestId, user.id, columns);
        res.json({ message: "Column configuration updated", ...result });
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};

/** ⚙️ Get current config */
export const getConfig = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID" });
            return;
        }

        const result = await secureLeaderboardService.getConfig(contestId);
        res.json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message });
    }
};
