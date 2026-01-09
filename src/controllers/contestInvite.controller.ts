import { Request, Response } from "express";
import * as inviteService from "../services/contestInvite.service";
import { isValidUUID } from "../utils/validation.util";
import fs from 'fs';
import csv from 'csv-parser';

/** 📨 Send invitation to a user */
export const sendInvitation = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const { email } = req.body;
        console.log(`📨 [Invite Controller] Request received for contest ${contestId}, email: ${email}`);

        if (!isValidUUID(contestId)) {
            console.warn(`⚠️ [Invite Controller] Invalid contest ID: ${contestId}`);
            res.status(400).json({ message: "Invalid contest ID format" });
            return;
        }

        const user = (req as any).user;

        if (!email) {
            console.warn(`⚠️ [Invite Controller] Email missing in body. Body:`, req.body);
            res.status(400).json({ message: "Email is required" });
            return;
        }

        const invitation = await inviteService.sendInvitation(contestId, email, user.id);
        console.log(`✅ [Invite] Invitation sent to ${email} for contest ${contestId}`);
        res.status(201).json({ message: "Invitation sent successfully", invitation });
    } catch (err: any) {
        console.error(`❌ [Invite] Error sending invitation for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error sending invitation" });
    }
};

/** 📨 Send bulk invitations via CSV */
export const sendBulkInvitationsCSV = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const file = req.file;

        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID format" });
            return;
        }

        if (!file) {
            res.status(400).json({ message: "CSV file is required" });
            return;
        }

        const emails: string[] = [];
        const user = (req as any).user;

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const uniqueEmails = new Set<string>();

        fs.createReadStream(file.path)
            .pipe(csv({ headers: false })) // 🧠 Intelligent Mode: Ignore structure/headers
            .on('data', (row: any) => {
                // Scan EVERY cell in the row for an email
                // This handles cases where data starts at line 10, or is in the 3rd column
                Object.values(row).forEach((cell: any) => {
                    if (typeof cell === 'string') {
                        const potentialEmail = cell.trim();
                        // Check if it LOOKS like an email (fast check + strict regex)
                        if (potentialEmail.includes('@') && emailRegex.test(potentialEmail)) {
                            uniqueEmails.add(potentialEmail.toLowerCase());
                        }
                    }
                });
            })
            .on('end', async () => {
                // Clean up file
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

                const emails = Array.from(uniqueEmails);

                if (emails.length === 0) {
                    return res.status(400).json({ message: "No valid emails found. Please check your CSV file." });
                }

                try {
                    console.log(`📂 [CSV Invite] intelligently extracted ${emails.length} unique emails`);
                    const results = await inviteService.sendBulkInvitations(contestId, emails, user.id);
                    res.status(200).json({ message: "Bulk invitations processed", results });
                } catch (err: any) {
                    console.error(`❌ [CSV Invite] Error sending invites:`, err);
                    res.status(500).json({ message: "Error processing invitations" });
                }
            })
            .on('error', (err: any) => {
                console.error(`❌ [CSV Invite] Error parsing CSV:`, err);
                res.status(500).json({ message: "Error parsing CSV file" });
            });

    } catch (err: any) {
        console.error(`❌ [CSV Invite] Error:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error processing CSV" });
    }
};

/** 📨 Send bulk invitations JSON */
export const sendBulkInvitations = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;

        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID format" });
            return;
        }

        const { emails } = req.body;
        const user = (req as any).user;

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            res.status(400).json({ message: "Valid emails array is required" });
            return;
        }

        const results = await inviteService.sendBulkInvitations(contestId, emails, user.id);
        console.log(`✅ [Invite] Bulk invitations processed for contest ${contestId}`);
        res.status(200).json({ message: "Bulk invitations processed", results });
    } catch (err: any) {
        console.error(`❌ [Invite] Error sending bulk invitations for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error sending bulk invitations" });
    }
};

/** 🔍 Get all invitations for a contest */
export const getInvitations = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;

        if (!isValidUUID(contestId)) {
            res.status(400).json({ message: "Invalid contest ID format" });
            return;
        }

        const invitations = await inviteService.getInvitations(contestId);
        console.log(`📩 [Invite] Fetched ${invitations.length} invitations for contest ${contestId}`);
        res.json(invitations);
    } catch (err: any) {
        console.error(`❌ [Invite] Error fetching invitations for ${req.params.contestId}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error fetching invitations" });
    }
};

/** ✅ Validate invite token */
export const validateInviteToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        console.log(`🔍 [Invite] Validating token: ${token}`);
        const result = await inviteService.validateInviteToken(token);
        res.json(result);
    } catch (err: any) {
        console.error(`❌ [Invite] Error validating token ${req.params.token}:`, err);
        res.status(err.status || 404).json({ message: err.message || "Invalid token" });
    }
};

/** 🤝 Accept invitation */
export const acceptInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const user = (req as any).user;
        console.log(`🤝 [Invite] User ${user.id} accepting token: ${token}`);

        const invitation = await inviteService.acceptInvitation(token, user.id);
        res.json({ message: "Invitation accepted", invitation });
    } catch (err: any) {
        console.error(`❌ [Invite] Error accepting token ${req.params.token}:`, err);
        res.status(err.status || 500).json({ message: err.message || "Error accepting invitation" });
    }
};

/** 🗑️ Revoke invitation */
export const revokeInvitation = async (req: Request, res: Response) => {
    try {
        const { invitationId } = req.params;
        await inviteService.revokeInvitation(invitationId);
        res.status(200).json({ message: "Invitation revoked" });
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error revoking invitation" });
    }
};
