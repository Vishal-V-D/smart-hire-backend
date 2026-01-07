import { Request, Response, NextFunction } from "express";
import { AdminAccessService } from "../services/adminAccess.service";

const adminAccessService = new AdminAccessService();

/**
 * Middleware to check if admin has access to assessment
 */
export const checkAssessmentAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { assessmentId } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // Skip check if user is ORGANIZER (they can access their own assessments)
    if (userRole === "ORGANIZER") {
      return next();
    }

    // For ADMIN/COMPANY, check if they have access
    if (userRole === "ADMIN" || userRole === "COMPANY") {
      const organizerId = (req as any).user?.assignedOrganizerId;

      if (!organizerId) {
        return res.status(403).json({
          success: false,
          error: "Admin not assigned to any organizer",
        });
      }

      const hasAccess = await adminAccessService.canAdminAccessAssessment(
        userId,
        assessmentId,
        organizerId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "You don't have access to this assessment",
        });
      }

      return next();
    }

    // For other roles, deny access
    res.status(403).json({
      success: false,
      error: "Insufficient permissions",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to check assessment access",
    });
  }
};

/**
 * Middleware to filter assessments based on admin access
 * Adds accessibleAssessments to request
 */
export const filterAccessibleAssessments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    // For ADMIN/COMPANY, get accessible assessments
    if (userRole === "ADMIN" || userRole === "COMPANY") {
      const organizerId = (req as any).user?.assignedOrganizerId;

      if (organizerId) {
        const accessibleAssessments =
          await adminAccessService.getAccessibleAssessments(userId, organizerId);

        (req as any).accessibleAssessments = accessibleAssessments;
      }
    }

    next();
  } catch (error: any) {
    console.error("Error filtering assessments:", error);
    next();
  }
};
