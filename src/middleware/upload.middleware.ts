import multer from 'multer';
import path from 'path';

// Store files in memory for Supabase upload
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed.'), false);
    }
};

// Multer upload configuration
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
});

// Configuration for problem creation with multiple images
export const uploadProblemImages = upload.fields([
    { name: 'image', maxCount: 5 },           // Overall problem image
    { name: 'exampleImages', maxCount: 10 }   // Up to 10 example images
]);

// CSV upload configuration (10MB max)
export const uploadCSV = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('file');

// ZIP upload configuration (50MB max)
export const uploadZIP = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            path.extname(file.originalname).toLowerCase() === '.zip') {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
}).single('file');
