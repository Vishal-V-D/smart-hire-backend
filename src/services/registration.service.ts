import { AppDataSource } from "../config/db";
import { ContestantProfile } from "../entities/ContestantProfile.entity";
import { User, UserRole } from "../entities/user.entity";
import { Assessment } from "../entities/Assessment.entity";
import { createClient } from "@supabase/supabase-js";
import { signAccessToken } from "../utils/jwt.util";

const profileRepo = () => AppDataSource.getRepository(ContestantProfile);
const userRepo = () => AppDataSource.getRepository(User);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);

// Helper to generate token
const generateToken = (user: User) => {
    const payload = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
    };
    return signAccessToken(payload);
};

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || ""
);

const BUCKET_NAME = process.env.SUPABASE_BUCKET || "securehire-files";

/**
 * Submit registration form and create/update user
 */
export const submitRegistration = async (data: {
    email: string;
    fullName: string;
    college?: string;
    department?: string;
    registrationNumber?: string;
    cgpa?: number;
    resumeUrl?: string;
    idCardUrl?: string;
    assessmentId: string;
}): Promise<{ user: User; profile: ContestantProfile; token: string }> => {
    console.log(`\n📝 [REGISTRATION] Processing registration for ${data.email}...`);

    // Check if assessment exists
    const assessment = await assessmentRepo().findOne({ where: { id: data.assessmentId } });
    if (!assessment) {
        throw { status: 404, message: "Assessment not found" };
    }

    // Find or create user
    let user = await userRepo().findOne({ where: { email: data.email.toLowerCase() } });

    if (!user) {
        console.log(`   Creating new user...`);

        user = userRepo().create({
            email: data.email.toLowerCase(),
            username: data.fullName, // ✅ Use name as-is
            role: UserRole.CONTESTANT,
            isVerified: true, // Auto-verify since OTP passed
            // No password needed for OTP-based access
        });
        await userRepo().save(user);
        console.log(`   ✅ User created: ${user.id}`);
    } else {
        console.log(`   ✅ User found: ${user.id}`);
    }

    // Check if profile already exists for this user + assessment
    let profile = await profileRepo().findOne({
        where: {
            user: { id: user.id },
            assessment: { id: data.assessmentId },
        },
    });

    if (profile) {
        // Update existing profile
        console.log(`   Updating existing profile...`);
        profile.fullName = data.fullName;
        profile.college = data.college || profile.college;
        profile.department = data.department || profile.department;
        profile.registrationNumber = data.registrationNumber || profile.registrationNumber;
        profile.cgpa = data.cgpa !== undefined ? data.cgpa : profile.cgpa;
        profile.resumeUrl = data.resumeUrl || profile.resumeUrl;
        profile.idCardUrl = data.idCardUrl || profile.idCardUrl;
    } else {
        // Create new profile
        console.log(`   Creating new profile...`);
        profile = profileRepo().create({
            user,
            assessment,
            fullName: data.fullName,
            email: data.email.toLowerCase(),
            college: data.college,
            department: data.department,
            registrationNumber: data.registrationNumber,
            cgpa: data.cgpa,
            resumeUrl: data.resumeUrl,
            idCardUrl: data.idCardUrl,
        });
    }

    await profileRepo().save(profile);
    console.log(`   ✅ Profile saved: ${profile.id}`);

    // Generate JWT Token
    const token = generateToken(user);

    return { user, profile, token };
};

/**
 * Upload file to Supabase
 */
export const uploadFile = async (
    file: Buffer,
    filename: string,
    type: "resume" | "id-card"
): Promise<string> => {
    console.log(`\n📤 [FILE_UPLOAD] Uploading ${type}: ${filename}...`);

    const folder = type === "resume" ? "resumes" : "id-cards";
    const path = `${folder}/${Date.now()}-${filename}`;

    // Determine content type
    let contentType = "application/octet-stream";
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === "pdf") contentType = "application/pdf";
    else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "png") contentType = "image/png";

    let { data, error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
        contentType,
        upsert: false,
    });

    // Check if error is "Bucket not found" and try to create it
    if (error && (error as any).statusCode === '404') {
        console.log(`   ⚠️ Bucket '${BUCKET_NAME}' not found. Attempting to create it...`);
        const { data: bucket, error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: 10485760, // 10MB limit
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
        });

        if (bucketError) {
            console.error(`   ❌ Failed to create bucket:`, bucketError);
            throw new Error(`Upload failed and could not create bucket: ${bucketError.message}`);
        }

        console.log(`   ✅ Bucket '${BUCKET_NAME}' created successfully. Retrying upload...`);

        // Retry upload
        const retry = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
            contentType,
            upsert: false,
        });

        data = retry.data;
        error = retry.error;
    }

    if (error) {
        console.error(`   ❌ Upload failed:`, error);
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const {
        data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

    console.log(`   ✅ File uploaded: ${publicUrl}`);

    return publicUrl;
};
