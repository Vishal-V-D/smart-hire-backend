import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Contest } from "./contest.entity";
import { User } from "./user.entity";

export enum ViolationType {
    COPY = "COPY",
    PASTE = "PASTE",
    EXTERNAL_PASTE = "EXTERNAL_PASTE",
    TAB_SWITCH_AWAY = "TAB_SWITCH_AWAY",
    TAB_SWITCH_RETURN = "TAB_SWITCH_RETURN",
    WINDOW_BLUR = "WINDOW_BLUR",
    CAMERA_BLOCKED = "CAMERA_BLOCKED",
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
    NO_FACE_DETECTED = "NO_FACE_DETECTED",
    MULTIPLE_FACES = "MULTIPLE_FACES",
    FACE_MISMATCH = "FACE_MISMATCH",
    FACE_RECOGNITION_FAILED = "FACE_RECOGNITION_FAILED",
    AUDIO_NOISE_DETECTED = "AUDIO_NOISE_DETECTED",
}

@Entity("contest_violations")
export class ContestViolation {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ nullable: true })
    problemId: string;

    @Column({
        type: "enum",
        enum: ViolationType,
    })
    violationType: ViolationType;

    @Column({ type: "timestamp" })
    timestamp: Date;

    @Column({ type: "jsonb", nullable: true })
    metadata: any;

    @Column({ default: false })
    reviewed: boolean;

    @Column({ nullable: true })
    reviewedBy: string;

    @Column({ type: "text", nullable: true })
    reviewNotes: string;

    @CreateDateColumn()
    createdAt: Date;
}
