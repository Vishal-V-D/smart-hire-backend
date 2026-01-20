import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from "typeorm";
import { AssessmentSection } from "./AssessmentSection.entity";

export enum SqlDialect {
    MYSQL = "mysql",
    POSTGRESQL = "postgresql",
}

export enum SqlQuestionDifficulty {
    EASY = "Easy",
    MEDIUM = "Medium",
    HARD = "Hard",
}

@Entity("sql_questions")
export class SqlQuestion {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Parent section (nullable for standalone question bank)
    @ManyToOne(() => AssessmentSection, (section) => section.sqlQuestions, {
        onDelete: "CASCADE",
        nullable: true,
    })
    section: AssessmentSection | null;

    @Column({ type: "text" })
    title: string;

    @Column({ type: "text" })
    description: string;

    // SQL dialect (MySQL or PostgreSQL)
    @Column({
        type: "enum",
        enum: SqlDialect,
        default: SqlDialect.MYSQL,
    })
    dialect: SqlDialect;

    // Database schema setup (CREATE TABLE statements, etc.)
    @Column({ type: "text" })
    schemaSetup: string;

    // Sample data insertion (INSERT statements)
    @Column({ type: "text", nullable: true })
    sampleData: string;

    // Expected SQL query solution
    @Column({ type: "text" })
    expectedQuery: string;

    // Expected result set (JSON format)
    @Column({ type: "jsonb" })
    expectedResult: any;

    // Starter code for the student (optional)
    @Column({ type: "text", nullable: true })
    starterCode: string;

    // Explanation for the solution
    @Column({ type: "text", nullable: true })
    explanation: string;

    // Marks (optional, defaults to section's marksPerQuestion)
    @Column({ type: "int", nullable: true })
    marks: number;

    // Order for sorting questions
    @Column({ type: "int", default: 0 })
    order: number;

    // Tags for filtering (e.g., ['joins', 'aggregation', 'subqueries'])
    @Column({ type: "text", array: true, nullable: true })
    tags: string[];

    // Topic for categorization (e.g., 'Joins', 'Aggregation', 'Window Functions')
    @Column({ type: "varchar", length: 100, nullable: true })
    topic: string;

    // Subdivision for sub-category (e.g., 'Basic Queries', 'Advanced Queries', 'Optimization')
    @Column({ type: "varchar", length: 100, nullable: true })
    subdivision: string;

    // Division for main category
    @Column({ type: "varchar", length: 100, nullable: true })
    division: string;

    // Per-question difficulty override
    @Column({
        type: "enum",
        enum: SqlQuestionDifficulty,
        nullable: true,
    })
    difficulty: SqlQuestionDifficulty;

    // Input tables structure (JSON)
    @Column({ type: "jsonb", nullable: true })
    inputTables: any;

    // Hint for the student
    @Column({ type: "text", nullable: true })
    hint: string;

    // Time limit in seconds (optional)
    @Column({ type: "int", nullable: true })
    timeLimit: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
