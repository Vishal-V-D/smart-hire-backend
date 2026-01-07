import { Request, Response } from "express";
import * as monitoringService from "../services/contestMonitoring.service";
import { ViolationType } from "../entities/contestViolation.entity";
import { isValidUUID } from "../utils/validation.util";

/** 🚨 Report violation */
export const reportViolation = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;

        console.log("📥 [VIOLATION] Received request:", {
            contestId,
            body: req.body,
            headers: req.headers['content-type']
        });

        if (!isValidUUID(contestId)) {
            console.log("❌ [VIOLATION] Invalid contest ID format:", contestId);
            res.status(400).json({ message: "Invalid contest ID format" });
            return;
        }

        const user = (req as any).user;
        const { type, metadata } = req.body;

        console.log("🔍 [VIOLATION] Checking type:", {
            receivedType: type,
            validTypes: Object.values(ViolationType),
            isValid: Object.values(ViolationType).includes(type)
        });

        if (!Object.values(ViolationType).includes(type)) {
            console.log("❌ [VIOLATION] Invalid violation type:", type);
            res.status(400).json({
                message: "Invalid violation type",
                received: type,
                validTypes: Object.values(ViolationType)
            });
            return;
        }

        const result = await monitoringService.recordViolation(
            contestId,
            user.id,
            type,
            metadata
        );

        // Check if violation was skipped due to proctoring settings
        if ('skipped' in result && result.skipped) {
            console.log(`⚠️ [VIOLATION] Skipped - proctoring disabled for ${type}`);
            res.status(200).json({
                message: "Proctoring disabled for this violation type",
                skipped: true,
                violationType: type,
                proctoringStatus: result.proctoringStatus
            });
            return;
        }

        console.log("✅ [VIOLATION] Recorded successfully:", (result as any).id);
        res.status(201).json(result);
    } catch (err: any) {
        console.error("❌ [VIOLATION] Error:", err);
        res.status(err.status || 500).json({ message: err.message || "Error reporting violation" });
    }
};

/** 📸 Upload monitoring photo */
export const uploadMonitoringPhoto = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;

        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID format" });
            return;
        }

        const user = (req as any).user;
        const file = req.file;
        const timestamp = Number(req.body.timestamp) || Date.now();

        if (!file) {
            res.status(400).json({ message: "Photo is required" });
            return;
        }

        const photo = await monitoringService.uploadMonitoringPhoto(
            contestId,
            user.id,
            file,
            timestamp
        );

        res.status(201).json(photo);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error uploading photo" });
    }
};

/** 📋 Get user violations */
export const getUserViolations = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;

        if (!isValidUUID(contestId) || !isValidUUID(userId)) {
            res.status(400).json({ message: "Invalid ID format" });
            return;
        }

        const violations = await monitoringService.getUserViolations(contestId, userId);
        res.json(violations);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error fetching violations" });
    }
};

/** 🚩 Get distinct/suspicious flags */
export const getFlags = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;

        if (!isValidUUID(contestId) || !isValidUUID(userId)) {
            res.status(400).json({ message: "Invalid ID format" });
            return;
        }

        const flags = await monitoringService.getDistinctFlags(contestId, userId);
        res.json(flags);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error calculating flags" });
    }
};
