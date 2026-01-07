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

@Entity("contest_invitations")
export class ContestInvitation {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "uuid" })
    contestId: string;

    @Column()
    email: string;

    @Column({ unique: true })
    inviteToken: string;

    @Column({ default: false })
    isAccepted: boolean;

    @Column({ type: "timestamp", nullable: true })
    acceptedAt: Date;

    @Column({ type: "uuid", nullable: true })
    acceptedByUserId: string;

    @CreateDateColumn()
    invitedAt: Date;

    @Column({ type: "uuid" })
    invitedBy: string; // Organizer user ID

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "SET NULL" })
    @JoinColumn({ name: "invitedBy" })
    organizer: User;

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "acceptedByUserId" })
    acceptedByUser: User;
}
