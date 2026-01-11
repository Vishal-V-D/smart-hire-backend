
import { Response } from "express";

export const handleError = (res: Response, error: any) => {
    console.error("❌ Error:", error);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ message });
};
