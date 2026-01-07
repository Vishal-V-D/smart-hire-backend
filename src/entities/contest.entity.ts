import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { ContestProblem } from "./contestProblem.entity";

@Entity("contests")
export class Contest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  description: string;

  @Column("timestamp")
  startTime: Date;

  @Column("timestamp")
  endTime: Date;

  @Column({ type: "int", nullable: true })
  durationMinutes?: number;

  // 🧑‍💼 Organizer who created this contest
  @ManyToOne(() => User, (user) => user.createdContests, {
    onDelete: "SET NULL",
    eager: true,
  })
  createdBy: User;

  // 🧩 Problems linked to this contest
  @OneToMany(() => ContestProblem, (cp) => cp.contest)
  contestProblems: ContestProblem[];

  // 🧍 Contestants registered for this contest
  @ManyToMany(() => User, (user) => user.registeredContests, {
    eager: true,
  })
  @JoinTable({
    name: "contest_registrations", // join table name
  })
  contestant: User[];

  @Column({ default: false })
  isInviteOnly: boolean;

  @Column({ unique: true, nullable: true })
  shareableLink: string;

  // 🔒 Proctoring Configuration
  @Column({ default: false })
  enableVideoProctoring: boolean;

  @Column({ default: false })
  enableAudioMonitoring: boolean;

  @Column({ default: false })
  enableCopyPasteDetection: boolean;

  @Column({ default: false })
  enableTabSwitchDetection: boolean;

  @Column({ default: false })
  enableScreenshotCapture: boolean;

  @Column({ default: false })
  enableFaceRecognition: boolean;

  @Column({ default: false })
  requireCameraAccess: boolean;

  @Column({ default: false })
  requireMicrophoneAccess: boolean;

  @Column({ default: false })
  enableFullscreenMode: boolean;

  @Column({ type: "int", nullable: true })
  screenshotIntervalSeconds?: number;

  // 🏆 Secure Contest Leaderboard Configuration
  @Column({ default: false })
  showSecureLeaderboard: boolean;

  @Column({ type: "jsonb", nullable: true })
  leaderboardColumns: any; // LeaderboardColumnConfig

  // 🕵️ Plagiarism Detection Configuration
  @Column({ type: "jsonb", nullable: true })
  plagiarismConfig: {
    similarityThreshold?: number; // 0-100 (Saturation)
    strictness?: "Low" | "Medium" | "High";
    aiSensitivity?: "Low" | "Medium" | "High";
    reportConfig?: {
      includeSourceCode: boolean;
      includeMatches: boolean;
      includeAiAnalysis: boolean;
      includeVerdict: boolean;
    };
  } | null;

  @CreateDateColumn()
  createdAt: Date;
}
