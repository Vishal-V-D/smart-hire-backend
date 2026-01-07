import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAdminFieldsToUsers1704815000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add fullName column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "fullName",
        type: "varchar",
        length: "255",
        isNullable: true,
      })
    );

    // Add assignedOrganizerId column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "assignedOrganizerId",
        type: "uuid",
        isNullable: true,
      })
    );

    // Add status column with enum
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "status",
        type: "enum",
        enum: ["active", "pending", "disabled"],
        default: "'pending'",
      })
    );

    // Add lastLogin column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "lastLogin",
        type: "timestamp",
        isNullable: true,
      })
    );

    // Add assessmentsViewedCount column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "assessmentsViewedCount",
        type: "int",
        default: 0,
      })
    );

    // Add reportsDownloadedCount column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "reportsDownloadedCount",
        type: "int",
        default: 0,
      })
    );

    // Add resetToken column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "resetToken",
        type: "varchar",
        length: "255",
        isNullable: true,
      })
    );

    // Add resetTokenExpiry column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "resetTokenExpiry",
        type: "timestamp",
        isNullable: true,
      })
    );

    // Add magicLoginToken column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "magicLoginToken",
        type: "varchar",
        length: "255",
        isNullable: true,
      })
    );

    // Add magicLoginTokenExpiry column
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "magicLoginTokenExpiry",
        type: "timestamp",
        isNullable: true,
      })
    );

    // Update UserRole enum to add ADMIN and COMPANY
    await queryRunner.query(`
      ALTER TYPE "users_role_enum" ADD VALUE 'ADMIN' AFTER 'CONTESTANT';
    `);

    await queryRunner.query(`
      ALTER TYPE "users_role_enum" ADD VALUE 'COMPANY' AFTER 'ADMIN';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns
    await queryRunner.dropColumn("users", "magicLoginTokenExpiry");
    await queryRunner.dropColumn("users", "magicLoginToken");
    await queryRunner.dropColumn("users", "resetTokenExpiry");
    await queryRunner.dropColumn("users", "resetToken");
    await queryRunner.dropColumn("users", "reportsDownloadedCount");
    await queryRunner.dropColumn("users", "assessmentsViewedCount");
    await queryRunner.dropColumn("users", "lastLogin");
    await queryRunner.dropColumn("users", "status");
    await queryRunner.dropColumn("users", "assignedOrganizerId");
    await queryRunner.dropColumn("users", "fullName");
  }
}
