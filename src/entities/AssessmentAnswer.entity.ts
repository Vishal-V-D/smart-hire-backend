import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    Index,
} from "typeorm";
import { AssessmentSubmission } from "./AssessmentSubmission.entity";
import { AssessmentSection } from "./AssessmentSection.entity";
import { Question } from "./Question.entity";
import { Problem } from "./problem.entity";
import { ColumnNumericTransformer } from "./AssessmentSubmission.entity";

export enum AnswerStatus {
    UNATTEMPTED = "unattempted",
    ATTEMPTED = "attempted",
    MARKED_FOR_REVIEW = "marked_for_review",
    EVALUATED = "evaluated",
}

/**
 * Stores coding execution results
 */
export interface CodingResult {
    language: string;
    code: string;
    passedTests: number;
    totalTests: number;
    executionTime?: string;
    memoryUsed?: number;
    status: string; // "accepted", "wrong_answer", "tle", etc.
    score: number;
    maxScore: number;
    sampleResults?: any[];
    hiddenSummary?: {
        total: number;
        passed: number;
        failed: number;
    };
    plagiarism?: {
        similarity: number;
        aiScore: number;
        verdict: string;
        matches: any[];
        reportUrl: string;
    };
}

@Entity("assessment_answers")
@Index(["submission", "questionId"], { unique: true, where: "\"questionId\" IS NOT NULL" })
@Index(["submission", "problemId"], { unique: true, where: "\"problemId\" IS NOT NULL" })
export class AssessmentAnswer {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Parent submission
    @ManyToOne(() => AssessmentSubmission, { onDelete: "CASCADE" })
    @JoinColumn()
    submission: AssessmentSubmission;

    @Column()
    submissionId: string;

    // Section this answer belongs to
    @ManyToOne(() => AssessmentSection, { onDelete: "CASCADE" })
    @JoinColumn()
    section: AssessmentSection;

    @Column()
    sectionId: string;

    // MCQ Question (nullable - either question OR problem)
    @ManyToOne(() => Question, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    question: Question | null;

    @Column({ nullable: true })
    questionId: string;

    // Coding Problem (nullable - either question OR problem)
    @ManyToOne(() => Problem, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    problem: Problem | null;

    @Column({ nullable: true })
    problemId: string;

    @Column({
        type: "enum",
        enum: AnswerStatus,
        default: AnswerStatus.UNATTEMPTED,
    })
    status: AnswerStatus;

    // For MCQ: Store selected option(s)
    // For single choice: "A" or "B" or index as string
    // For multiple choice: ["A", "C"] - array of selected options
    // For fill-in-the-blank: The typed answer
    @Column({ type: "jsonb", nullable: true })
    selectedAnswer: string | string[] | null;

    // For Coding: Store the code and language
    @Column({ type: "text", nullable: true })
    code: string;

    @Column({ nullable: true })
    language: string;

    // Marks for this question
    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true, default: null, transformer: new ColumnNumericTransformer() })
    marksObtained: number | null;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    maxMarks: number;

    // Was answer correct?
    @Column({ nullable: true })
    isCorrect: boolean;

    // For coding problems - execution results
    @Column({ type: "jsonb", nullable: true })
    codingResult: CodingResult | null;

    // For analytics - time spent on this question (seconds)
    @Column({ type: "int", default: 0 })
    timeSpent: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
