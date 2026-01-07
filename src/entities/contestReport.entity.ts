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

@Entity("contest_reports")
export class ContestReport {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column({ nullable: true })
    pdfUrl: string; // Supabase URL

    @Column({ type: "int", default: 0 })
    totalScore: number;

    @Column({ type: "int", default: 0 })
    problemsSolved: number;

    @Column({ type: "int", default: 0 })
    violationCount: number;

    @Column({ type: "float", default: 0 })
    plagiarismScore: number;

    @Column({ default: false })
    isDistinct: boolean;

    @Column({ default: false })
    isSuspicious: boolean;

    @Column({ type: "int", default: 0 })
    suspiciousScore: number;

    @Column({ type: "jsonb", nullable: true })
    reportData: any; // Full report JSON

    @CreateDateColumn()
    generatedAt: Date;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;
}
