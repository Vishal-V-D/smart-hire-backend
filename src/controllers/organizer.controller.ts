import { Request, Response } from "express";
import { AppDataSource } from "../config/db";
import { Contest } from "../entities/contest.entity";
import { User, UserRole, AdminStatus } from "../entities/user.entity";
import { ContestViolation, ViolationType } from "../entities/contestViolation.entity";
import { In } from "typeorm";
import { AdminAccessService } from "../services/adminAccess.service";
import { AuthenticationService } from "../services/authentication.service";
import { EmailService } from "../services/emailService";
import { AccessType } from "../entities/AdminAssessmentAccess.entity";

export class OrganizerController {
    private contestRepo = AppDataSource.getRepository(Contest);
    private userRepo = AppDataSource.getRepository(User);
    private violationRepo = AppDataSource.getRepository(ContestViolation);
    private adminAccessService = new AdminAccessService();
    private authService = new AuthenticationService();

    // Get all participants for a contest with filters
    async getContestParticipants(req: Request, res: Response) {
        try {
            const { contestId } = req.params;
            const {
                page = 1,
                limit = 10,
                search,
                sortBy = "name",
                filterBy = "all",
            } = req.query;

            const organizerId = (req as any).user.userId || (req as any).user.id;

            // Verify organizer owns this contest
            const contest = await this.contestRepo.findOne({
                where: { id: contestId },
                relations: ["createdBy", "contestant"],
            });

            if (!contest) {
                return res.status(404).json({ message: "Contest not found" });
            }

            if (contest.createdBy.id !== organizerId) {
                return res.status(403).json({ message: "Not authorized to view this contest" });
            }

            let participants = contest.contestant || [];

            // Apply search filter
            if (search) {
                const searchLower = (search as string).toLowerCase();
                participants = participants.filter(
                    (p) =>
                        p.username.toLowerCase().includes(searchLower) ||
                        p.email.toLowerCase().includes(searchLower)
                );
            }

            // Get violation counts for each participant
            const participantsWithStats = await Promise.all(
                participants.map(async (participant) => {
                    const violations = await this.violationRepo.find({
                        where: { contestId, userId: participant.id },
                    });

                    const plagiarismCount = violations.filter((v) =>
                        [ViolationType.COPY, ViolationType.PASTE].includes(v.violationType)
                    ).length;

                    const tabSwitchCount = violations.filter((v) =>
                        [ViolationType.TAB_SWITCH_AWAY, ViolationType.TAB_SWITCH_RETURN].includes(
                            v.violationType
                        )
                    ).length;

                    return {
                        id: participant.id,
                        username: participant.username,
                        email: participant.email,
                        avatarUrl: participant.avatarUrl,
                        rank: participant.rank,
                        totalSolved: 0, // TODO: Calculate from submissions
                        totalSubmissions: 0, // TODO: Calculate from submissions
                        plagiarismCount,
                        aiDetectionCount: 0, // TODO: Implement AI detection
                        tabSwitchCount,
                        isBanned: participant.isBanned,
                        registeredAt: participant.createdAt,
                    };
                })
            );

            // Apply filter
            let filteredParticipants = participantsWithStats;
            if (filterBy === "plagiarism") {
                filteredParticipants = participantsWithStats.filter((p) => p.plagiarismCount > 0);
            } else if (filterBy === "ai_detected") {
                filteredParticipants = participantsWithStats.filter((p) => p.aiDetectionCount > 0);
            } else if (filterBy === "banned") {
                filteredParticipants = participantsWithStats.filter((p) => p.isBanned);
            }

            // Apply sorting
            filteredParticipants.sort((a, b) => {
                if (sortBy === "solved") return b.totalSolved - a.totalSolved;
                if (sortBy === "plagiarism") return b.plagiarismCount - a.plagiarismCount;
                if (sortBy === "name") return a.username.localeCompare(b.username);
                if (sortBy === "registeredAt")
                    return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
                return 0;
            });

            // Pagination
            const skip = (Number(page) - 1) * Number(limit);
            const paginatedParticipants = filteredParticipants.slice(skip, skip + Number(limit));

            res.json({
                participants: paginatedParticipants,
                total: filteredParticipants.length,
                page: Number(page),
                totalPages: Math.ceil(filteredParticipants.length / Number(limit)),
            });
        } catch (error) {
            console.error("Error fetching contest participants:", error);
            res.status(500).json({ message: "Error fetching contest participants" });
        }
    }

