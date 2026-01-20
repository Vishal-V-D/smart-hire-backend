import { Request, Response } from "express";
import * as questionUploadService from "../services/questionUpload.service";

// Upload questions via CSV
export const uploadQuestionsCSV = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        // Get categorization from request body (sent from frontend)
        const { division, subdivision, topic } = req.body;

        console.log(`\n📤 [UPLOAD_CSV] Processing file: ${req.file.originalname}`);
        console.log(`   Size: ${(req.file.size / 1024).toFixed(2)} KB`);
        console.log(`   Division (Main Type): ${division || "Not specified"}`);
        console.log(`   Subdivision (Subtype): ${subdivision || "Not specified"}`);
        console.log(`   Topic: ${topic || "Not specified"}`);

        const summary = await questionUploadService.uploadCSV(
            req.file.buffer,
            division,
            subdivision,
            topic
        );

        res.status(200).json({
            success: true,
            message: "CSV upload completed",
            summary,
        });
    } catch (error: any) {
        console.error("❌ [UPLOAD_CSV] Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to upload CSV",
        });
    }
};

// Upload questions via ZIP (with images)
export const uploadQuestionsZIP = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        // Get categorization from request body
        const { division, subdivision, topic } = req.body;

        console.log(`\n📤 [UPLOAD_ZIP] Processing file: ${req.file.originalname}`);
        console.log(`   Size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Division (Main Type): ${division || "Not specified"}`);
        console.log(`   Subdivision (Subtype): ${subdivision || "Not specified"}`);
        console.log(`   Topic: ${topic || "Not specified"}`);

        const summary = await questionUploadService.uploadZIP(
            req.file.buffer,
            division,
            subdivision,
            topic
        );

        res.status(200).json({
            success: true,
            message: "ZIP upload completed",
            summary,
        });
    } catch (error: any) {
        console.error("❌ [UPLOAD_ZIP] Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to upload ZIP",
        });
    }
};
// Upload questions via Excel
export const uploadQuestionsExcel = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        const { division, subdivision, topic } = req.body;

        console.log(`\n📤 [UPLOAD_EXCEL] Processing file: ${req.file.originalname}`);
        console.log(`   Size: ${(req.file.size / 1024).toFixed(2)} KB`);
        console.log(`   Division (Main Type): ${division || "Not specified"}`);
        console.log(`   Subdivision (Subtype): ${subdivision || "Not specified"}`);
        console.log(`   Topic: ${topic || "Not specified"}`);

        const summary = await questionUploadService.uploadExcel(
            req.file.buffer,
            division,
            subdivision,
            topic
        );

        res.status(200).json({
            success: true,
            message: "Excel upload completed",
            summary,
        });
    } catch (error: any) {
        console.error("❌ [UPLOAD_EXCEL] Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to upload Excel",
        });
    }
};
