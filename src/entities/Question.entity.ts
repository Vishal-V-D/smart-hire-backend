import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from "typeorm";
import { AssessmentSection } from "./AssessmentSection.entity";

export enum QuestionType {
    SINGLE_CHOICE = "single_choice",
    MULTIPLE_CHOICE = "multiple_choice",
    FILL_IN_THE_BLANK = "fill_in_the_blank",
    CODING = "coding",
}

export enum QuestionDifficulty {
    EASY = "Easy",
    MEDIUM = "Medium",
    HARD = "Hard",
}

@Entity("questions")
export class Question {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Parent section (nullable for standalone question bank)
    @ManyToOne(() => AssessmentSection, (section) => section.questions, {
        onDelete: "CASCADE",
        nullable: true,
    })
    section: AssessmentSection | null;

    @Column({ type: "text" })
    text: string;

    // Optional image URL
    @Column({ type: "varchar", length: 500, nullable: true })
    image: string;

    @Column({
        type: "enum",
        enum: QuestionType,
        default: QuestionType.SINGLE_CHOICE,
    })
    type: QuestionType;

    // Options for choice types (2-6 options)
    @Column({ type: "text", array: true, nullable: true })
    options: string[];

    // Correct answer - single string or JSON for multiple answers
    @Column({ type: "jsonb", nullable: true })
    correctAnswer: string | string[];

    // Explanation for the correct answer
    @Column({ type: "text", nullable: true })
    explanation: string;

    // Code stub for coding questions
    @Column({ type: "text", nullable: true })
    codeStub: string;

    // Marks (optional, defaults to section's marksPerQuestion)
    @Column({ type: "int", nullable: true })
    marks: number;

    // Order for sorting questions
    @Column({ type: "int", default: 0 })
    order: number;

    // Tags for filtering (e.g., ['closures', 'async', 'promises'])
    @Column({ type: "text", array: true, nullable: true })
    tags: string[];

    // Topic for categorization (e.g., 'JavaScript', 'Data Structures')
    @Column({ type: "varchar", length: 100, nullable: true })
    topic: string;

    // Division for main category (e.g., 'Aptitude', 'Technical', 'Reasoning')
    @Column({ type: "varchar", length: 100, nullable: true })
    division: string;

    // Subdivision for sub-category (e.g., 'Quantitative', 'Logical', 'Verbal', 'OOP', 'DSA')
    @Column({ type: "varchar", length: 100, nullable: true })
    subdivision: string;

    // Per-question difficulty override
    @Column({
        type: "enum",
        enum: QuestionDifficulty,
        nullable: true,
    })
    difficulty: QuestionDifficulty;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