    // Get detailed participant information
    async getParticipantDetails(req: Request, res: Response) {
        try {
            const { contestId, userId } = req.params;
            const organizerId = (req as any).user.userId || (req as any).user.id;

            // Verify organizer owns this contest
            const contest = await this.contestRepo.findOne({
                where: { id: contestId },
                relations: ["createdBy"],
            });

            if (!contest || contest.createdBy.id !== organizerId) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Get all violations for this user in this contest
            const violations = await this.violationRepo.find({
                where: { contestId, userId },
                order: { timestamp: "DESC" },
            });

            const copyCount = violations.filter((v) => v.violationType === ViolationType.COPY).length;
            const pasteCount = violations.filter((v) => v.violationType === ViolationType.PASTE).length;
            const tabSwitchCount = violations.filter(
                (v) =>
                    v.violationType === ViolationType.TAB_SWITCH_AWAY ||
                    v.violationType === ViolationType.TAB_SWITCH_RETURN
            ).length;

            // Calculate total time away
            let totalTimeAway = 0;
            violations
                .filter((v) => v.violationType === ViolationType.TAB_SWITCH_RETURN)
                .forEach((v) => {
                    if (v.metadata?.durationMs) {
                        totalTimeAway += v.metadata.durationMs;
                    }
                });

            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    rank: user.rank,
                    isBanned: user.isBanned,
                    banReason: user.banReason,
                    bannedAt: user.bannedAt,
                },
                stats: {
                    totalSolved: 0, // TODO: Calculate from submissions
                    totalSubmissions: 0, // TODO: Calculate from submissions
                    acceptanceRate: 0, // TODO: Calculate
                    copyCount,
                    pasteCount,
                    tabSwitchCount,
                    totalTimeAway,
                },
                violations: violations.map((v) => ({
                    id: v.id,
                    type: v.violationType,
                    timestamp: v.timestamp,
                    metadata: v.metadata,
                    reviewed: v.reviewed,
                })),
            });
        } catch (error) {
            console.error("Error fetching participant details:", error);
            res.status(500).json({ message: "Error fetching participant details" });
        }
    }

    // Report violation (called by contestants)
    async reportViolation(req: Request, res: Response) {
        try {
            const { contestId } = req.params;
            const { violations } = req.body;
            const userId = (req as any).user.userId || (req as any).user.id;

            if (!Array.isArray(violations) || violations.length === 0) {
                return res.status(400).json({ message: "Violations array is required" });
            }

            const savedViolations = await Promise.all(
                violations.map(async (v: any) => {
                    const violation = this.violationRepo.create({
                        contestId,
                        userId,
                        problemId: v.problemId,
                        violationType: v.violationType,
                        timestamp: new Date(v.timestamp),
                        metadata: v.metadata || {},
                    });
                    return await this.violationRepo.save(violation);
                })
            );

            res.json({
                success: true,
                count: savedViolations.length,
            });
        } catch (error) {
            console.error("Error reporting violation:", error);
            res.status(500).json({ message: "Error reporting violation" });
        }
    }

    // Get violation summary for organizer
    async getViolationSummary(req: Request, res: Response) {
        try {
            const { contestId } = req.params;
            const { userId } = req.query;
            const organizerId = (req as any).user.userId || (req as any).user.id;

            // Verify organizer owns this contest
            const contest = await this.contestRepo.findOne({
                where: { id: contestId },
                relations: ["createdBy"],
            });

            if (!contest || contest.createdBy.id !== organizerId) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const where: any = { contestId };
            if (userId) where.userId = userId;

            const violations = await this.violationRepo.find({
                where,
                relations: ["user"],
                order: { timestamp: "DESC" },
            });

            // Group by user
            const userViolations: any = {};
            violations.forEach((v) => {
                if (!userViolations[v.userId]) {
                    userViolations[v.userId] = {
                        userId: v.userId,
                        username: v.user.username,
                        violations: {
                            copyCount: 0,
                            pasteCount: 0,
                            tabSwitchCount: 0,
                            totalTimeAway: 0,
                            longestAbsence: 0,
                        },
                        timeline: [],
                    };
                }

                if (v.violationType === ViolationType.COPY) userViolations[v.userId].violations.copyCount++;
                if (v.violationType === ViolationType.PASTE) userViolations[v.userId].violations.pasteCount++;
                if (
                    v.violationType === ViolationType.TAB_SWITCH_AWAY ||
                    v.violationType === ViolationType.TAB_SWITCH_RETURN
                ) {
                    userViolations[v.userId].violations.tabSwitchCount++;
                }

                if (v.violationType === ViolationType.TAB_SWITCH_RETURN && v.metadata?.durationMs) {
                    userViolations[v.userId].violations.totalTimeAway += v.metadata.durationMs;
                    userViolations[v.userId].violations.longestAbsence = Math.max(
                        userViolations[v.userId].violations.longestAbsence,
                        v.metadata.durationMs
                    );
                }

                userViolations[v.userId].timeline.push({
                    timestamp: v.timestamp,
                    type: v.violationType,
                    metadata: v.metadata,
                });
            });

            res.json(userId ? userViolations[userId as string] : Object.values(userViolations));
        } catch (error) {
            console.error("Error fetching violation summary:", error);
            res.status(500).json({ message: "Error fetching violation summary" });
        }
    }

    // Get violation alerts
    async getViolationAlerts(req: Request, res: Response) {
        try {
            const { contestId } = req.params;
            const organizerId = (req as any).user.userId || (req as any).user.id;

            // Verify organizer owns this contest
            const contest = await this.contestRepo.findOne({
                where: { id: contestId },
                relations: ["createdBy"],
            });

            if (!contest || contest.createdBy.id !== organizerId) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const violations = await this.violationRepo.find({
                where: { contestId },
                relations: ["user"],
                order: { timestamp: "DESC" },
            });

            // Analyze for suspicious patterns
            const alerts: any[] = [];
            const userViolations: any = {};

            violations.forEach((v) => {
                if (!userViolations[v.userId]) {
                    userViolations[v.userId] = {
                        user: v.user,
                        paste: [],
                        tabSwitch: [],
                    };
                }

                if (v.violationType === ViolationType.PASTE) {
                    userViolations[v.userId].paste.push(v);
                }
                if (v.violationType === ViolationType.TAB_SWITCH_RETURN) {
                    userViolations[v.userId].tabSwitch.push(v);
                }
            });

            // Check for excessive paste (>5 in 2 minutes)
            Object.values(userViolations).forEach((uv: any) => {
                const recentPastes = uv.paste.filter(
                    (v: any) => Date.now() - new Date(v.timestamp).getTime() < 2 * 60 * 1000
                );
                if (recentPastes.length > 5) {
                    alerts.push({
                        userId: uv.user.id,
                        username: uv.user.username,
                        alertType: "EXCESSIVE_PASTE",
                        severity: "MEDIUM",
                        description: `${recentPastes.length} paste events in last 2 minutes`,
                        timestamp: new Date().toISOString(),
                    });
                }

                // Check for long absence (>5 minutes)
                uv.tabSwitch.forEach((v: any) => {
                    if (v.metadata?.durationMs > 5 * 60 * 1000) {
                        alerts.push({
                            userId: uv.user.id,
                            username: uv.user.username,
                            alertType: "LONG_ABSENCE",
                            severity: "HIGH",
                            description: `Away for ${Math.round(v.metadata.durationMs / 60000)} minutes`,
                            timestamp: v.timestamp,
                        });
                    }
                });
            });

            res.json({ alerts });
        } catch (error) {
            console.error("Error fetching violation alerts:", error);
            res.status(500).json({ message: "Error fetching violation alerts" });
        }
    }

    // Ban participant
    async banParticipant(req: Request, res: Response) {
        try {
            const { contestId, userId } = req.params;
            const { reason, permanent = false } = req.body;
            const organizerId = (req as any).user.userId || (req as any).user.id;

            // Verify organizer owns this contest
            const contest = await this.contestRepo.findOne({
                where: { id: contestId },
                relations: ["createdBy"],
            });

            if (!contest || contest.createdBy.id !== organizerId) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.isBanned = true;
            user.banReason = reason;
            user.bannedAt = new Date();

            await this.userRepo.save(user);

            // TODO: Send ban notification email

            res.json({
                message: "User banned successfully",
                user: {
                    id: user.id,
                    username: user.username,
                    isBanned: user.isBanned,
                    banReason: user.banReason,
                },
            });
        } catch (error) {
            console.error("Error banning participant:", error);
            res.status(500).json({ message: "Error banning participant" });
        }
    }

    // Unban participant
    async unbanParticipant(req: Request, res: Response) {
        try {
            const { contestId, userId } = req.params;
            const organizerId = (req as any).user.userId || (req as any).user.id;

            // Verify organizer owns this contest
            const contest = await this.contestRepo.findOne({
                where: { id: contestId },
                relations: ["createdBy"],
            });

            if (!contest || contest.createdBy.id !== organizerId) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            user.isBanned = false;
            user.banReason = null as any;
            user.bannedAt = null as any;

            await this.userRepo.save(user);

            res.json({
                message: "User unbanned successfully",
                user: {
                    id: user.id,
                    username: user.username,
                    isBanned: user.isBanned,
                },
            });
        } catch (error) {
            console.error("Error unbanning participant:", error);
            res.status(500).json({ message: "Error unbanning participant" });
        }
    }

    // 🔐 ============ ADMIN MANAGEMENT ENDPOINTS ============

    /**
     * Create admin and send login link
     * POST /api/organizer/admins
     */
    async createAdmin(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { email, fullName, role, accessType, assessmentIds } = req.body;

            if (!email || !fullName) {
                return res.status(400).json({
                    success: false,
                    error: "Email and fullName are required",
                });
            }

            // Validate access type
            if (accessType === AccessType.PARTIAL && (!assessmentIds || assessmentIds.length === 0)) {
                return res.status(400).json({
                    success: false,
                    error: "PARTIAL access requires assessmentIds",
                });
            }

            // Get organizer details
            const organizer = await this.userRepo.findOne({
                where: { id: organizerId },
            });

            if (!organizer) {
                return res.status(404).json({
                    success: false,
                    error: "Organizer not found",
                });
            }

            // Create admin with magic login link
            const admin = await this.authService.createAdminWithMagicLink(
                email,
                fullName,
                role || UserRole.ADMIN,
                organizerId,
                organizer.email
            );

            // Grant access to assessments
            const finalAccessType = accessType || AccessType.WHOLE;
            await this.adminAccessService.grantAccess(
                admin.id,
                organizerId,
                finalAccessType,
                finalAccessType === AccessType.PARTIAL ? assessmentIds : undefined
            );

            console.log(`[CREATE_ADMIN] Admin ${admin.email} created with ${finalAccessType} access`);
            if (finalAccessType === AccessType.PARTIAL) {
                console.log(`[CREATE_ADMIN] Assigned assessments: ${assessmentIds?.length || 0}`);
            }

            res.status(201).json({
                success: true,
                message: "Admin created successfully. Login link sent to email.",
                admin: {
                    id: admin.id,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    status: admin.status,
                    createdAt: admin.createdAt,
                    accessType: finalAccessType,
                    assessmentCount: finalAccessType === AccessType.PARTIAL ? assessmentIds?.length : "all",
                },
            });
        } catch (error: any) {
            console.error("Error creating admin:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * List all admins created by organizer
     * GET /api/organizer/admins
     */
    async listAdmins(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;

            const admins = await this.userRepo.find({
                where: {
                    assignedOrganizerId: organizerId,
                    role: In([UserRole.ADMIN, UserRole.COMPANY]),
                },
                select: [
                    "id",
                    "email",
                    "fullName",
                    "role",
                    "status",
                    "createdAt",
                    "lastLogin",
                    "assessmentsViewedCount",
                    "reportsDownloadedCount",
                ],
            });

            res.status(200).json({
                success: true,
                admins,
            });
        } catch (error: any) {
            console.error("Error listing admins:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get admin details and activity log
     * GET /api/organizer/admins/:id
     */
    async getAdminDetails(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            res.status(200).json({
                success: true,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    status: admin.status,
                    createdAt: admin.createdAt,
                    lastLogin: admin.lastLogin,
                    assessmentsViewedCount: admin.assessmentsViewedCount,
                    reportsDownloadedCount: admin.reportsDownloadedCount,
                },
            });
        } catch (error: any) {
            console.error("Error getting admin details:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Edit admin details
     * PUT /api/organizer/admins/:id
     */
    async editAdmin(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;
            const { fullName, email, role, status } = req.body;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            // Update fields
            if (fullName) admin.fullName = fullName;
            if (email) admin.email = email;
            if (role) admin.role = role;
            if (status) admin.status = status;

            await this.userRepo.save(admin);

            res.status(200).json({
                success: true,
                message: "Admin updated successfully",
                admin: {
                    id: admin.id,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    status: admin.status,
                },
            });
        } catch (error: any) {
            console.error("Error editing admin:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Resend login link to admin
     * POST /api/organizer/admins/:id/resend-login-link
     */
    async resendLoginLink(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            const organizer = await this.userRepo.findOne({
                where: { id: organizerId },
            });

            // Generate new magic token
            const { token: magicToken, expiryDate: magicTokenExpiry } =
                require("../utils/tokenGenerator").TokenGenerator.generateMagicToken();

            admin.magicLoginToken = magicToken;
            admin.magicLoginTokenExpiry = magicTokenExpiry;

            await this.userRepo.save(admin);

            // Send email
            await EmailService.sendLoginLinkResendEmail(
                admin.email,
                admin.fullName,
                magicToken
            );

            res.status(200).json({
                success: true,
                message: "Login link resent to admin email",
            });
        } catch (error: any) {
            console.error("Error resending login link:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Reset admin password
     * POST /api/organizer/admins/:id/reset-password
     */
    async resetAdminPassword(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            // Generate reset token
            const { token: resetToken, expiryDate: resetTokenExpiry } =
                require("../utils/tokenGenerator").TokenGenerator.generateResetToken();

            admin.resetToken = resetToken;
            admin.resetTokenExpiry = resetTokenExpiry;

            await this.userRepo.save(admin);

            // Send email
            await EmailService.sendPasswordResetEmail(admin.email, resetToken);

            res.status(200).json({
                success: true,
                message: "Password reset link sent to admin's email",
            });
        } catch (error: any) {
            console.error("Error resetting admin password:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Disable admin access
     * PUT /api/organizer/admins/:id/disable
     */
    async disableAdmin(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            admin.status = AdminStatus.DISABLED;
            await this.userRepo.save(admin);

            // Send email notification
            await EmailService.sendAdminDisabledEmail(admin.email, admin.fullName);

            res.status(200).json({
                success: true,
                message: "Admin access disabled",
                admin: {
                    id: admin.id,
                    status: admin.status,
                },
            });
        } catch (error: any) {
            console.error("Error disabling admin:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Delete admin
     * DELETE /api/organizer/admins/:id
     */
    async deleteAdmin(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            // First, delete all access records for this admin
            await this.adminAccessService.revokeAllAccess(adminId, organizerId);
            console.log(`[DELETE_ADMIN] Revoked all access for admin: ${admin.email}`);

            // Then delete the admin user
            await this.userRepo.delete(adminId);
            console.log(`[DELETE_ADMIN] Deleted admin user: ${admin.email}`);

            res.status(200).json({
                success: true,
                message: "Admin deleted successfully",
            });
        } catch (error: any) {
            console.error("Error deleting admin:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    // 🔐 ============ ADMIN ACCESS MANAGEMENT ENDPOINTS ============

    /**
     * Grant admin access to assessments (WHOLE or PARTIAL)
     * POST /api/organizer/admins/:id/access
     */
    async grantAdminAccess(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;
            const { accessType, assessmentIds } = req.body;

            // Verify admin exists
            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            if (!accessType || !["WHOLE", "PARTIAL"].includes(accessType)) {
                return res.status(400).json({
                    success: false,
                    error: "accessType must be WHOLE or PARTIAL",
                });
            }

            const access = await this.adminAccessService.grantAccess(
                adminId,
                organizerId,
                accessType as AccessType,
                accessType === "PARTIAL" ? assessmentIds : []
            );

            res.status(201).json({
                success: true,
                message: "Access granted successfully",
                access: {
                    adminId,
                    adminName: admin.fullName,
                    accessType,
                    assessmentsCount:
                        accessType === "WHOLE" ? "All" : assessmentIds?.length || 0,
                },
            });
        } catch (error: any) {
            console.error("Error granting access:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get admin access details
     * GET /api/organizer/admins/:id/access
     */
    async getAdminAccess(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            const access =
                await this.adminAccessService.getAdminAccess(adminId, organizerId);

            res.status(200).json({
                success: true,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    fullName: admin.fullName,
                    role: admin.role,
                    accessType: access.accessType,
                    assessmentsCount:
                        access.accessType === "WHOLE"
                            ? "All"
                            : access.assessments.length,
                    assessments: access.assessments.map((a) => ({
                        id: a.id,
                        title: a.title,
                        createdAt: a.createdAt,
                    })),
                },
            });
        } catch (error: any) {
            console.error("Error getting admin access:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Update admin access
     * PUT /api/organizer/admins/:id/access
     */
    async updateAdminAccess(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;
            const { accessType, assessmentIds } = req.body;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            if (!accessType || !["WHOLE", "PARTIAL"].includes(accessType)) {
                return res.status(400).json({
                    success: false,
                    error: "accessType must be WHOLE or PARTIAL",
                });
            }

            await this.adminAccessService.updateAccess(
                adminId,
                organizerId,
                accessType as AccessType,
                accessType === "PARTIAL" ? assessmentIds : []
            );

            res.status(200).json({
                success: true,
                message: "Access updated successfully",
                changes: {
                    accessType,
                    assessmentsCount:
                        accessType === "WHOLE" ? "All" : assessmentIds?.length || 0,
                },
            });
        } catch (error: any) {
            console.error("Error updating access:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Add assessments to admin access
     * POST /api/organizer/admins/:id/access/add-assessments
     */
    async addAssessmentsToAdmin(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;
            const { assessmentIds } = req.body;

            if (!assessmentIds || assessmentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: "assessmentIds are required",
                });
            }

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            await this.adminAccessService.addAssessments(
                adminId,
                organizerId,
                assessmentIds
            );

            res.status(200).json({
                success: true,
                message: "Assessments added to admin access",
                addedCount: assessmentIds.length,
            });
        } catch (error: any) {
            console.error("Error adding assessments:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Remove assessments from admin access
     * POST /api/organizer/admins/:id/access/remove-assessments
     */
    async removeAssessmentsFromAdmin(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;
            const { assessmentIds } = req.body;

            if (!assessmentIds || assessmentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: "assessmentIds are required",
                });
            }

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            await this.adminAccessService.removeAssessments(
                adminId,
                organizerId,
                assessmentIds
            );

            res.status(200).json({
                success: true,
                message: "Assessments removed from admin access",
                removedCount: assessmentIds.length,
            });
        } catch (error: any) {
            console.error("Error removing assessments:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Revoke all access from admin
     * DELETE /api/organizer/admins/:id/access
     */
    async revokeAdminAccess(req: Request, res: Response) {
        try {
            const organizerId = (req as any).user.userId || (req as any).user.id;
            const { id: adminId } = req.params;

            const admin = await this.userRepo.findOne({
                where: { id: adminId, assignedOrganizerId: organizerId },
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: "Admin not found",
                });
            }

            await this.adminAccessService.revokeAllAccess(adminId, organizerId);

            res.status(200).json({
                success: true,
                message: "All access revoked from admin",
            });
        } catch (error: any) {
            console.error("Error revoking access:", error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
}
