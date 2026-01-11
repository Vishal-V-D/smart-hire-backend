import { AppDataSource } from "../config/db";
import { AdminAssessmentAccess, AccessType } from "../entities/AdminAssessmentAccess.entity";
import { Assessment } from "../entities/Assessment.entity";
import { User } from "../entities/user.entity";
import { In } from "typeorm";

export class AdminAccessService {
  private adminAccessRepo =
    AppDataSource.getRepository(AdminAssessmentAccess);
  private assessmentRepo = AppDataSource.getRepository(Assessment);
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Grant access to admin (WHOLE or PARTIAL)
   */
  async grantAccess(
    adminId: string,
    organizerId: string,
    accessType: AccessType,
    assessmentIds?: string[]
  ): Promise<AdminAssessmentAccess[]> {
    // Remove old access records
    await this.adminAccessRepo.delete({
      adminUserId: adminId,
      organizerId: organizerId,
    });

    const accessRecords: AdminAssessmentAccess[] = [];

    if (accessType === AccessType.WHOLE) {
      // Create one record with NULL assessmentId (means all assessments)
      const access = new AdminAssessmentAccess();
      access.adminUserId = adminId;
      access.organizerId = organizerId;
      access.assessmentId = null as any;
      access.accessType = AccessType.WHOLE;

      const saved = await this.adminAccessRepo.save(access);
      accessRecords.push(saved);
    } else {
      // Create records for specific assessments
      if (assessmentIds && assessmentIds.length > 0) {
        for (const assessmentId of assessmentIds) {
          const access = new AdminAssessmentAccess();
          access.adminUserId = adminId;
          access.organizerId = organizerId;
          access.assessmentId = assessmentId;
          access.accessType = AccessType.PARTIAL;

          const saved = await this.adminAccessRepo.save(access);
          accessRecords.push(saved);
        }
      }
    }

    return accessRecords;
  }

  /**
   * Get admin access details
   */
  async getAdminAccess(
    adminId: string,
    organizerId: string
  ): Promise<{
    adminId: string;
    accessType: AccessType;
    assessments: Assessment[];
  }> {
    const accessRecords = await this.adminAccessRepo.find({
      where: {
        adminUserId: adminId,
        organizerId,
      },
      relations: ["assessment"],
    });

    if (accessRecords.length === 0) {
      return {
        adminId,
        accessType: AccessType.PARTIAL,
        assessments: [],
      };
    }

    // Check if admin has WHOLE access
    const wholeAccessRecord = accessRecords.find(
      (r) => r.accessType === AccessType.WHOLE
    );

    if (wholeAccessRecord) {
      // Return all assessments by organizer
      const assessments = await this.assessmentRepo.find({
        where: { organizer: { id: organizerId } } as any,
      });

      return {
        adminId,
        accessType: AccessType.WHOLE,
        assessments,
      };
    }

    // Return only accessible assessments
    const assessmentIds = accessRecords
      .filter((r) => r.assessmentId)
      .map((r) => r.assessmentId);

    const assessments = await this.assessmentRepo.find({
      where: { id: In(assessmentIds) },
    });

    return {
      adminId,
      accessType: AccessType.PARTIAL,
      assessments,
    };
  }

  /**
   * Update admin access
   */
  async updateAccess(
    adminId: string,
    organizerId: string,
    accessType: AccessType,
    assessmentIds?: string[]
  ): Promise<AdminAssessmentAccess[]> {
    // Remove old access records
    await this.adminAccessRepo.delete({
      adminUserId: adminId,
      organizerId,
    });

    // Grant new access
    return this.grantAccess(adminId, organizerId, accessType, assessmentIds);
  }

