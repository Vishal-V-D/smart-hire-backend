import { Request, Response } from "express";
import * as CompanyService from "../services/company.service";

export class CompanyController {
    // Register Company + First Admin
    public async registerCompany(req: Request, res: Response) {
        try {
            console.log("Loading CompanyController.registerCompany");
            const { companyName, website, details, contactEmail, contactPhone, adminName, adminEmail } = req.body;
            const result = await CompanyService.registerCompany(
                companyName,
                website,
                details,
                contactEmail,
                contactPhone,
                adminName,
                adminEmail
            );
            res.status(201).json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Registration failed" });
        }
    }

    // Company Admin adds a teammate
    public async addTeamMember(req: Request, res: Response) {
        try {
            const { name, email, password } = req.body;
            const result = await CompanyService.requestNewAdmin(
                (req as any).user.companyId,
                (req as any).user.id,
                name,
                email,
                password
            );
            res.status(201).json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to add team member" });
        }
    }

    // Company Admin: Get Team Members
    public async getTeamMembers(req: Request, res: Response) {
        try {
            const companyId = (req as any).user.companyId;
            const result = await CompanyService.getCompanyTeam(companyId);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to fetch team" });
        }
    }

    // Organizer approves company
    public async approveCompany(req: Request, res: Response) {
        try {
            const { companyId } = req.params;
            const result = await CompanyService.approveCompany((req as any).user.id, companyId);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Approval failed" });
        }
    }

    // Organizer approves user
    public async approveUser(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const result = await CompanyService.approveUser((req as any).user.id, userId);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "User approval failed" });
        }
    }

    // Organizer rejects company
    public async rejectCompany(req: Request, res: Response) {
        try {
            const { companyId } = req.params;
            const { reason } = req.body;
            const result = await CompanyService.rejectCompany((req as any).user.id, companyId, reason);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Rejection failed" });
        }
    }

    // Organizer rejects user
    public async rejectUser(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const result = await CompanyService.rejectUser((req as any).user.id, userId, reason);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "User rejection failed" });
        }
    }

    // Get all pending requests
    public async getPendingRequests(req: Request, res: Response) {
        try {
            const result = await CompanyService.getPendingRequests();
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to fetch requests" });
        }
    }

    // Assign Assessment to Company
    public async assignAssessment(req: Request, res: Response) {
        try {
            const { assessmentId, targetCompanyId } = req.body;
            const result = await CompanyService.assignAssessmentToCompany(
                (req as any).user.id,
                assessmentId,
                targetCompanyId
            );
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Assignment failed" });
        }
    }

    // Setup Password (Public - uses token)
    public async setupPassword(req: Request, res: Response) {
        try {
            const { token, password } = req.body;
            const result = await CompanyService.setupPassword(token, password);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Password setup failed" });
        }
    }

    // Get All Companies (Organizer)
    public async getAllCompanies(req: Request, res: Response) {
        try {
            const result = await CompanyService.getAllCompanies();
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to fetch companies" });
        }
    }

    // Delete Company (Organizer)
    public async deleteCompany(req: Request, res: Response) {
        try {
            const { companyId } = req.params;
            const result = await CompanyService.deleteCompany(companyId);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to delete company" });
        }
    }

    // Update Company Permissions (Organizer)
    public async updatePermissions(req: Request, res: Response) {
        try {
            const { companyId } = req.params;
            const { permissions } = req.body;
            const result = await CompanyService.updateCompanyPermissions(
                (req as any).user.id,
                companyId,
                permissions
            );
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to update permissions" });
        }
    }

    // Get Company History Logs
    public async getCompanyHistory(req: Request, res: Response) {
        try {
            const { companyId } = req.params;
            const user = (req as any).user;

            // Security Check
            if (user.role === "ADMIN") {
                // Must belong to this company
                if (user.companyId !== companyId) {
                    return res.status(403).json({ message: "Access denied. You can only view your own company history." });
                }
            }

            const result = await CompanyService.getCompanyHistory(companyId);
            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({ message: error.message || "Failed to fetch history" });
        }
    }
}
