import { AppDataSource } from "../config/db";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";

/**
 * One-time script to mark all invitations for a specific email as ACCEPTED
 * Usage: npm run ts-node src/scripts/fix-invitation.ts <email>
 */

const fixInvitation = async (email: string) => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected");

        const invitationRepo = AppDataSource.getRepository(AssessmentInvitation);

        // Find all invitations for this email
        const invitations = await invitationRepo.find({
            where: { email: email.toLowerCase() },
            relations: ["user", "assessment"],
        });

        console.log(`\n📋 Found ${invitations.length} invitation(s) for ${email}`);

        if (invitations.length === 0) {
            console.log("❌ No invitations found for this email");
            process.exit(1);
        }

        // Update each invitation
        for (const inv of invitations) {
            console.log(`\n🔧 Updating invitation ${inv.id}:`);
            console.log(`   Assessment: ${inv.assessment.title}`);
            console.log(`   Current Status: ${inv.status}`);

            if (inv.status === InvitationStatus.ACCEPTED) {
                console.log(`   ⏭️  Already ACCEPTED, skipping...`);
                continue;
            }

            inv.status = InvitationStatus.ACCEPTED;
            inv.acceptedAt = new Date();

            // If user exists, link it
            if (inv.user) {
                console.log(`   👤 User already linked: ${inv.user.id}`);
            }

            await invitationRepo.save(inv);
            console.log(`   ✅ Updated to ACCEPTED`);
        }

        console.log("\n🎉 All invitations updated successfully!");
        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

// Get email from command line
const email = process.argv[2];

if (!email) {
    console.error("❌ Please provide an email address");
    console.log("Usage: npm run ts-node src/scripts/fix-invitation.ts <email>");
    process.exit(1);
}

console.log(`🔍 Fixing invitations for: ${email}`);
fixInvitation(email);
