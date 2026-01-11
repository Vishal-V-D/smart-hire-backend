import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { AssessmentSection } from "./AssessmentSection.entity";
import { Company } from "./Company.entity";

// Proctoring configuration interface
// Proctoring configuration interface
export interface ProctoringConfig {
    enabled: boolean;
    // Monitoring
    imageMonitoring?: boolean; // periodic snapshots
    videoMonitoring?: boolean; // continuous video streaming/recording
    screenMonitoring?: boolean; // screen capture snapshots
    screenRecording?: boolean; // continuous screen recording
    audioMonitoring?: boolean; // mic listening
    audioRecording?: boolean; // mic recording

    // AI Features
    objectDetection?: boolean; // mobile phones, books
    personDetection?: boolean; // multiple people
    faceDetection?: boolean; // verification
    eyeTracking?: boolean; // looking away
    noiseDetection?: boolean; // unauthorized audio

    // System Control / Lockdown
    fullscreen?: boolean; // force fullscreen
    tabSwitchLimit?: number; // 0-10
    disableCopyPaste?: boolean;
    blockExternalMonitor?: boolean;
    blockRightClick?: boolean;

    // Verification
    verifyIDCard?: boolean;
    verifyFace?: boolean;
}

export enum AssessmentStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    ACTIVE = "active",
    COMPLETED = "completed",
    ARCHIVED = "archived",
}

export enum TimeMode {
    SECTION = "section",
    GLOBAL = "global",
}

@Entity("assessments")
export class Assessment {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Organizer who created this assessment
    @ManyToOne(() => User, { onDelete: "SET NULL", eager: true })
    organizer: User;

    @ManyToOne(() => Company, { nullable: true, onDelete: "CASCADE" })
    company: Company;

    @Column({ nullable: true })
    companyId: string;

    @Column({ length: 200 })
    title: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "timestamp", nullable: true })
    startDate: Date;

    @Column({ type: "timestamp", nullable: true })
    endDate: Date;

    // Duration in minutes (optional if timeMode is 'section')
    @Column({ type: "int", nullable: true })
    duration: number;

    @Column({
        type: "enum",
        enum: TimeMode,
        default: TimeMode.GLOBAL,
    })
    timeMode: TimeMode;

    // Required if timeMode is 'global'
    @Column({ type: "int", nullable: true })
    globalTime: number;

    @Column({
        type: "enum",
        enum: AssessmentStatus,
        default: AssessmentStatus.DRAFT,
    })
    status: AssessmentStatus;

    // Proctoring configuration stored as JSONB
    @Column({ type: "jsonb", nullable: true, default: { enabled: false } })
    proctoring: ProctoringConfig;

    // 🕵️ Plagiarism Detection Configuration for Coding Questions
    @Column({
        type: "jsonb", nullable: true, default: {
            enabled: true,
            strictness: "Medium",
            similarityThreshold: 75,
            aiSensitivity: "Medium",
            reportConfig: {
                includeSourceCode: true,
                includeMatches: true,
                includeAiAnalysis: true,
                includeVerdict: true
            }
        }
    })
    plagiarismConfig: {
        enabled?: boolean;
        strictness?: "Low" | "Medium" | "High";
        similarityThreshold?: number; // 0-100 (Default: 75)
        aiSensitivity?: "Low" | "Medium" | "High";
        reportConfig?: {
            includeSourceCode?: boolean;
            includeMatches?: boolean;
            includeAiAnalysis?: boolean;
            includeVerdict?: boolean;
        };
    } | null;

    // Calculated fields
    @Column({ type: "int", default: 0 })
    totalMarks: number;

    @Column({ type: "int", default: 0 })
    totalQuestions: number;

    @Column({ type: "int", default: 0 })
    totalSections: number;

    // Total time in minutes (sum of all section time limits or globalTime)
    @Column({ type: "int", default: 0 })
    totalTime: number;

    // Navigation settings
    @Column({ default: true })
    allowPreviousNavigation: boolean;

    @Column({ default: true })
    allowMarkForReview: boolean;

    @Column({ type: "timestamp", nullable: true })
    publishedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Sections in this assessment
    @OneToMany(() => AssessmentSection, (section) => section.assessment)
    sections: AssessmentSection[];
}
