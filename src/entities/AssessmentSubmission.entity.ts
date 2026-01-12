import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Assessment } from "./Assessment.entity";
import { AssessmentSession } from "./AssessmentSession.entity";

export class ColumnNumericTransformer {
    to(data: number): number {
        return data;
    }
    from(data: string): number {
        return parseFloat(data);
    }
}

export enum SubmissionStatus {
    IN_PROGRESS = "in_progress",
    SUBMITTED = "submitted",
    EVALUATED = "evaluated",
    EXPIRED = "expired",
}

/**
 * Section-wise score breakdown
 */
export interface SectionScore {
    sectionId: string;
    sectionTitle: string;
    sectionType: string;
    totalMarks: number;
    obtainedMarks: number;
    correctAnswers: number;
    wrongAnswers: number;
    unattempted: number;
    totalQuestions: number;
    percentage: number;
    negativeMarks: number; // Marks deducted
    timeTaken: number; // in seconds
}

/**
 * Detailed analytics for the submission
 */
export interface SubmissionAnalytics {
    totalQuestions: number;
    attemptedQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    unattempted: number;
    totalMarks: number;
    obtainedMarks: number;
    negativeMarks: number;
    percentage: number;
    timeTaken: number; // in seconds
    sectionScores: SectionScore[];
    // Coding specific
    codingProblems?: {
        total: number;
        attempted: number;
        fullySolved: number;
        partiallySolved: number;
        totalScore: number;
        maxScore: number;
    };
    verdict?: {
        status: string; // "passed", "failed", "disqualified", "pending"
        finalScore: number;
        adjustedScore: number;
        violationPenalty: number;
        notes: string | null;
        evaluatedBy: string | null;
        evaluatedAt: Date | null;
    };
}

@Entity("assessment_submissions")
export class AssessmentSubmission {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // User who submitted
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn()
    user: User;

    @Column()
    userId: string;

    // Assessment being submitted
    @ManyToOne(() => Assessment, { onDelete: "CASCADE" })
    @JoinColumn()
    assessment: Assessment;

    @Column()
    assessmentId: string;

    // Session this submission belongs to
    @ManyToOne(() => AssessmentSession, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    session: AssessmentSession | null;

    @Column({ nullable: true })
    sessionId: string;

    @Column({
        type: "enum",
        enum: SubmissionStatus,
        default: SubmissionStatus.IN_PROGRESS,
    })
    status: SubmissionStatus;

    // Timestamps
    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @Column({ type: "timestamp", nullable: true })
    submittedAt: Date;

    // Scores
    @Column({ type: "decimal", precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    totalScore: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    maxScore: number;

    @Column({ type: "decimal", precision: 5, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    percentage: number;

    // For Section-Timed Assessments
    @Column({ type: "varchar", nullable: true })
    currentSectionId: string | null;

    @Column({ type: "timestamp", nullable: true })
    sectionStartedAt: Date | null;

    // Was this an auto-submit (time expired)?
    @Column({ default: false })
    isAutoSubmitted: boolean;

    // Detailed analytics stored as JSON
    @Column({ type: "jsonb", nullable: true })
    analytics: SubmissionAnalytics;

    // Section-wise scores quick reference
    @Column({ type: "jsonb", nullable: true })
    sectionScores: SectionScore[];

    // Track accumulated time per section (in seconds)
    // Maps sectionId -> accumulatedSeconds
    @Column({ type: "jsonb", nullable: true, default: {} })
    sectionUsage: Record<string, number>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
