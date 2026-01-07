import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateAdminAssessmentAccessTable1704816000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create admin_assessment_access table
    await queryRunner.createTable(
      new Table({
        name: "admin_assessment_access",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
          },
          {
            name: "adminUserId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "organizerId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "assessmentId",
            type: "uuid",
            isNullable: true,
          },
          {
            name: "accessType",
            type: "enum",
            enum: ["WHOLE", "PARTIAL"],
            default: "'PARTIAL'",
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "now()",
          },
        ],
        foreignKeys: [
          {
            columnNames: ["adminUserId"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "CASCADE",
          },
          {
            columnNames: ["organizerId"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "CASCADE",
          },
          {
            columnNames: ["assessmentId"],
            referencedColumnNames: ["id"],
            referencedTableName: "assessments",
            onDelete: "CASCADE",
          },
        ],
        uniques: [
          {
            columnNames: ["adminUserId", "assessmentId"],
            name: "UQ_admin_assessment",
          },
        ],
      }),
      true
    );

    // Create indices
    await queryRunner.createIndex(
      "admin_assessment_access",
      new TableIndex({
        columnNames: ["adminUserId", "organizerId"],
        name: "IDX_admin_organizer_access",
      })
    );

    await queryRunner.createIndex(
      "admin_assessment_access",
      new TableIndex({
        columnNames: ["assessmentId"],
        name: "IDX_assessment_admin_access",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("admin_assessment_access", true);
  }
}
