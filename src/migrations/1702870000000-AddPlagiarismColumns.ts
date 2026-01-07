import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPlagiarismColumns1702870000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add plagiarismConfig to contests
        await queryRunner.addColumn("contests", new TableColumn({
            name: "plagiarismConfig",
            type: "jsonb",
            isNullable: true
        }));

        // Add columns to secure_contest_results
        await queryRunner.addColumns("secure_contest_results", [
            new TableColumn({
                name: "aiScore",
                type: "float",
                default: 0
            }),
            new TableColumn({
                name: "isAiGenerated",
                type: "boolean",
                default: false
            })
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("contests", "plagiarismConfig");
        await queryRunner.dropColumn("secure_contest_results", "aiScore");
        await queryRunner.dropColumn("secure_contest_results", "isAiGenerated");
    }

}
