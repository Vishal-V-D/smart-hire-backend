import { AppDataSource } from "../config/db";
import { Company } from "../entities/Company.entity";
import { User } from "../entities/user.entity";
import { Assessment } from "../entities/Assessment.entity";
import { Notification } from "../entities/Notification.entity";

// Usage: ts-node src/scripts/forceDeleteCompany.ts <companyId>
const companyId = process.argv[2] || "YOUR_COMPANY_ID_HERE";

const forceDeleteCompany = async () => {
    try {
        if (companyId === "YOUR_COMPANY_ID_HERE") {
            console.error("❌ Please provide a Company ID.");
            process.exit(1);
        }

        await AppDataSource.initialize();
        console.log(`✅ Database connected. Attempting to delete company: ${companyId}`);

        // 1. Delete associated Notifications first
        console.log("🗑️ Deleting related Notifications...");
        await AppDataSource.createQueryBuilder()
            .delete()
            .from(Notification)
            .where("companyId = :id", { id: companyId })
            .execute();

        // 2. Delete associated Assessments
        console.log("🗑️ Deleting related Assessments...");
        await AppDataSource.createQueryBuilder()
            .delete()
            .from(Assessment)
            .where("companyId = :id", { id: companyId })
            .execute();

        // 3. Delete associated Users (which might have other dependencies)
        console.log("🗑️ Deleting related Users (Admins)...");
        await AppDataSource.createQueryBuilder()
            .delete()
            .from(User)
            .where("companyId = :id", { id: companyId })
            .execute();

        // 4. Finally Delete the Company
        console.log("🏢 Deleting Company record...");
        const result = await AppDataSource.createQueryBuilder()
            .delete()
            .from(Company)
            .where("id = :id", { id: companyId })
            .execute();

        if (result.affected === 0) {
            console.log("⚠️ Company not found or already deleted.");
        } else {
            console.log("✅ Company deleted successfully.");
        }

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error deleting company:", error);
        process.exit(1);
    }
};

forceDeleteCompany();
