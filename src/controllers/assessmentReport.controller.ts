import { Request, Response } from "express";
import * as reportService from "../services/assessmentReport.service";

/**
 * Get comprehensive report for an assessment
 * GET /api/admin/assessments/:assessmentId/reports
 * Query: page, limit, status, sortBy, sortOrder, search
 */
export const getAssessmentReport = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { page, limit, status, sortBy, sortOrder, search } = req.query;

        if (!assessmentId) {
            return res.status(400).json({ success: false, message: "assessmentId is required" });
        }

        const options: any = {};
        if (page) options.page = parseInt(page as string);
        if (limit) options.limit = parseInt(limit as string);
        if (status) options.status = status as string;
        if (sortBy) options.sortBy = sortBy as string;
        if (sortOrder) options.sortOrder = (sortOrder as string).toUpperCase() as "ASC" | "DESC";
        if (search) options.search = search as string;

        const report = await reportService.getAssessmentReport(assessmentId, options);

        res.json({
            success: true,
            ...report
        });
    } catch (error: any) {
        console.error("❌ [REPORT] Error fetching assessment report:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to fetch assessment report"
        });
    }
};

/**
 * Get detailed report for a single participant
 * GET /api/admin/assessments/:assessmentId/reports/participants/:participantId
 */
export const getParticipantReport = async (req: Request, res: Response) => {
    try {
        const { assessmentId, participantId } = req.params;

        if (!assessmentId || !participantId) {
            return res.status(400).json({
                success: false,
                message: "assessmentId and participantId are required"
            });
        }

        const report = await reportService.getParticipantReport(assessmentId, participantId);

        res.json({
            success: true,
            report
        });
    } catch (error: any) {
        console.error("❌ [REPORT] Error fetching participant report:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to fetch participant report"
        });
    }
};

/**
 * Update participant verdict (for admin edits)
 * PATCH /api/admin/assessments/:assessmentId/reports/participants/:participantId/verdict
 * Body: { status, adjustedScore, violationPenalty, notes }
 */
export const updateParticipantVerdict = async (req: Request, res: Response) => {
    try {
        const { assessmentId, participantId } = req.params;
        const { status, adjustedScore, violationPenalty, notes } = req.body;
        const user = (req as any).user;

        if (!assessmentId || !participantId) {
            return res.status(400).json({
                success: false,
                message: "assessmentId and participantId are required"
            });
        }

        const report = await reportService.updateParticipantVerdict(
            assessmentId,
            participantId,
            {
                status,
                adjustedScore,
                violationPenalty,
                notes,
                evaluatedBy: user?.id
            }
        );

        res.json({
            success: true,
            message: "Verdict updated successfully",
            report
        });
    } catch (error: any) {
        console.error("❌ [REPORT] Error updating participant verdict:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to update participant verdict"
        });
    }
};

/**
 * Export report as CSV/Excel (placeholder)
 * GET /api/admin/assessments/:assessmentId/reports/export
 * Query: format (csv, xlsx)
 */
export const exportReport = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { format } = req.query;

        if (!assessmentId) {
            return res.status(400).json({ success: false, message: "assessmentId is required" });
        }

        // Get full report
        const report = await reportService.getAssessmentReport(assessmentId, { limit: 10000 });

        if (format === "csv") {
            // Convert to CSV
            const headers = [
                "Rank", "Name", "Email", "College", "Registration Number",
                "Total Score", "Max Score", "Percentage", "MCQ Score", "Coding Score",
                "Violations", "Risk Level", "Status", "Time Taken (min)", "Submitted At"
            ];

            const rows = report.participants.map(p => [
                p.scores.rank,
                p.registration.fullName,
                p.registration.email,
                p.registration.college || "",
                p.registration.registrationNumber || "",
                p.scores.totalScore,
                p.scores.maxScore,
                p.scores.percentage.toFixed(2),
                `${p.scores.mcqScore}/${p.scores.mcqMaxScore}`,
                `${p.scores.codingScore}/${p.scores.codingMaxScore}`,
                p.violations.totalCount,
                p.violations.riskLevel,
                p.verdict.status,
                Math.round(p.session.totalTimeTaken / 60),
                p.timestamps.submittedAt || ""
            ]);

            const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=report-${assessmentId}.csv`);
            return res.send(csv);
        }

        // Default: return JSON
        res.json({
            success: true,
            format: "json",
            ...report
        });
    } catch (error: any) {
        console.error("❌ [REPORT] Error exporting report:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to export report"
        });
    }
};
