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

@Entity("contest_monitoring_photos")
export class ContestMonitoringPhoto {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column()
    photoUrl: string; // Supabase URL

    @CreateDateColumn()
    capturedAt: Date;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;
}
