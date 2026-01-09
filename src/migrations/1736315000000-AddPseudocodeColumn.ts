import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPseudocodeColumn1736315000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add pseudocode column to questions table
        await queryRunner.addColumn("questions", new TableColumn({
            name: "pseudocode",
            type: "text",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove pseudocode column from questions table
        await queryRunner.dropColumn("questions", "pseudocode");
    }

}
