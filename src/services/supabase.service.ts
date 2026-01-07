import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'problem-images';

let supabase: SupabaseClient;

// Initialize Supabase client with SERVICE ROLE key to bypass RLS
export const initSupabase = () => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('⚠️ [Supabase] URL or SERVICE_ROLE_KEY not configured. Image upload will be disabled.');
        return null;
    }

    // Use service role key to bypass Row Level Security for server-side operations
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        console.log('✅ [Supabase] Client initialized successfully');
        console.log(`   🔗 URL: ${SUPABASE_URL}`);
        console.log(`   📦 Default Bucket: ${SUPABASE_BUCKET}`);
    } catch (err) {
        console.error('❌ [Supabase] Client initialization failed:', err);
        return null;
    }
    return supabase;
};

/**
 * Upload image to Supabase Storage
 * @param file - Multer file object
 * @param problemId - Problem ID for unique filename
 * @returns Public URL of uploaded image
 */
export const uploadProblemImage = async (
    file: Express.Multer.File,
    problemId: string
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    // Generate unique filename
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${problemId}-${Date.now()}.${fileExt}`;
    const filePath = `problems/${fileName}`;

    console.log(`📤 [Supabase] Uploading image: ${filePath}`);

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Upload error:', error);
        throw new Error(`Image upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Image uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Upload example image to Supabase Storage
 * @param file - Multer file object
 * @param problemId - Problem ID for unique filename
 * @param exampleIndex - Index of the example (0-based)
 * @returns Public URL of uploaded image
 */
export const uploadExampleImage = async (
    file: Express.Multer.File,
    problemId: string,
    exampleIndex: number
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    // Generate unique filename for example image
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${problemId}-example-${exampleIndex}-${Date.now()}.${fileExt}`;
    const filePath = `problems/examples/${fileName}`;

    console.log(`📤 [Supabase] Uploading example image: ${filePath}`);

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Upload error:', error);
        throw new Error(`Example image upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Example image uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Delete image from Supabase Storage
 * @param imageUrl - Full public URL of the image
 */
export const deleteProblemImage = async (imageUrl: string): Promise<void> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase || !imageUrl) return;

    try {
        // Extract file path from URL
        const urlParts = imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `problems/${fileName}`;

        console.log(`🗑️ [Supabase] Deleting image: ${filePath}`);

        const { error } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .remove([filePath]);

        if (error) {
            console.error('🚨 [Supabase] Delete error:', error);
        } else {
            console.log(`✅ [Supabase] Image deleted: ${filePath}`);
        }
    } catch (err: any) {
        console.error('🚨 [Supabase] Delete failed:', err.message);
    }
};

/**
 * Test Supabase connection and bucket access
 * Call this on server startup to verify configuration
 */
export const testSupabaseConnection = async (): Promise<boolean> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        console.error('❌ [Supabase] Not configured - image uploads will be disabled');
        console.log('   💡 Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file');
        return false;
    }

    try {
        // Test bucket access by listing files (limit 1 to minimize overhead)
        const { data, error } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .list('', { limit: 1 });

        if (error) {
            console.error(`❌ [Supabase] Bucket "${SUPABASE_BUCKET}" access failed:`, error.message);
            console.log('   💡 Check if the bucket exists in your Supabase Storage dashboard');
            return false;
        }

        console.log(`✅ [Supabase] Connected successfully`);
        console.log(`   📦 Bucket: "${SUPABASE_BUCKET}"`);
        console.log(`   🔗 URL: ${SUPABASE_URL}`);
        console.log(`   🔑 Using: service_role key (RLS bypassed)`);
        return true;
    } catch (err: any) {
        console.error('❌ [Supabase] Connection test failed:', err.message);
        return false;
    }
};




/**
 * Upload contest registration photo to Supabase Storage
 * @param file - Multer file object
 * @param userId - User ID
 * @param contestId - Contest ID
 * @returns Public URL of uploaded photo
 */
