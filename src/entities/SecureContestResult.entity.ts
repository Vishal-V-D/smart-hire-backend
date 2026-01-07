import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from "typeorm";
import { Contest } from "./contest.entity";
import { User } from "./user.entity";

@Entity("secure_contest_results")
export class SecureContestResult {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column({ type: "float", default: 0 })
    totalBaseScore: number;

    @Column({ type: "float", default: 0 })
    violationPenalty: number;

    @Column({ type: "float", default: 0 })
    suggestedPenalty: number;

    @Column({ type: "float", default: 0 })
    finalScore: number;

    @Column({ type: "float", default: 0 })
    plagiarismScore: number;

    @Column({ type: "float", default: 0 })
    suspiciousScore: number;

    // 🤖 AI Detection Results
    @Column({ type: "float", default: 0 })
    aiScore: number;

    @Column({ default: false })
    isAiGenerated: boolean;

    @Column({ default: false })
    isDistinct: boolean;

    @Column({ default: false })
    isSuspicious: boolean;

    @Column({ type: "int", nullable: true })
    durationSeconds: number;

    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @Column({ type: "timestamp", nullable: true })
    finishedAt: Date;

    @Column({ type: "jsonb", nullable: true })
    resultDetails: any; // Stores problem-wise breakdown, violation/plagiarism details

    @Column({ type: "jsonb", nullable: true })
    registrationDetails: any; // Name, Email, RollNo, etc.

    @Column({ type: "int", default: 0 })
    totalProblems: number;

    @Column({ type: "int", default: 0 })
    totalProblemsSolved: number; // Fully accepted

    @Column({ type: "jsonb", nullable: true })
    problemStats: any; // { problemId: { score: 100, status: "accepted", testCases: "5/5" } }

    @Column({ type: "jsonb", nullable: true })
    plagiarismReport: any; // Full Plagiarism Service Response

    @Column({ type: "jsonb", nullable: true })
    violationReport: any; // Full Violation Details

    // ⏱️ Time Metrics
    @Column({ type: "int", nullable: true })
    allocatedDurationSeconds: number; // Total time given (contest.durationMinutes * 60)

    @Column({ type: "jsonb", nullable: true })
    timeMetrics: any; // { usedSeconds, allocatedSeconds, percentageUsed, wasExpired }

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;
}
