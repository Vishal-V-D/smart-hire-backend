/**
 * Manual Test Script for Proctoring Configuration
 * 
 * This script demonstrates how to create contests with different proctoring settings.
 * Run this after starting the server to verify the implementation.
 */

// Test 1: Create a regular contest (no proctoring)
const regularContest = {
    title: "Regular Contest - No Proctoring",
    description: "A regular public contest without any proctoring",
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    endDate: new Date(Date.now() + 25 * 60 * 60 * 1000),   // Tomorrow + 1 hour
    isInviteOnly: false,
    // No proctoringSettings provided - all should default to false
};

// Test 2: Create an invite-only contest (automatic full proctoring)
const inviteOnlyContest = {
    title: "Invite-Only Contest - Auto Proctoring",
    description: "An invite-only contest with automatic full proctoring",
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 25 * 60 * 60 * 1000),
    isInviteOnly: true,
    // No proctoringSettings provided - should get default proctoring settings
};

// Test 3: Create a secure contest with custom proctoring
const secureContestCustom = {
    title: "Secure Contest - Custom Proctoring",
    description: "A secure contest with custom proctoring settings",
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 25 * 60 * 60 * 1000),
    proctoringSettings: {
        enableVideoProctoring: true,
        enableAudioMonitoring: true,  // Custom: enable audio
        enableCopyPasteDetection: true,
        enableTabSwitchDetection: true,
        enableScreenshotCapture: true,
        enableFaceRecognition: false,  // Custom: disable face recognition
        requireCameraAccess: true,
        requireMicrophoneAccess: true,  // Custom: require microphone
        screenshotIntervalSeconds: 30,  // Custom: 30 seconds
    },
};

// Test 4: Invalid proctoring settings (should fail validation)
const invalidContest = {
    title: "Invalid Contest",
    description: "This should fail validation",
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 25 * 60 * 60 * 1000),
    isInviteOnly: false,
    proctoringSettings: {
        enableFaceRecognition: true,
        requireCameraAccess: false,  // Invalid: face recognition requires camera
    },
};

// Test 5: Update contest proctoring settings
const updateProctoringSettings = {
    proctoringSettings: {
        enableVideoProctoring: false,  // Disable video proctoring
        enableScreenshotCapture: false,  // Disable screenshots
    },
};

/**
 * API Endpoints to test:
 * 
 * 1. POST /api/contests
 *    Body: regularContest
 *    Expected: Contest created with all proctoring settings = false
 * 
 * 2. POST /api/contests
 *    Body: inviteOnlyContest
 *    Expected: Contest created with full proctoring enabled
 * 
 * 3. POST /api/contests/secure
 *    Body: secureContestCustom
 *    Expected: Contest created with custom proctoring settings
 * 
 * 4. POST /api/contests
 *    Body: invalidContest
 *    Expected: 400 error - "Face recognition requires camera access to be enabled"
 * 
 * 5. PUT /api/contests/:id
 *    Body: updateProctoringSettings
 *    Expected: Contest updated with modified proctoring settings
 * 
 * 6. GET /api/contests/:id
 *    Expected: Response includes all proctoring settings fields
 */

export {
    regularContest,
    inviteOnlyContest,
    secureContestCustom,
    invalidContest,
    updateProctoringSettings,
};
