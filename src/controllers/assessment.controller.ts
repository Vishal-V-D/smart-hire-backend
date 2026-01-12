import { Request, Response } from "express";
import * as assessmentService from "../services/assessment.service";
import * as sectionService from "../services/assessmentSection.service";
import { AdminAccessService } from "../services/adminAccess.service";

const adminAccessService = new AdminAccessService();

// ✅ Create Assessment
export const createAssessment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const assessment = await assessmentService.createAssessment(req.body, user.id);
        res.status(201).json(assessment);
    } catch (err: any) {
        console.error("❌ [CREATE_ASSESSMENT] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ List Assessments
export const listAssessments = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { status, page, limit, sortBy, order } = req.query;

        // Filter out invalid status values
        const validStatuses = ['draft', 'published', 'active', 'completed', 'archived'];
        const statusFilter = (status && typeof status === 'string' && status !== 'undefined' && validStatuses.includes(status))
            ? status as any
            : undefined;

        // For ADMIN/COMPANY users, get only assessments they have access to
        if (user.role === 'ADMIN' || user.role === 'COMPANY') {
            console.log(`[LIST_ASSESSMENTS] User is ${user.role}, filtering by access`);

            // Get accessible assessments for this admin
            const accessibleAssessments = await adminAccessService.getAccessibleAssessments(
                user.id,
                user.assignedOrganizerId || user.id
            );

            console.log(`[LIST_ASSESSMENTS] Found ${accessibleAssessments.length} accessible assessments`);

            // Return assessments with pagination info
            return res.json({
                assessments: accessibleAssessments,
                total: accessibleAssessments.length,
                page: 1,
                limit: accessibleAssessments.length,
                totalPages: 1
            });
        }

        // For ORGANIZER, get all their assessments
        const result = await assessmentService.listAssessments(user.id, {
            status: statusFilter,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
            sortBy: sortBy as any,
            order: order as any,
        });

        res.json(result);
    } catch (err: any) {
        console.error("❌ [LIST_ASSESSMENTS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Get Assessment by ID
export const getAssessment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const assessmentId = req.params.id;

        // For ADMIN/COMPANY, check if they have access to this assessment
        if (user.role === 'ADMIN' || user.role === 'COMPANY') {
            console.log(`[GET_ASSESSMENT] User is ${user.role}, checking access`);

            const canAccess = await adminAccessService.canAdminAccessAssessment(
                user.id,
                assessmentId,
                user.assignedOrganizerId || user.id
            );

            if (!canAccess) {
                return res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message: "You don't have access to this assessment"
                    }
                });
            }

            // Get assessment using organizer ID (not admin ID)
            // We can skip ownership check here because we ALREADY validated it above via adminAccessService
            const assessment = await assessmentService.getAssessmentById(
                assessmentId,
                user.assignedOrganizerId || "", // Organizer ID might not be needed if skipping check
                true // ✅ Skip redundant check
            );
            return res.json(assessment);
        }

        // For ORGANIZER, use their own ID
        const assessment = await assessmentService.getAssessmentById(assessmentId, user.id);
        res.json(assessment);
    } catch (err: any) {
        console.error("❌ [GET_ASSESSMENT] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 404 ? "NOT_FOUND" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Update Assessment
export const updateAssessment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const assessment = await assessmentService.updateAssessment(req.params.id, user.id, req.body);
        res.json(assessment);
    } catch (err: any) {
        console.error("❌ [UPDATE_ASSESSMENT] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 409 ? "CONFLICT" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Delete Assessment
export const deleteAssessment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        await assessmentService.deleteAssessment(req.params.id, user.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("❌ [DELETE_ASSESSMENT] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 409 ? "CONFLICT" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Get Assessments by Company (Organizer View)
export const getCompanyAssessments = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { companyId } = req.params;

        console.log(`[GET_COMPANY_ASSESSMENTS] Organizer ${user.id} fetching for Company ${companyId}`);

        const assessments = await assessmentService.getAssessmentsByCompany(user.id, companyId);
        res.json(assessments);
    } catch (err: any) {
        console.error("❌ [GET_COMPANY_ASSESSMENTS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 403 ? "FORBIDDEN" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Publish Assessment
export const publishAssessment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const assessment = await assessmentService.publishAssessment(req.params.id, user.id);
        res.json(assessment);
    } catch (err: any) {
        console.error("❌ [PUBLISH_ASSESSMENT] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 422 ? "UNPROCESSABLE_ENTITY" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// =====================
// SECTION ENDPOINTS (nested under assessment)
// =====================

// ✅ Create Section
export const createSection = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const section = await sectionService.createSection(req.params.assessmentId, req.body, user.id);
        res.status(201).json(section);
    } catch (err: any) {
        console.error("❌ [CREATE_SECTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ List Sections
export const listSections = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const assessmentId = req.params.assessmentId;

        // For ADMIN/COMPANY, check access and use organizer ID
        if (user.role === 'ADMIN' || user.role === 'COMPANY') {
            const canAccess = await adminAccessService.canAdminAccessAssessment(
                user.id,
                assessmentId,
                user.assignedOrganizerId || user.id
            );

            if (!canAccess) {
                return res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message: "You don't have access to this assessment"
                    }
                });
            }

            const sections = await sectionService.listSections(assessmentId, user.assignedOrganizerId);
            return res.json(sections);
        }

        const sections = await sectionService.listSections(assessmentId, user.id);
        res.json(sections);
    } catch (err: any) {
        console.error("❌ [LIST_SECTIONS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Reorder Sections
export const reorderSections = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { sectionIds } = req.body;

        if (!Array.isArray(sectionIds)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "sectionIds must be an array"
                }
            });
        }

        const result = await sectionService.reorderSections(req.params.assessmentId, sectionIds, user.id);
        res.json(result);
    } catch (err: any) {
        console.error("❌ [REORDER_SECTIONS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};
// 🕵️ Get Plagiarism Configuration for Assessment
export const getPlagiarismConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        // Handle ADMIN access
        let organizerId = user.id;
        if (user.role === 'ADMIN' || user.role === 'COMPANY') {
            const canAccess = await adminAccessService.canAdminAccessAssessment(
                user.id, id, user.assignedOrganizerId || user.id
            );
            if (!canAccess) {
                res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message: "You do not have access to this assessment"
                    }
                });
                return;
            }
            organizerId = user.assignedOrganizerId || user.id;
        }

        const config = await assessmentService.getPlagiarismConfig(id, organizerId);
        res.json(config);
    } catch (err: any) {
        console.error("❌ [GET_PLAGIARISM_CONFIG] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// 🕵️ Update Plagiarism Configuration for Assessment
export const updatePlagiarismConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const configData = req.body;

        // Validate configuration
        if (configData.strictness && !["Low", "Medium", "High"].includes(configData.strictness)) {
            res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Strictness must be 'Low', 'Medium', or 'High'"
                }
            });
            return;
        }

        if (configData.similarityThreshold !== undefined) {
            const threshold = configData.similarityThreshold;
            if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
                res.status(400).json({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Similarity threshold must be a number between 0-100"
                    }
                });
                return;
            }
        }

        if (configData.aiSensitivity && !["Low", "Medium", "High"].includes(configData.aiSensitivity)) {
            res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "AI Sensitivity must be 'Low', 'Medium', or 'High'"
                }
            });
            return;
        }

        const config = await assessmentService.updatePlagiarismConfig(id, user.id, configData);
        res.json({
            message: "Plagiarism configuration updated successfully",
            config
        });
    } catch (err: any) {
        console.error("❌ [UPDATE_PLAGIARISM_CONFIG] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// 🕵️ Reset Plagiarism Configuration to Defaults
export const resetPlagiarismConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        const config = await assessmentService.resetPlagiarismConfig(id, user.id);
        res.json({
            message: "Plagiarism configuration reset to defaults",
            config
        });
    } catch (err: any) {
        console.error("❌ [RESET_PLAGIARISM_CONFIG] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};