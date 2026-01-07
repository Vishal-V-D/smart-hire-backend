import { Request, Response } from "express";
import * as invitationService from "../services/invitation.service";
import { AdminAccessService } from "../services/adminAccess.service";

const adminAccessService = new AdminAccessService();

/**
 * POST /api/invitations
 * Create single invitation
 */
export const createInvitation = async (req: Request, res: Response) => {
    try {
        const { assessmentId, email, name, expiresAt, sendEmail } = req.body;

        if (!assessmentId || !email) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "assessmentId and email are required" },
            });
        }

        console.log(`📧 [CREATE_INVITATION] Creating for ${email}...`);

        const invitation = await invitationService.createInvitation(
            { assessmentId, email, name, expiresAt: expiresAt ? new Date(expiresAt) : undefined, sendEmail },
            (req as any).user
        );

        res.status(201).json(invitation);
    } catch (err: any) {
        console.error("❌ [CREATE_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * POST /api/invitations/bulk
 * Bulk invite
 */
export const bulkInvite = async (req: Request, res: Response) => {
    try {
        const { assessmentId, invitations, expiresAt, sendEmail } = req.body;

        if (!assessmentId || !invitations || !Array.isArray(invitations)) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "assessmentId and invitations array are required" },
            });
        }

        console.log(`📧 [BULK_INVITE] Inviting ${invitations.length} users...`);

        const result = await invitationService.bulkInvite(
            { assessmentId, invitations, expiresAt: expiresAt ? new Date(expiresAt) : undefined, sendEmail },
            (req as any).user
        );

        res.json(result);
    } catch (err: any) {
        console.error("❌ [BULK_INVITE] Error:", err);
        res.status(err.status || 500).json({
            error: { code: "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * GET /api/invitations
 * List invitations
 */
export const listInvitations = async (req: Request, res: Response) => {
    try {
        const { assessmentId, status, search, page, limit } = req.query;

        console.log(`📋 [LIST_INVITATIONS] Filters:`, { assessmentId, status, search, page, limit });

        const result = await invitationService.listInvitations({
            assessmentId: assessmentId as string,
            status: status as any,
            search: search as string,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        });

        console.log(`✅ [LIST_INVITATIONS] Found ${result.invitations.length} invitations`);
        res.json(result);
    } catch (err: any) {
        console.error("❌ [LIST_INVITATIONS] Error:", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * GET /api/invitations/stats/:assessmentId
 * Get invitation stats for assessment
 */
export const getInvitationStats = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;

        console.log(`📊 [INVITATION_STATS] Getting stats for ${assessmentId}...`);

        const stats = await invitationService.getInvitationStats(assessmentId);

        res.json(stats);
    } catch (err: any) {
        console.error("❌ [INVITATION_STATS] Error:", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * GET /api/invitations/:id
 * Get single invitation
 */
export const getInvitation = async (req: Request, res: Response) => {
    try {
        const invitation = await invitationService.getInvitationById(req.params.id);
        res.json(invitation);
    } catch (err: any) {
        console.error("❌ [GET_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 404 ? "NOT_FOUND" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * PATCH /api/invitations/:id
 * Update invitation
 */
export const updateInvitation = async (req: Request, res: Response) => {
    try {
        const { name, expiresAt } = req.body;

        console.log(`📝 [UPDATE_INVITATION] Updating ${req.params.id}...`);

        const invitation = await invitationService.updateInvitation(req.params.id, {
            name,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        res.json(invitation);
    } catch (err: any) {
        console.error("❌ [UPDATE_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * DELETE /api/invitations/:id
 * Cancel invitation
 */
export const cancelInvitation = async (req: Request, res: Response) => {
    try {
        console.log(`🗑️ [CANCEL_INVITATION] Cancelling ${req.params.id}...`);

        const invitation = await invitationService.cancelInvitation(req.params.id);

        res.json({ message: "Invitation cancelled", invitation });
    } catch (err: any) {
        console.error("❌ [CANCEL_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * DELETE /api/invitations/bulk
 * Bulk cancel invitations
 */
export const bulkCancel = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "ids array is required" },
            });
        }

        console.log(`🗑️ [BULK_CANCEL] Cancelling ${ids.length} invitations...`);

        const result = await invitationService.bulkCancel(ids);

        res.json(result);
    } catch (err: any) {
        console.error("❌ [BULK_CANCEL] Error:", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * POST /api/invitations/:id/resend
 * Resend invitation email
 */
export const resendInvitation = async (req: Request, res: Response) => {
    try {
        console.log(`📤 [RESEND_INVITATION] Resending ${req.params.id}...`);

        const success = await invitationService.resendInvitation(req.params.id);

        res.json({ success, message: success ? "Email resent" : "Failed to send email" });
    } catch (err: any) {
        console.error("❌ [RESEND_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * POST /api/invitations/verify
 * Verify invitation token (public/contestant)
 */
export const verifyInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "token is required" },
            });
        }

        console.log(`🔍 [VERIFY_INVITATION] Verifying token...`);

        const result = await invitationService.verifyInvitation(token);

        res.json({
            valid: result.valid,
            alreadyAccepted: result.alreadyAccepted,
            assessment: {
                id: result.invitation.assessment.id,
                title: result.invitation.assessment.title,
                startDate: result.invitation.assessment.startDate,
                endDate: result.invitation.assessment.endDate,
            },
            expiresAt: result.invitation.expiresAt,
        });
    } catch (err: any) {
        console.error("❌ [VERIFY_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 400 ? "INVALID_TOKEN" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * POST /api/invitations/accept
 * Accept invitation (authenticated contestant)
 */
export const acceptInvitation = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        const userId = (req as any).user?.id;

        if (!token) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "token is required" },
            });
        }

        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "Must be logged in to accept invitation" },
            });
        }

        console.log(`✅ [ACCEPT_INVITATION] Accepting by user ${userId}...`);

        const result = await invitationService.acceptInvitation(token, userId);

        res.json(result);
    } catch (err: any) {
        console.error("❌ [ACCEPT_INVITATION] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 400 ? "INVALID_TOKEN" : "SERVER_ERROR", message: err.message },
        });
    }
};

/**
 * GET /api/invitations/participants/:assessmentId
 * List participants (accepted invitations) with full user details
 * For ORGANIZER and ADMIN
 */
export const listParticipants = async (req: Request, res: Response) => {
    try {
        const { assessmentId } = req.params;
        const { search, page, limit } = req.query;
        const user = (req as any).user;

        console.log(`👥 [LIST_PARTICIPANTS] Getting participants for assessment ${assessmentId}...`);

        // Handle ADMIN access
        let organizerId = user.id;
        if (user.role === 'ADMIN' || user.role === 'COMPANY') {
            const canAccess = await adminAccessService.canAdminAccessAssessment(
                user.id, assessmentId, user.assignedOrganizerId || user.id
            );
            if (!canAccess) {
                return res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message: "You do not have access to this assessment"
                    }
                });
            }
            organizerId = user.assignedOrganizerId || user.id;
        }

        const result = await invitationService.listParticipants(
            {
                assessmentId,
                search: search as string,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            },
            organizerId
        );

        console.log(`✅ [LIST_PARTICIPANTS] Found ${result.participants.length} participants`);
        res.json(result);
    } catch (err: any) {
        console.error("❌ [LIST_PARTICIPANTS] Error:", err);
        res.status(err.status || 500).json({
            error: { code: err.status === 404 ? "NOT_FOUND" : "SERVER_ERROR", message: err.message },
        });
    }
};
