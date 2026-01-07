import { AppDataSource } from "../config/db";
import { AdminAssessmentAccess, AccessType } from "../entities/AdminAssessmentAccess.entity";
import { Assessment } from "../entities/Assessment.entity";
import { In } from "typeorm";

export class AdminAccessService {
  private adminAccessRepo =
    AppDataSource.getRepository(AdminAssessmentAccess);
  private assessmentRepo = AppDataSource.getRepository(Assessment);

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

    return !!access;
  }

  /**
   * Get all assessments admin can access
   */
  async getAccessibleAssessments(
    adminId: string,
    organizerId: string
  ): Promise<Assessment[]> {
    const accessRecords = await this.adminAccessRepo.find({
      where: {
        adminUserId: adminId,
        organizerId,
      },
    });

    if (accessRecords.length === 0) {
      return [];
    }

    // Check if admin has WHOLE access
    const wholeAccess = accessRecords.find(
      (r) => r.accessType === AccessType.WHOLE
    );

    if (wholeAccess) {
      return this.assessmentRepo.find({
        where: { organizer: { id: organizerId } } as any,
      });
    }

    // Get specific assessments
    const assessmentIds = accessRecords
      .filter((r) => r.assessmentId)
      .map((r) => r.assessmentId);

    if (assessmentIds.length === 0) {
      return [];
    }

    return this.assessmentRepo.find({
      where: { id: In(assessmentIds) },
    });
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
