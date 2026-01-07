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

@Entity("contest_registrations_detailed")
export class ContestRegistration {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    personalEmail: string;

    @Column({ nullable: true })
    phone: string;

    @Column()
    college: string;

    @Column()
    rollNumber: string;

    @Column()
    department: string;

    @Column()
    currentYear: string;

    @Column()
    photoUrl: string; // Supabase URL

    @Column({ nullable: true })
    resumeUrl: string; // Supabase URL for PDF resume

    @CreateDateColumn()
    registeredAt: Date;

    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @Column({ type: "timestamp", nullable: true })
    finishedAt: Date;

    @Column({ type: "text", nullable: true })
    lastActiveSessionId: string | null;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;
}
