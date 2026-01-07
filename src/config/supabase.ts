import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'question-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Supabase credentials not found in environment variables');
}

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('✅ [Supabase] Client initialized');
console.log(`   🔗 URL: ${SUPABASE_URL}`);
console.log(`   📦 Default Bucket: ${BUCKET_NAME}`);
