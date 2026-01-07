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

@Entity("plagiarism_results")
export class PlagiarismResult {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column()
    problemId: string;

    @Column()
    submissionId: string;

    @Column({ type: "float", default: 0 })
    similarityScore: number;

    @Column({ type: "jsonb", nullable: true })
    matches: any; // Array of matched users

    @Column({ default: false })
    isAiGenerated: boolean;

    @Column({ type: "float", default: 0 })
    aiConfidence: number;

    @Column()
    riskLevel: string; // 'high', 'medium', 'low'

    @Column({ default: "Clean" })
    verdict: string; // Clean, Suspicious, Plagiarized, AI Generated

    @Column({ nullable: true })
    reportPath: string; // Path to detailed report from plagiarism service

    @CreateDateColumn()
    analyzedAt: Date;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;
}
