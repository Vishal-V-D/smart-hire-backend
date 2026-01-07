import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
} from "typeorm";
import { Assessment } from "./Assessment.entity";
import { User } from "./user.entity";

export enum InvitationStatus {
    PENDING = "pending",      // Created but not sent
    SENT = "sent",           // Email sent
    ACCEPTED = "accepted",   // User accepted and linked
    EXPIRED = "expired",     // Past expiry date
    CANCELLED = "cancelled", // Cancelled by organizer
}

@Entity("assessment_invitations")
@Index(["assessment", "email"], { unique: true }) // One invitation per email per assessment
export class AssessmentInvitation {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Assessment this invitation is for
    @ManyToOne(() => Assessment, { onDelete: "CASCADE", eager: true })
    assessment: Assessment;

    // Invitee details
    @Column({ length: 255 })
    email: string;

    @Column({ length: 100, nullable: true })
    name: string;

    // Unique token for invitation link
    @Column({ type: "varchar", length: 100, unique: true })
    @Index()
    token: string;

    @Column({
        type: "enum",
        enum: InvitationStatus,
        default: InvitationStatus.PENDING,
    })
    status: InvitationStatus;

    // When the invitation expires
    @Column({ type: "timestamp" })
    expiresAt: Date;

    // When email was sent
    @Column({ type: "timestamp", nullable: true })
    sentAt: Date;

    // When user accepted
    @Column({ type: "timestamp", nullable: true })
    acceptedAt: Date;

    // Linked user after acceptance
    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    user: User | null;

    // Organizer who created this invitation
    @ManyToOne(() => User, { onDelete: "SET NULL" })
    invitedBy: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
