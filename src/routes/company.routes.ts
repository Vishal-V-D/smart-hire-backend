
import { Router } from "express";
import { checkAuth, checkRole } from "../middleware/auth.middleware";
import { CompanyController } from "../controllers/company.controller";
import { UserRole } from "../entities/user.entity";

const router = Router();
const companyController = new CompanyController();

// PUBLIC: Register a new company
router.post("/register", (req, res) => {
    console.log(`[DEBUG] Company Registration Request: ${req.body.companyName} (${req.body.adminEmail})`);
    companyController.registerCompany(req, res);
});

// PUBLIC: Setup password after approval
router.post("/setup-password", (req, res) => {
    console.log(`[DEBUG] Password Setup Request for token: ${req.body.token?.substring(0, 10)}...`);
    companyController.setupPassword(req, res);
});

// COMPANY ADMIN: Add new admin (user) to their company
router.post(
    "/add-admin",
    checkAuth,
    checkRole([UserRole.ADMIN]),
    (req, res) => {
        console.log(`[DEBUG] Add Admin Request by ${(req as any).user?.email}`);
        companyController.addTeamMember(req, res);
    }
);

// ORGANIZER: Approve Company
router.post(
    "/:companyId/approve",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Approve Company Request: ${req.params.companyId} by Organizer`);
        companyController.approveCompany(req, res);
    }
);

// ORGANIZER: Approve Specific User
router.post(
    "/users/:userId/approve",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Approve User Request: ${req.params.userId} by Organizer`);
        companyController.approveUser(req, res);
    }
);

// ORGANIZER: Reject Company
router.post(
    "/:companyId/reject",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Reject Company Request: ${req.params.companyId} by Organizer`);
        companyController.rejectCompany(req, res);
    }
);

// ORGANIZER: Reject Specific User
router.post(
    "/users/:userId/reject",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Reject User Request: ${req.params.userId} by Organizer`);
        companyController.rejectUser(req, res);
    }
);

// ORGANIZER: Get Pending Requests
router.get(
    "/pending",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Fetch Pending Requests by Organizer`);
        companyController.getPendingRequests(req, res);
    }
);

// ORGANIZER: Assign Assessment to Company
router.post(
    "/assign-assessment",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Assign Assessment Request by Organizer`);
        companyController.assignAssessment(req, res);
    }
);

// ORGANIZER: Get All Companies (Detailed)
router.get(
    "/",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Fetch All Companies Request by Organizer`);
        companyController.getAllCompanies(req, res);
    }
);

// ORGANIZER: Delete Company
router.delete(
    "/:companyId",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Delete Company Request: ${req.params.companyId} by Organizer`);
        companyController.deleteCompany(req, res);
    }
);

// ORGANIZER: Update Company Permissions
router.put(
    "/:companyId/permissions",
    checkAuth,
    checkRole([UserRole.ORGANIZER]),
    (req, res) => {
        console.log(`[DEBUG] Update Permissions Request: ${req.params.companyId} by Organizer`);
        companyController.updatePermissions(req, res);
    }
);

// ORGANIZER/ADMIN: Get Company History
router.get(
    "/:companyId/history",
    checkAuth,
    checkRole([UserRole.ORGANIZER, UserRole.ADMIN]),
    (req, res) => {
        console.log(`[DEBUG] Fetch History Request: ${req.params.companyId} by ${(req as any).user.role}`);
        companyController.getCompanyHistory(req, res);
    }
);

// COMPANY ADMIN: Get Team Members
router.get(
    "/team",
    checkAuth,
    checkRole([UserRole.ADMIN]),
    (req, res) => {
        console.log(`[DEBUG] Fetch Team Request by ${(req as any).user.email}`);
        companyController.getTeamMembers(req, res);
    }
);

export default router;
