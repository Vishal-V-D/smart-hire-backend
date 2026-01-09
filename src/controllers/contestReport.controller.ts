import { Request, Response } from "express";
import * as reportService from "../services/contestReport.service";

/** 📄 Generate report for user */
export const generateReport = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;
        const report = await reportService.generateAndSaveReport(contestId, userId);

        console.log(`\n📦 [CONTEST_REPORT] Sending Single Report Data:`);
        console.log(JSON.stringify(report, null, 2));

        res.json(report);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error generating report" });
    }
};

/** 🔍 Get report */
export const getReport = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;
        const report = await reportService.getReport(contestId, userId);
        if (!report) {
            res.status(404).json({ message: "Report not found" });
            return;
        }

        console.log(`\n📦 [CONTEST_REPORT] Sending Report Fetch Data:`);
        console.log(JSON.stringify(report, null, 2));

        res.json(report);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error fetching report" });
    }
};

/** 🚀 Generate all reports */
export const generateAllReports = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const results = await reportService.generateAllReports(contestId);

        console.log(`\n📦 [CONTEST_REPORT] Sending Bulk Generation Results:`);
        console.log(JSON.stringify(results, null, 2));

        res.json({ message: "Bulk generation started", results });
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error generating reports" });
    }
};
