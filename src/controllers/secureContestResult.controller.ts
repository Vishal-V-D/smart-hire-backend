import { Request, Response, NextFunction } from "express";
import * as resultService from "../services/secureContestResult.service";

/**
 * Get Secure Contest Result
 */
export const getSecureResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await resultService.getResult(id);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Update Secure Contest Result
 */
export const updateSecureResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await resultService.updateResult(id, req.body);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Delete Secure Contest Result
 */
export const deleteSecureResult = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await resultService.deleteResult(id);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
