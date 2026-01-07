import { AppDataSource } from "../config/db";

/**
 * Migration to allow users to participate in multiple assessments
 * Removes the unique constraint on userId in contestant_profiles table
 */

const migrate = async () => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected");

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        console.log("\n🔧 Removing unique constraint on userId...");

        // Drop the unique constraint
        await queryRunner.query(`
            ALTER TABLE "contestant_profiles" 
            DROP CONSTRAINT IF EXISTS "REL_96b174b51e4c1e51b278432b41";
        `);

        console.log("✅ Unique constraint removed!");
        console.log("\n🎉 Migration completed successfully!");
        console.log("   Users can now participate in multiple assessments");

        await queryRunner.release();
        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

console.log("🚀 Running migration: Remove userId unique constraint");
migrate();
