import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { AssessmentSession } from "./AssessmentSession.entity";

export enum ViolationType {
    WINDOW_SWAP = "window_swap",
    TAB_SWITCH = "tab_switch",
    FULL_SCREEN_EXIT = "full_screen_exit",
    MULTIPLE_PEOPLE = "multiple_people",
    NO_FACE = "no_face",
    WRONG_FACE = "wrong_face",
    LOOKING_AWAY = "looking_away",
    CAMERA_BLOCKED = "camera_blocked",
    MIC_MUTED = "mic_muted",
    BACKGROUND_AUDIO = "background_audio",
    PROHIBITED_OBJECT = "prohibited_object",
    BROWSER_UNSAFE = "browser_unsafe",
}

@Entity("assessment_violations")
export class AssessmentViolation {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => AssessmentSession, { onDelete: "CASCADE" })
    @JoinColumn({ name: "session_id" })
    session: AssessmentSession;

    @Column({ name: "assessment_id", nullable: true })
    assessmentId: string;

    @Column({
        type: "enum",
        enum: ViolationType,
        default: ViolationType.WINDOW_SWAP
    })
    type: ViolationType;

    @Column({ type: "jsonb", nullable: true })
    metadata: {
        confidence?: number;
        snapshotUrl?: string; // URL of the screenshot/evidence
        details?: string;
        timestamp?: number;
    };

    @CreateDateColumn({ name: "detected_at" })
    detectedAt: Date;
}
