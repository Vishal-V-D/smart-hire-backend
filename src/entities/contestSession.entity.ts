import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { Contest } from "./contest.entity";
import { User } from "./user.entity";

@Entity("contest_sessions")
export class ContestSession {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column({ unique: true })
    sessionId: string; // UUID for session validation

    @Column({ type: "timestamp" })
    startedAt: Date;

    @Column({ type: "timestamp", nullable: true })
    finishedAt: Date;

    @Column({ type: "int", nullable: true })
    durationSeconds: number; // Auto-calculated on finish

    @Column({ default: "active" }) // "active" | "finished" | "expired"
    status: string;

    @Column({ type: "jsonb", nullable: true })
    metadata: any; // Browser info, IP, etc.

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;
}
