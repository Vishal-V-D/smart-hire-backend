import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Assessment } from "./Assessment.entity";
import { AssessmentInvitation } from "./AssessmentInvitation.entity";

@Entity("assessment_sessions")
export class AssessmentSession {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn()
    user: User;

    @Column({ nullable: true })
    userId: string;

    @ManyToOne(() => Assessment, { onDelete: "CASCADE" })
    @JoinColumn()
    assessment: Assessment;

    @Column({ nullable: true })
    assessmentId: string;

    @ManyToOne(() => AssessmentInvitation, { onDelete: "CASCADE" })
    @JoinColumn()
    invitation: AssessmentInvitation;

    @Column({ unique: true })
    sessionToken: string; // Unique session identifier

    @Column({ type: "timestamp", nullable: true })
    startedAt: Date;

    @Column({ type: "timestamp", nullable: true })
    submittedAt: Date;

    @Column({ default: false })
    proctoringConsent: boolean;

    @Column({ type: "jsonb", nullable: true })
    systemChecks: {
        browser: boolean;
        camera: boolean;
        mic: boolean;
        screenShare: boolean;
    };

    @Column({ default: "active" })
    status: "active" | "completed" | "expired" | "terminated";

    @CreateDateColumn()
    createdAt: Date;
}

