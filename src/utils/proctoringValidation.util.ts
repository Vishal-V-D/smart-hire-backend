export interface ProctoringSettings {
    enableVideoProctoring?: boolean;
    enableAudioMonitoring?: boolean;
    enableCopyPasteDetection?: boolean;
    enableTabSwitchDetection?: boolean;
    enableScreenshotCapture?: boolean;
    enableFaceRecognition?: boolean;
    requireCameraAccess?: boolean;
    requireMicrophoneAccess?: boolean;
    enableFullscreenMode?: boolean;
    screenshotIntervalSeconds?: number;
}

/**
 * Validates proctoring settings for logical consistency
 * @param settings - The proctoring settings to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateProctoringSettings(settings: ProctoringSettings): string[] {
    const errors: string[] = [];

    // Face recognition requires camera access
    if (settings.enableFaceRecognition && !settings.requireCameraAccess) {
        errors.push("Face recognition requires camera access to be enabled");
    }

    // Video proctoring requires camera access
    if (settings.enableVideoProctoring && !settings.requireCameraAccess) {
        errors.push("Video proctoring requires camera access to be enabled");
    }

    // Audio monitoring requires microphone access
    if (settings.enableAudioMonitoring && !settings.requireMicrophoneAccess) {
        errors.push("Audio monitoring requires microphone access to be enabled");
    }

    // Screenshot interval validation
    if (settings.screenshotIntervalSeconds !== undefined && settings.screenshotIntervalSeconds !== null) {
        if (settings.screenshotIntervalSeconds <= 0) {
            errors.push("Screenshot interval must be a positive number");
        }
        if (settings.screenshotIntervalSeconds < 10) {
            errors.push("Screenshot interval must be at least 10 seconds to avoid performance issues");
        }
        if (!settings.enableScreenshotCapture) {
            errors.push("Screenshot interval requires screenshot capture to be enabled");
        }
    }

    return errors;
}

/**
 * Get default proctoring settings for invite-only contests
 */
export function getDefaultProctoringSettings(): ProctoringSettings {
    return {
        enableVideoProctoring: true,
        enableAudioMonitoring: true,
        enableCopyPasteDetection: true,
        enableTabSwitchDetection: true,
        enableScreenshotCapture: true,
        enableFaceRecognition: true,
        requireCameraAccess: true,
        requireMicrophoneAccess: true,
        enableFullscreenMode: true,
        screenshotIntervalSeconds: 60,
    };
}

/**
 * Get proctoring settings with all features disabled
 */
export function getNoProctoringSettings(): ProctoringSettings {
    return {
        enableVideoProctoring: false,
        enableAudioMonitoring: false,
        enableCopyPasteDetection: false,
        enableTabSwitchDetection: false,
        enableScreenshotCapture: false,
        enableFaceRecognition: false,
        requireCameraAccess: false,
        requireMicrophoneAccess: false,
        enableFullscreenMode: false,
        screenshotIntervalSeconds: undefined,
    };
}
