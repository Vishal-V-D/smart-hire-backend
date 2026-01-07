import { Request, Response } from "express";
import * as inviteService from "../services/contestInvite.service";
import { isValidUUID } from "../utils/validation.util";

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

/** 📨 Send bulk invitations */
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
