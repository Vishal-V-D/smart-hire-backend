import { AppDataSource } from "../config/db";
import { ContestReport } from "../entities/contestReport.entity";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { ContestViolation } from "../entities/contestViolation.entity";
import { ContestSubmission } from "../entities/contestSubmission.entity";
import { PlagiarismResult } from "../entities/plagiarismResult.entity";
import { Contest } from "../entities/contest.entity";
import * as supabaseService from "./supabase.service";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const reportRepo = () => AppDataSource.getRepository(ContestReport);
const regRepo = () => AppDataSource.getRepository(ContestRegistration);
const violationRepo = () => AppDataSource.getRepository(ContestViolation);
const submissionRepo = () => AppDataSource.getRepository(ContestSubmission);
const plagiarismRepo = () => AppDataSource.getRepository(PlagiarismResult);
const contestRepo = () => AppDataSource.getRepository(Contest);

/**
 * Aggregate data for a user report
 */
export const getReportData = async (contestId: string, userId: string) => {
    const registration = await regRepo().findOne({ where: { contestId, userId }, relations: ["user"] });
    const violations = await violationRepo().find({ where: { contestId, userId }, order: { timestamp: "DESC" } });
    const submissions = await submissionRepo().find({ where: { contestId, userId }, relations: ["problem"] });
    const plagiarism = await plagiarismRepo().find({ where: { contestId, userId } });
    const contest = await contestRepo().findOne({ where: { id: contestId } });

    if (!registration || !contest) throw { status: 404, message: "Data not found" };

    // Calculate scores
    const totalScore = submissions.reduce((acc, sub) => acc + sub.score, 0);
    const problemsSolved = submissions.filter(sub => sub.status === "accepted").length;
    const violationCount = violations.length;
    const maxPlagiarism = plagiarism.reduce((acc, p) => Math.max(acc, p.similarityScore), 0);

    return {
        contest,
        user: registration.user,
        registration,
        violations,
        submissions,
        plagiarism,
        stats: {
            totalScore,
            problemsSolved,
            violationCount,
            maxPlagiarism
        }
    };
};

/**
 * Generate PDF Report
 */
export const generatePDFReport = async (data: any): Promise<Buffer> => {
    const doc = new jsPDF();
    const { contest, user, stats, violations, plagiarism } = data;

    // Header
    doc.setFontSize(20);
    doc.text("Contest Participation Report", 105, 20, { align: "center" });

    doc.setFontSize(14);
    doc.text(`Contest: ${contest.title}`, 20, 40);
    doc.text(`Participant: ${user.username} (${user.email})`, 20, 50);
    const formattedDate = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        timeZone: 'Asia/Kolkata'
    }) + ' IST';
    doc.text(`Date: ${formattedDate}`, 20, 60);

    // Stats
    doc.setFontSize(16);
    doc.text("Performance Summary", 20, 80);

    const statsData = [
        ["Total Score", stats.totalScore],
        ["Problems Solved", stats.problemsSolved],
        ["Violations Detected", stats.violationCount],
        ["Max Plagiarism Score", `${stats.maxPlagiarism}%`]
    ];

    autoTable(doc, {
        startY: 85,
        head: [["Metric", "Value"]],
        body: statsData,
    });

    // Violations
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.text("Violation Log", 20, finalY);

    const violationData = violations.map((v: any) => [
        new Date(v.timestamp).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
        }) + ' IST',
        v.violationType,
        JSON.stringify(v.metadata || {})
    ]);

    autoTable(doc, {
        startY: finalY + 5,
        head: [["Time", "Type", "Details"]],
        body: violationData.length ? violationData : [["-", "No violations", "-"]],
    });

    // Plagiarism
    finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.text("Plagiarism Analysis", 20, finalY);

    const plagiarismData = plagiarism.map((p: any) => [
        p.problemId,
        `${p.similarityScore}%`,
        p.verdict,
        p.isAiGenerated ? "Yes" : "No"
    ]);

    autoTable(doc, {
        startY: finalY + 5,
        head: [["Problem", "Similarity", "Verdict", "AI Generated"]],
        body: plagiarismData.length ? plagiarismData : [["-", "No issues detected", "-", "-"]],
    });

    return Buffer.from(doc.output("arraybuffer"));
};

/**
 * Generate and save report
 */
export const generateAndSaveReport = async (contestId: string, userId: string) => {
    const data = await getReportData(contestId, userId);
    const pdfBuffer = await generatePDFReport(data);

    // Upload to Supabase
    const pdfUrl = await supabaseService.uploadReportPDF(pdfBuffer, contestId, userId);

    // Save to DB
    let report = await reportRepo().findOne({ where: { contestId, userId } });
    if (!report) {
        report = reportRepo().create({ contestId, userId });
    }

    report.pdfUrl = pdfUrl;
    report.totalScore = data.stats.totalScore;
    report.problemsSolved = data.stats.problemsSolved;
    report.violationCount = data.stats.violationCount;
    report.plagiarismScore = data.stats.maxPlagiarism;
    report.reportData = data;
    report.generatedAt = new Date();

    await reportRepo().save(report);

    return report;
};

/**
 * Get report
 */
export const getReport = async (contestId: string, userId: string) => {
    return await reportRepo().findOne({
        where: { contestId, userId },
        relations: ["user"]
    });
};

/**
 * Generate all reports for a contest
 */
export const generateAllReports = async (contestId: string) => {
    const registrations = await regRepo().find({ where: { contestId } });
    const results = [];

    for (const reg of registrations) {
        try {
            const report = await generateAndSaveReport(contestId, reg.userId);
            results.push({ userId: reg.userId, status: "success", reportId: report.id });
        } catch (err: any) {
            results.push({ userId: reg.userId, status: "failed", error: err.message });
        }
    }

    return results;
};