  /**
   * Add assessments to admin access
   */
  async addAssessments(
    adminId: string,
    organizerId: string,
    assessmentIds: string[]
  ): Promise<AdminAssessmentAccess[]> {
    const accessRecords = await this.adminAccessRepo.find({
      where: {
        adminUserId: adminId,
        organizerId,
      },
    });

    // If admin has WHOLE access, no need to add
    if (
      accessRecords.some((r) => r.accessType === AccessType.WHOLE)
    ) {
      throw new Error("Admin already has WHOLE access to all assessments");
    }

    const existingAssessmentIds = accessRecords
      .filter((r) => r.assessmentId)
      .map((r) => r.assessmentId);

    const newAssessmentIds = assessmentIds.filter(
      (id) => !existingAssessmentIds.includes(id)
    );

    const newAccessRecords: AdminAssessmentAccess[] = [];

    for (const assessmentId of newAssessmentIds) {
      const access = new AdminAssessmentAccess();
      access.adminUserId = adminId;
      access.organizerId = organizerId;
      access.assessmentId = assessmentId;
      access.accessType = AccessType.PARTIAL;

      const saved = await this.adminAccessRepo.save(access);
      newAccessRecords.push(saved);
    }

    return newAccessRecords;
  }

  /**
   * Remove assessments from admin access
   */
  async removeAssessments(
    adminId: string,
    organizerId: string,
    assessmentIds: string[]
  ): Promise<number> {
    // Check if admin has WHOLE access
    const wholeAccess = await this.adminAccessRepo.findOne({
      where: {
        adminUserId: adminId,
        organizerId,
        accessType: AccessType.WHOLE,
      },
    });

    if (wholeAccess) {
      throw new Error(
        "Cannot remove assessments from admin with WHOLE access. Change to PARTIAL access first."
      );
    }

    const result = await this.adminAccessRepo.delete({
      adminUserId: adminId,
      organizerId,
      assessmentId: In(assessmentIds),
    });

    return result.affected || 0;
  }

  /**
   * Revoke all access from admin
   */
  async revokeAllAccess(
    adminId: string,
    organizerId: string
  ): Promise<number> {
    const result = await this.adminAccessRepo.delete({
      adminUserId: adminId,
      organizerId,
    });

    return result.affected || 0;
  }

  /**
   * Check if admin can access assessment
   */
  async canAdminAccessAssessment(
    adminId: string,
    assessmentId: string,
    organizerId: string
  ): Promise<boolean> {
    const access = await this.adminAccessRepo.findOne({
      where: [
        // WHOLE access
        {
          adminUserId: adminId,
          organizerId,
          accessType: AccessType.WHOLE,
        },
        // PARTIAL access to this specific assessment
        {
          adminUserId: adminId,
          organizerId,
          assessmentId,
          accessType: AccessType.PARTIAL,
        },
      ],
    });

    if (access) return true;

    // Check Company Permission fallback
    const { hasCompanyAccess, companyId, permissions } = await this.checkCompanyAccess(adminId);
    if (hasCompanyAccess) {
      const assessment = await this.assessmentRepo.findOne({ where: { id: assessmentId }, relations: ["company", "organizer"] });
      if (!assessment) return false;

      // 1. Is it a company assessment?
      if (assessment.companyId === companyId) {
        // 2. Do they have view all permission?
        if (permissions?.viewAllAssessments) return true;
        // 3. Did they create it?
        if (assessment.organizer?.id === adminId) return true;
        // 4. Was it assigned by the Platform Organizer?
        // (If companyId matches, and organizer is ORGANIZER role, it means it was assigned)
        if (assessment.organizer?.role === 'ORGANIZER') return true;
      }
    }

    return false;
  }

  /**
   * Internal helper to check company permissions
   */
  private async checkCompanyAccess(adminId: string): Promise<{ hasCompanyAccess: boolean; companyId?: string; permissions?: any }> {
    const user = await this.userRepo.findOne({ where: { id: adminId }, relations: ["company"] } as any);
    if (!user || user.role !== 'ADMIN' || !user.company) {
      return { hasCompanyAccess: false };
    }
    return {
      hasCompanyAccess: true,
      companyId: user.company.id,
      permissions: user.company.permissions
    };
  }

