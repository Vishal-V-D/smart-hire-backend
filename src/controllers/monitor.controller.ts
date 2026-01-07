import { Request, Response } from "express";
import * as monitorService from "../services/monitor.service";
import { ViolationType } from "../entities/AssessmentViolation.entity";

/**
 * Record a violation
 * POST /api/contestant/monitor/violation
 * Body: { sessionToken, type, metadata }
 */
export const recordViolation = async (req: Request, res: Response) => {
    try {
        const { sessionToken, type, metadata } = req.body;

        if (!sessionToken || !type) {
            return res.status(400).json({ success: false, message: "sessionToken and type are required" });
        }

        const violation = await monitorService.recordViolation(sessionToken, type, metadata);

        res.json({
            success: true,
            violationId: violation.id,
        });
    } catch (error: any) {
        console.error("❌ [MONITOR] Error recording violation:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to record violation",
        });
    }
};

/**
 * Get all violations for an assessment (Admin/Organizer)
 * GET /api/admin/assessments/:assessmentId/violations
 * Query params: page, limit, types (comma-separated), sessionId, since
 */
export const getAssessmentViolations = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { page, limit, types, sessionId, since } = req.query;

        if (!assessmentId) {
            return res.status(400).json({ success: false, message: "assessmentId is required" });
        }

        const options: any = {};
        if (page) options.page = parseInt(page as string);
        if (limit) options.limit = parseInt(limit as string);
        if (sessionId) options.sessionId = sessionId as string;
        if (since) options.sinceTimestamp = new Date(since as string);
        if (types) {
            const typeArray = (types as string).split(",").filter(t =>
                Object.values(ViolationType).includes(t as ViolationType)
            );
            if (typeArray.length > 0) {
                options.types = typeArray;
            }
        }

        const result = await monitorService.getAllViolationsForAssessment(assessmentId, options);

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error("❌ [MONITOR] Error fetching violations:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to fetch violations",
        });
    }
};

/**
 * Get violation statistics for an assessment (Admin/Organizer)
 * GET /api/admin/assessments/:assessmentId/violations/stats
 */
export const getAssessmentViolationStats = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;

        if (!assessmentId) {
            return res.status(400).json({ success: false, message: "assessmentId is required" });
        }

        const stats = await monitorService.getViolationStatsForAssessment(assessmentId);

        res.json({
            success: true,
            ...stats,
        });
    } catch (error: any) {
        console.error("❌ [MONITOR] Error fetching violation stats:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to fetch violation stats",
        });
    }
};

/**
 * Get realtime violations feed for an assessment (Admin/Organizer)
 * Supports long-polling for realtime updates
 * GET /api/admin/assessments/:assessmentId/violations/realtime
 * Query params: since (ISO timestamp, required for proper polling)
 */
export const getRealtimeViolationsFeed = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { since } = req.query;

        if (!assessmentId) {
            return res.status(400).json({ success: false, message: "assessmentId is required" });
        }

        // Default to last 30 seconds if no timestamp provided
        const sinceTimestamp = since
            ? new Date(since as string)
            : new Date(Date.now() - 30 * 1000);

        const result = await monitorService.getRealtimeViolations(assessmentId, sinceTimestamp);

        const responsePayload = {
            success: true,
            ...result,
            // Include server timestamp for sync
            serverTimestamp: new Date().toISOString(),
        };

        console.log("📤 [REALTIME] Sending to frontend:", JSON.stringify(responsePayload, null, 2));

        res.json(responsePayload);
    } catch (error: any) {
        console.error("❌ [MONITOR] Error fetching realtime violations:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to fetch realtime violations",
        });
    }
};
