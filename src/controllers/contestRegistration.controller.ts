import { Request, Response } from "express";
import * as registrationService from "../services/contestRegistration.service";

/** 📝 Register for contest with photo */
export const registerForContest = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const user = (req as any).user;

        console.log(`📝 [Controller] Registration request for contest ${contestId} by user ${user.id}`);

        // Log payload for debugging (truncate large strings)
        const debugBody = { ...req.body };
        if (debugBody.photoBase64) debugBody.photoBase64 = "TRUNCATED_BASE64_STRING";
        if (debugBody.resumeBase64) debugBody.resumeBase64 = "TRUNCATED_BASE64_STRING";
        if (debugBody.startTime) console.log(`⏰ [Controller] Received Start Time: ${debugBody.startTime}`);


        console.log("\n----------------------------------------------------------------");
        console.log("🔍 [DEBUG] INCOMING REGISTRATION PARAMETERS:");
        console.log(JSON.stringify(debugBody, null, 2));
        console.log("----------------------------------------------------------------\n");

        // First, check if the contest is invite-only to determine required fields
        const registrationResult = await registrationService.registerUserForContest(
            contestId,
            user.id,
            req.body
        );

        console.log(`✅ [Controller] Registration successful for user ${user.id}`);
        res.status(201).json({ message: "Registration successful", registration: registrationResult });
    } catch (err: any) {
        console.error(`❌ [Controller] Registration failed:`, err);
        res.status(err.status || 500).json({ message: err.message || "Registration failed" });
    }
};

/** 🔍 Check registration status */
export const checkRegistration = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const user = (req as any).user;

        const result = await registrationService.checkRegistration(contestId, user.id);
        res.json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error checking registration" });
    }
};

/** 📄 Get registration details */
export const getRegistrationDetails = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;
        const registration = await registrationService.getRegistrationDetails(contestId, userId);
        res.json(registration);
    } catch (err: any) {
        res.status(err.status || 404).json({ message: err.message || "Registration not found" });
    }
};

/** 📸 Get registration photo */
export const getRegistrationPhoto = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;
        const registration = await registrationService.getRegistrationDetails(contestId, userId);

        if (!registration.photoUrl) {
            res.status(404).json({ message: "Photo not found for this registration" });
            return;
        }

        res.json({ photoUrl: registration.photoUrl });
    } catch (err: any) {
        res.status(err.status || 404).json({ message: err.message || "Registration not found" });
    }
};

/** 🔗 Generate shareable link */
export const generateShareableLink = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const result = await registrationService.generateShareableLink(contestId);
        res.json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error generating link" });
    }
};

/** 🔗 Get contest by link */
export const getContestByLink = async (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        const contest = await registrationService.getContestByLink(code);
        res.json(contest);
    } catch (err: any) {
        res.status(err.status || 404).json({ message: err.message || "Contest not found" });
    }
};

/** 🚀 Start contest session */
export const startContest = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const user = (req as any).user;

        const result = await registrationService.startContest(contestId, user.id);
        res.status(200).json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error starting contest" });
    }
};

/** 🏁 Finish contest session */
export const finishContest = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const user = (req as any).user;

        const result = await registrationService.finishContest(contestId, user.id);
        res.status(200).json(result);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error finishing contest" });
    }
};
