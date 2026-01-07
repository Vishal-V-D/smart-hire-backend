import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddProctoringSettings1733569800000 implements MigrationInterface {
    name = 'AddProctoringSettings1733569800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add proctoring configuration columns to contests table
        await queryRunner.addColumn("contests", new TableColumn({
            name: "enableVideoProctoring",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "enableAudioMonitoring",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "enableCopyPasteDetection",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "enableTabSwitchDetection",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "enableScreenshotCapture",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "enableFaceRecognition",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "requireCameraAccess",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "requireMicrophoneAccess",
            type: "boolean",
            default: false,
        }));

        await queryRunner.addColumn("contests", new TableColumn({
            name: "screenshotIntervalSeconds",
            type: "int",
            isNullable: true,
        }));

        // Update existing invite-only contests to have FULL proctoring enabled
        await queryRunner.query(`
            UPDATE contests 
            SET 
                "enableVideoProctoring" = true,
                "enableAudioMonitoring" = true,
                "enableCopyPasteDetection" = true,
                "enableTabSwitchDetection" = true,
                "enableScreenshotCapture" = true,
                "enableFaceRecognition" = true,
                "requireCameraAccess" = true,
                "requireMicrophoneAccess" = true,
                "screenshotIntervalSeconds" = 60
            WHERE "isInviteOnly" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove proctoring configuration columns
        await queryRunner.dropColumn("contests", "screenshotIntervalSeconds");
        await queryRunner.dropColumn("contests", "requireMicrophoneAccess");
        await queryRunner.dropColumn("contests", "requireCameraAccess");
        await queryRunner.dropColumn("contests", "enableFaceRecognition");
        await queryRunner.dropColumn("contests", "enableScreenshotCapture");
        await queryRunner.dropColumn("contests", "enableTabSwitchDetection");
        await queryRunner.dropColumn("contests", "enableCopyPasteDetection");
        await queryRunner.dropColumn("contests", "enableAudioMonitoring");
        await queryRunner.dropColumn("contests", "enableVideoProctoring");
    }
}