export const uploadContestRegistrationPhoto = async (
    file: Express.Multer.File,
    userId: string,
    contestId: string
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${contestId}-${userId}-${Date.now()}.${fileExt}`;
    const filePath = `contest-photos/${fileName}`;

    console.log(`📤 [Supabase] Uploading contest registration photo: ${filePath}`);

    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Upload error:', error);
        throw new Error(`Contest photo upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Contest registration photo uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Upload monitoring photo to Supabase Storage
 * @param file - Multer file object
 * @param userId - User ID
 * @param contestId - Contest ID
 * @param timestamp - Timestamp of capture
 * @returns Public URL of uploaded photo
 */
export const uploadMonitoringPhoto = async (
    file: Express.Multer.File,
    userId: string,
    contestId: string,
    timestamp: number
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${contestId}-${userId}-${timestamp}.${fileExt}`;
    const filePath = `monitoring-photos/${fileName}`;

    console.log(`📤 [Supabase] Uploading monitoring photo: ${filePath}`);

    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Upload error:', error);
        throw new Error(`Monitoring photo upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Monitoring photo uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Upload report PDF to Supabase Storage
 * @param pdfBuffer - PDF file buffer
 * @param contestId - Contest ID
 * @param userId - User ID
 * @returns Public URL of uploaded PDF
 */
export const uploadReportPDF = async (
    pdfBuffer: Buffer,
    contestId: string,
    userId: string
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    const fileName = `${contestId}-${userId}-${Date.now()}.pdf`;
    const filePath = `report-pdfs/${fileName}`;

    console.log(`📤 [Supabase] Uploading report PDF: ${filePath}`);

    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Upload error:', error);
        throw new Error(`Report PDF upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Report PDF uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Upload base64 encoded photo to Supabase Storage
 * @param base64Data - Base64 encoded image data (with or without data URI prefix)
 * @param userId - User ID
 * @param contestId - Contest ID
 * @param type - Type of photo (e.g., 'registration-photo', 'monitoring-photo')
 * @returns Public URL of uploaded photo
 */
export const uploadBase64Photo = async (
    base64Data: string,
    userId: string,
    contestId: string,
    type: string
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    console.log(`📸 [Supabase] Processing base64 photo upload for ${type}...`);

    // Remove data URI prefix if present (e.g., "data:image/png;base64,")
    let base64String = base64Data;
    let mimeType = 'image/jpeg'; // default

    if (base64Data.includes('base64,')) {
        const parts = base64Data.split('base64,');
        base64String = parts[1];

        // Extract MIME type from data URI
        const mimeMatch = parts[0].match(/data:([^;]+);/);
        if (mimeMatch) {
            mimeType = mimeMatch[1];
        }
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');

    // Determine file extension from MIME type
    const ext = mimeType.split('/')[1] || 'jpg';
    const fileName = `${contestId}-${userId}-${Date.now()}.${ext}`;
    const filePath = `contest-${type}/${fileName}`;

    console.log(`📤 [Supabase] Uploading base64 photo: ${filePath} (${mimeType})`);

    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Base64 photo upload error:', error);
        throw new Error(`Photo upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Base64 photo uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Upload base64 encoded PDF to Supabase Storage
 * @param base64Data - Base64 encoded PDF data (with or without data URI prefix)
 * @param userId - User ID
 * @param contestId - Contest ID
 * @param type - Type of PDF (e.g., 'resume')
 * @returns Public URL of uploaded PDF
 */
export const uploadBase64PDF = async (
    base64Data: string,
    userId: string,
    contestId: string,
    type: string
): Promise<string> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    console.log(`📄 [Supabase] Processing base64 PDF upload for ${type}...`);

    // Remove data URI prefix if present
    let base64String = base64Data;
    if (base64Data.includes('base64,')) {
        base64String = base64Data.split('base64,')[1];
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64String, 'base64');

    const fileName = `${contestId}-${userId}-${type}-${Date.now()}.pdf`;
    const filePath = `contest-${type}/${fileName}`;

    console.log(`📤 [Supabase] Uploading base64 PDF: ${filePath}`);

    const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, buffer, {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (error) {
        console.error('🚨 [Supabase] Base64 PDF upload error:', error);
        throw new Error(`PDF upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filePath);

    console.log(`✅ [Supabase] Base64 PDF uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
};

/**
 * Delete contest photo from Supabase Storage
 * @param photoUrl - Full public URL of the photo
 */
/**
 * Upload user registration photo with optimization
 * @param file - Multer file object
 * @param userId - User ID
 * @returns Object containing URLs for original, optimized, and thumbnail
 */
export const uploadUserPhoto = async (
    file: Express.Multer.File,
    userId: string
): Promise<{ originalUrl: string; optimizedUrl: string; thumbnailUrl: string }> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    console.log(`📸 [Supabase] Processing user photo upload for ${userId}...`);

    const timestamp = Date.now();
    const basePath = `user-photos/${userId}`;

    // 1. Upload Original
    const originalPath = `${basePath}/original-${timestamp}.jpg`;
    const { error: originalError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(originalPath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (originalError) throw new Error(`Original photo upload failed: ${originalError.message}`);

    // 2. Optimize (640x480, WebP, Quality 80)
    const optimizedBuffer = await sharp(file.buffer)
        .resize(640, 480, { fit: 'inside' })
        .webp({ quality: 80 })
        .toBuffer();

    const optimizedPath = `${basePath}/optimized-${timestamp}.webp`;
    const { error: optimizedError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(optimizedPath, optimizedBuffer, {
            contentType: 'image/webp',
            upsert: true,
        });

    if (optimizedError) throw new Error(`Optimized photo upload failed: ${optimizedError.message}`);

    // 3. Thumbnail (160x120, WebP, Quality 70)
    const thumbnailBuffer = await sharp(file.buffer)
        .resize(160, 120, { fit: 'cover' })
        .webp({ quality: 70 })
        .toBuffer();

    const thumbnailPath = `${basePath}/thumbnail-${timestamp}.webp`;
    const { error: thumbnailError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(thumbnailPath, thumbnailBuffer, {
            contentType: 'image/webp',
            upsert: true,
        });

    if (thumbnailError) throw new Error(`Thumbnail upload failed: ${thumbnailError.message}`);

    // Get Public URLs
    const getUrl = (path: string) => supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl;

    return {
        originalUrl: getUrl(originalPath),
        optimizedUrl: getUrl(optimizedPath),
        thumbnailUrl: getUrl(thumbnailPath)
    };
};

/**
 * Get Face API Models URL
 */
export const getFaceModelsUrl = (): string => {
    if (!supabase) {
        supabase = initSupabase()!;
    }
    // Assuming models are in a public bucket named 'face-models' or folder
    // For now, returning a direct URL structure or a configured base URL
    // If using the same bucket:
    // return supabase.storage.from(SUPABASE_BUCKET).getPublicUrl('face-models').data.publicUrl;

    // Or if using a separate bucket (recommended in plan):
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/face-models`;
};

export const deleteContestPhoto = async (photoUrl: string): Promise<void> => {
    if (!supabase) {
        supabase = initSupabase()!;
    }

    if (!supabase || !photoUrl) return;

    try {
        // Extract file path from URL
        const urlParts = photoUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const folder = urlParts[urlParts.length - 2];
        const filePath = `${folder}/${fileName}`;

        console.log(`🗑️ [Supabase] Deleting photo: ${filePath}`);

        const { error } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .remove([filePath]);

        if (error) {
            console.error('🚨 [Supabase] Delete error:', error);
        } else {
            console.log(`✅ [Supabase] Photo deleted: ${filePath}`);
        }
    } catch (err: any) {
        console.error('🚨 [Supabase] Delete failed:', err.message);
    }
};

// Initialize on module load
initSupabase();
