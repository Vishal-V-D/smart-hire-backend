import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "face-models";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const MODELS_BASE_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const MODEL_FILES = [
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
    "face_expression_model-weights_manifest.json",
    "face_expression_model-shard1",
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2"
];

const uploadModels = async () => {
    console.log("🚀 Starting Face API Models Upload...");
    console.log(`🎯 Target Bucket: ${BUCKET_NAME}`);

    // 1. Ensure bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error("❌ Error listing buckets:", listError.message);
        return;
    }

    const bucketExists = buckets.find(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
        console.log(`📦 Bucket '${BUCKET_NAME}' not found. Creating...`);
        const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: true
        });

        if (createError) {
            console.error("❌ Error creating bucket:", createError.message);
            return;
        }
        console.log("✅ Bucket created successfully.");
    } else {
        console.log(`✅ Bucket '${BUCKET_NAME}' exists. Ensuring it is public...`);
        const { error: updateError } = await supabase.storage.updateBucket(BUCKET_NAME, {
            public: true
        });

        if (updateError) {
            console.warn("⚠️ Could not update bucket to public (might already be public or insufficient permissions):", updateError.message);
        } else {
            console.log("✅ Bucket updated to public.");
        }

        // Empty the bucket
        console.log("🧹 Cleaning up existing files...");
        const { data: existingFiles, error: listFilesError } = await supabase.storage.from(BUCKET_NAME).list();

        if (listFilesError) {
            console.error("❌ Error listing files for cleanup:", listFilesError.message);
        } else if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map(f => f.name);
            const { error: deleteError } = await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);

            if (deleteError) {
                console.error("❌ Error deleting existing files:", deleteError.message);
            } else {
                console.log(`🗑️  Deleted ${filesToDelete.length} existing files.`);
            }
        } else {
            console.log("✨ Bucket is already empty.");
        }
    }


// 2. Download and Upload Files
for (const file of MODEL_FILES) {
    try {
        console.log(`⬇️  Downloading ${file}...`);
        const response = await axios.get(`${MODELS_BASE_URL}/${file}`, {
            responseType: "arraybuffer"
        });
        const buffer = Buffer.from(response.data);
        console.log(`   📦 Size: ${(buffer.length / 1024).toFixed(2)} KB`);

        console.log(`⬆️  Uploading ${file} to Supabase...`);
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(file, buffer, {
                contentType: file.endsWith(".json") ? "application/json" : "application/octet-stream",
                upsert: true
            });

        if (uploadError) {
            console.error(`❌ Failed to upload ${file}:`, uploadError.message);
        } else {
            console.log(`✅ Uploaded ${file}`);
        }

    } catch (err: any) {
        console.error(`❌ Error processing ${file}:`, err.message);
    }
}

console.log("\n🎉 All operations completed!");
console.log(`🔗 Models URL Base: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`);
};

uploadModels();
