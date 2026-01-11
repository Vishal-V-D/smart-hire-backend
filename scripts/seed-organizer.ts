
import { AppDataSource } from "../src/config/db";
import { User, UserRole } from "../src/entities/user.entity";
import { hashPassword } from "../src/utils/password.util";

const seedOrganizer = async () => {
    try {
        console.log("Connecting to database...");
        await AppDataSource.initialize();
        console.log("Connected.");

        const email = "super.admin@gmail.com";
        const password = "Admin@&123#";
        const organizationName = "Smart Hire";
        const fullName = "Super Admin";

        const userRepo = AppDataSource.getRepository(User);

        let user = await userRepo.findOne({ where: { email } });

        if (user) {
            console.log("User already exists. Updating...");
            user.role = UserRole.ORGANIZER;
            user.organizationName = organizationName;
            user.fullName = fullName;
            user.password = await hashPassword(password);
            user.isVerified = true;
        } else {
            console.log("Creating new Organizer...");
            user = userRepo.create({
                email,
                username: "superadmin", // fallback username
                fullName,
                password: await hashPassword(password),
                role: UserRole.ORGANIZER,
                organizationName,
                isVerified: true
            });
        }

        await userRepo.save(user);

        console.log("✅ Organizer seeded successfully!");
        console.log("--------------------------------");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`Organization: ${organizationName}`);
        console.log("--------------------------------");

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedOrganizer();