  /**
   * Get all assessments admin can access
   */
  async getAccessibleAssessments(
    adminId: string,
    organizerId: string
  ): Promise<Assessment[]> {
    // 1. Get manually granted access records
    const accessRecords = await this.adminAccessRepo.find({
      where: {
        adminUserId: adminId,
        organizerId,
      },
    });

    // 2. Check Company Permissions (View All or Self-Created)
    const { hasCompanyAccess, companyId, permissions } = await this.checkCompanyAccess(adminId);
    console.log(`[ACCESS_SERVICE] Admin ${adminId} Company Access: ${hasCompanyAccess}, ID: ${companyId}`);

    let accessibleAssessments: Assessment[] = [];

    // Strategy: Fetch Manual + Company assessments and Combine

    // A. Add assessments from Manual WHOLE Access
    const wholeAccess = accessRecords.find((r) => r.accessType === AccessType.WHOLE);
    if (wholeAccess) {
      const manualAssessments = await this.assessmentRepo.find({
        where: { organizer: { id: organizerId } } as any,
      });
      return manualAssessments; // WHOLE access overrides everything (usually)
    }

    // B. Add assessments from Manual PARTIAL Access
    const manualIds = accessRecords
      .filter((r) => r.assessmentId)
      .map((r) => r.assessmentId);

    // Construct Final Query
    const query = this.assessmentRepo.createQueryBuilder("assessment")
      .leftJoinAndSelect("assessment.organizer", "organizer")
      .leftJoinAndSelect("assessment.company", "company")
      .where("assessment.id IN (:...manualIds)", { manualIds: manualIds.length > 0 ? manualIds : ['00000000-0000-0000-0000-000000000000'] }); // Default invalid ID if empty

    if (hasCompanyAccess) {
      if (permissions?.viewAllAssessments) {
        // Can see EVERYTHING related to their company
        query.orWhere("assessment.companyId = :companyId", { companyId });
      } else {
        // Can see:
        // 1. Their own created assessments
        query.orWhere("assessment.organizerId = :adminId", { adminId });

        // 2. Assessments ASSIGNED to their company by the Organizer (Role = ORGANIZER)
        query.orWhere("(assessment.companyId = :companyId AND organizer.role = :orgRole)", {
          companyId,
          orgRole: 'ORGANIZER'
        });
      }
    }

    accessibleAssessments = await query.getMany();
    return accessibleAssessments;
  }

  /**
   * List all admins with their access for organizer
   */
  async listAdminsWithAccess(
    organizerId: string
  ): Promise<
    Array<{
      adminId: string;
      accessType: AccessType;
      assessmentCount: number;
      assessmentIds: string[];
    }>
  > {
    const accessRecords = await this.adminAccessRepo.find({
      where: { organizerId },
    });

    const adminAccessMap = new Map<
      string,
      {
        adminId: string;
        accessType: AccessType;
        assessmentCount: number;
        assessmentIds: string[];
      }
    >();

    for (const record of accessRecords) {
      if (record.accessType === AccessType.WHOLE) {
        // Count all assessments by organizer
        const assessmentCount = await this.assessmentRepo.count({
          where: { organizer: { id: organizerId } } as any,
        });

        adminAccessMap.set(record.adminUserId, {
          adminId: record.adminUserId,
          accessType: AccessType.WHOLE,
          assessmentCount,
          assessmentIds: [],
        });
      } else if (record.assessmentId) {
        // Track partial access
        const existing = adminAccessMap.get(record.adminUserId) || {
          adminId: record.adminUserId,
          accessType: AccessType.PARTIAL,
          assessmentCount: 0,
          assessmentIds: [],
        };

        existing.assessmentIds.push(record.assessmentId);
        existing.assessmentCount = existing.assessmentIds.length;

        adminAccessMap.set(record.adminUserId, existing);
      }
    }

    return Array.from(adminAccessMap.values());
  }
}
