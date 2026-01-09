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

    // 📸 Assessment-Specific Photo Storage
    // These photos are captured during proctoring setup for THIS specific assessment
    // This ensures each assessment has its own photo, preventing conflicts
    @Column({ type: "text", nullable: true })
    photoUrl: string | null; // Original photo URL from Supabase

    @Column({ type: "text", nullable: true })
    photoOptimizedUrl: string | null; // Optimized version

    @Column({ type: "text", nullable: true })
    photoThumbnailUrl: string | null; // Thumbnail version

    @Column({ type: "jsonb", nullable: true })
    faceDescriptor: any; // Face recognition data for this assessment

    @CreateDateColumn()
    createdAt: Date;
}

