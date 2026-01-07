import { Request, Response } from "express";
import * as adminService from "../services/contestAdmin.service";
import * as sessionService from "../services/contestSession.service";

/** 👥 Get live participants */
export const getParticipants = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`👥 [Admin] Fetching participants for contest: ${contestId}`);
        const participants = await adminService.getLiveParticipants(contestId);
        res.json(participants);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching participants for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching participants" });
    }
};

/** 🚨 Get violation feed */
export const getViolations = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`🚨 [Admin] Fetching violations for contest: ${contestId}`);
        const violations = await adminService.getViolationFeed(contestId);
        res.json(violations);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching violations for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching violations" });
    }
};

/** 📊 Get contest statistics */
export const getStatistics = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`📊 [Admin] Fetching statistics for contest: ${contestId}`);
        const stats = await adminService.getContestStatistics(contestId);
        res.json(stats);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching statistics for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching statistics" });
    }
};

/** 📩 Get invited users */
export const getInvitedUsers = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`📩 [Admin] Fetching invited users for contest: ${contestId}`);
        const users = await adminService.getInvitedUsers(contestId);
        res.json(users);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching invited users for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching invited users" });
    }
};

/** 🖥️ Get dashboard data */
export const getDashboardData = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`🖥️ [Admin] Fetching dashboard data for contest: ${contestId}`);
        const data = await adminService.getDashboardData(contestId);
        res.json(data);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching dashboard data for ${req.params.contestId}:`, err);
    }
};

/** 📊 Get session statistics */
export const getSessionStatistics = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`📊 [Admin] Fetching session statistics for contest: ${contestId}`);
        const stats = await sessionService.getSessionStatistics(contestId);
        res.json(stats);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching session statistics for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching session statistics" });
    }
};

/** 👥 Get unified participant view */
export const getContestParticipants = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`👥 [Admin] Fetching unified participants for contest: ${contestId}`);
        const participants = await adminService.getContestParticipants(contestId);
        res.json(participants);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching unified participants for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching participants" });
    }
};

/** 📊 Get all SecureContestResults (final results with scores, plagiarism, violations) */
export const getSecureContestResults = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        console.log(`📊 [Admin] Fetching SecureContestResults for contest: ${contestId}`);
        const results = await adminService.getAllSecureContestResults(contestId);
        res.json(results);
    } catch (err: any) {
        console.error(`❌ [Admin] Error fetching SecureContestResults for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching results" });
    }
};
