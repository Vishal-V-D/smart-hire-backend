import { AppDataSource } from "../config/db";
import { randomUUID } from "crypto";
import { Contest } from "../entities/contest.entity";
import { ContestProblem } from "../entities/contestProblem.entity";
import { Problem } from "../entities/problem.entity";
import { User } from "../entities/user.entity";
import { ContestInvitation } from "../entities/contestInvitation.entity";
import { ContestSession } from "../entities/contestSession.entity";
import { emitContestNotification } from "../utils/socket";
import {
  ProctoringSettings,
  validateProctoringSettings,
  getDefaultProctoringSettings,
  getNoProctoringSettings
} from "../utils/proctoringValidation.util";


const repo = () => AppDataSource.getRepository(Contest);
const cpRepo = () => AppDataSource.getRepository(ContestProblem);
const problemRepo = () => AppDataSource.getRepository(Problem);
const userRepo = () => AppDataSource.getRepository(User);

const toDate = (value?: string | Date): Date | undefined => {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
};

const calculateDurationMinutes = (start?: string | Date, end?: string | Date): number | undefined => {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate || !endDate) return undefined;

  const diffMs = endDate.getTime() - startDate.getTime();
  if (Number.isNaN(diffMs) || diffMs <= 0) return 0;

  return Math.round(diffMs / 60000);
};

// Public createContest removed


/** 🔍 Get full contest details */
export const getContest = async (id: string) => {
  const contest = await repo().findOne({
    where: { id },
    relations: [
      "createdBy",
      "contestProblems",
      "contestProblems.problem",
      "contestant",
    ],
  });

  if (contest) {
    console.log(`🔍 [ContestService] Fetched contest: ${contest.title} (${contest.id})`);
    console.log(`🧩 [ContestService] Problems found: ${contest.contestProblems?.length || 0}`);
    contest.contestProblems?.forEach(cp => {
      console.log(`   - Problem: ${cp.problem?.title} (ID: ${cp.problem?.id})`);
    });
  }

  if (!contest) throw { status: 404, message: "Contest not found" };
  return contest;
};

/** 🧠 Add a problem to a contest */
export const addProblemToContest = async (contestId: string, problemId: string) => {
  const contest = await repo().findOneBy({ id: contestId });
  const problem = await problemRepo().findOneBy({ id: problemId });

  if (!contest || !problem) {
    throw { status: 404, message: "Contest or Problem not found" };
  }

  // Check if problem already exists in contest
  const existingLink = await cpRepo().findOne({
    where: {
      contest: { id: contestId },
      problem: { id: problemId },
    },
  });

  if (existingLink) {
    throw { status: 400, message: "Problem already added to this contest" };
  }

  const cp = cpRepo().create({ contest, problem });
  return await cpRepo().save(cp);
};

/** ❌ Remove problem from contest */
export const removeProblemFromContest = async (id: string) => {
  const cp = await cpRepo().findOneBy({ id });
  if (!cp) throw { status: 404, message: "Contest-Problem link not found" };
  return await cpRepo().remove(cp);
};

/** 🧍 Register contestant for a contest */
export const registerForContest = async (contestId: string, userId: string) => {
  const contest = await repo().findOne({
    where: { id: contestId },
    relations: ["contestant"],
  });
  const user = await userRepo().findOneBy({ id: userId });

  if (!contest || !user) {
    throw { status: 404, message: "Contest or User not found" };
  }

  // Initialize contestant array if undefined
  if (!contest.contestant) {
    contest.contestant = [];
  }

  // Prevent duplicate registration
  if (contest.contestant.some((u) => u.id === user.id)) {
    throw { status: 400, message: "User already registered" };
  }

  contest.contestant.push(user);
  await repo().save(contest);

  emitContestNotification({
    type: "contest_registration",
    title: "Registration confirmed",
    message: `You have been successfully registered for the contest "${contest.title}".\n\nMake sure to review the contest rules and be ready before the start time.\nStart time: ${contest.startTime?.toISOString?.() ?? "TBD"}`,
    contestId: contest.id,
    contestTitle: contest.title,
    startsAt: contest.startTime?.toISOString?.(),
  });

  return contest;
};

/** 🚫 Unregister contestant from a contest */
export const unregisterFromContest = async (contestId: string, userId: string) => {
  const contest = await repo().findOne({
    where: { id: contestId },
    relations: ["contestant"],
  });

  if (!contest) {
    throw { status: 404, message: "Contest not found" };
  }

  if (!contest.contestant) {
    throw { status: 400, message: "User not registered for this contest" };
  }

  const userIndex = contest.contestant.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    throw { status: 400, message: "User not registered for this contest" };
  }

  contest.contestant.splice(userIndex, 1);
  await repo().save(contest);

  return { message: "Successfully unregistered from contest" };
};

/** 📄 Get all contests created by the logged-in organizer */
export const getCreatedContestsByUser = async (userId: string) => {
  const user = await userRepo().findOne({
    where: { id: userId },
    relations: ["createdContests", "createdContests.contestProblems"],
  });

  if (!user) throw { status: 404, message: "User not found" };
  return user.createdContests || [];
};

/** 🏁 Get all contests a contestant has registered for */
export const getRegisteredContestsByUser = async (userId: string) => {
  const user = await userRepo().findOne({
    where: { id: userId },
    relations: ["registeredContests", "registeredContests.contestProblems"],
  });

  if (!user) throw { status: 404, message: "User not found" };
  return user.registeredContests || [];
};

/** ✏️ Update contest (Organizer only) */
export const updateContest = async (contestId: string, userId: string, data: any) => {
  const contest = await repo().findOne({
    where: { id: contestId },
    relations: ["createdBy"],
  });

  if (!contest) throw { status: 404, message: "Contest not found" };
  if (contest.createdBy.id !== userId) {
    throw { status: 403, message: "Not authorized to update this contest" };
  }

  // Prevent changing isInviteOnly if invitations sent
  if (data.isInviteOnly !== undefined && contest.isInviteOnly && !data.isInviteOnly) {
    const inviteRepo = AppDataSource.getRepository(ContestInvitation);
    const invitations = await inviteRepo.count({ where: { contestId } });
    if (invitations > 0) {
      throw {
        status: 400,
        message: "Cannot change invite-only status after invitations sent"
      };
    }
  }

  // Validate proctoring settings if provided
  if (data.proctoringSettings) {
    const validationErrors = validateProctoringSettings(data.proctoringSettings);
    if (validationErrors.length > 0) {
      throw { status: 400, message: `Invalid proctoring settings: ${validationErrors.join(", ")}` };
    }
  }

  // Update only allowed fields
  if (data.title !== undefined) contest.title = data.title;
  if (data.description !== undefined) contest.description = data.description;

  const newStartTime = toDate(data.startDate);
  if (newStartTime !== undefined) contest.startTime = newStartTime;

  const newEndTime = toDate(data.endDate);
  if (newEndTime !== undefined) contest.endTime = newEndTime;

  if (data.durationMinutes !== undefined || data.duration !== undefined) {
    contest.durationMinutes = data.durationMinutes ?? data.duration ?? contest.durationMinutes;
  } else if (contest.startTime && contest.endTime) {
    contest.durationMinutes = calculateDurationMinutes(contest.startTime, contest.endTime);
  }

  // Update proctoring settings if provided
  if (data.proctoringSettings) {
    const ps = data.proctoringSettings;
    if (ps.enableVideoProctoring !== undefined) contest.enableVideoProctoring = ps.enableVideoProctoring;
    if (ps.enableAudioMonitoring !== undefined) contest.enableAudioMonitoring = ps.enableAudioMonitoring;
    if (ps.enableCopyPasteDetection !== undefined) contest.enableCopyPasteDetection = ps.enableCopyPasteDetection;
    if (ps.enableTabSwitchDetection !== undefined) contest.enableTabSwitchDetection = ps.enableTabSwitchDetection;
    if (ps.enableScreenshotCapture !== undefined) contest.enableScreenshotCapture = ps.enableScreenshotCapture;
    if (ps.enableFaceRecognition !== undefined) contest.enableFaceRecognition = ps.enableFaceRecognition;
    if (ps.requireCameraAccess !== undefined) contest.requireCameraAccess = ps.requireCameraAccess;
    if (ps.requireMicrophoneAccess !== undefined) contest.requireMicrophoneAccess = ps.requireMicrophoneAccess;
    if (ps.enableFullscreenMode !== undefined) contest.enableFullscreenMode = ps.enableFullscreenMode;
    if (ps.enableFullscreenMode !== undefined) contest.enableFullscreenMode = ps.enableFullscreenMode;
    if (ps.screenshotIntervalSeconds !== undefined) contest.screenshotIntervalSeconds = ps.screenshotIntervalSeconds;
  }

  // 🕵️ Update Plagiarism Config (Only if Invite Only)
  // Check if contest is currently invite-only OR if we are switching to invite-only
  const willBeInviteOnly = data.isInviteOnly !== undefined ? data.isInviteOnly : contest.isInviteOnly;

  if (data.plagiarismConfig !== undefined) {
    if (willBeInviteOnly) {
      contest.plagiarismConfig = data.plagiarismConfig;
    } else {
      // If public, we can optionally clear it or just ignore the update. 
      // Let's clear it to be safe/consistent.
      contest.plagiarismConfig = null;
    }
  }

  const updated = await repo().save(contest);

  emitContestNotification({
    type: "contest_updated",
    title: "Contest updated",
    message: `The contest "${updated.title}" has been updated. Please review the latest details.\n\nStart time: ${updated.startTime?.toISOString?.() ?? "TBD"}`,
    contestId: updated.id,
    contestTitle: updated.title,
    startsAt: updated.startTime?.toISOString?.(),
  });

  return updated;
};

/** ❌ Delete contest (Organizer only) */
export const deleteContest = async (contestId: string, userId: string) => {
  const contest = await repo().findOne({
    where: { id: contestId },
    relations: ["createdBy"],
  });

  if (!contest) throw { status: 404, message: "Contest not found" };
  if (contest.createdBy.id !== userId) {
    throw { status: 403, message: "Not authorized to delete this contest" };
  }

  // Log cascade deletes for secure contests
  if (contest.isInviteOnly) {
    const inviteRepo = AppDataSource.getRepository(ContestInvitation);
    const sessionRepo = AppDataSource.getRepository(ContestSession);

    const inviteCount = await inviteRepo.count({ where: { contestId } });
    const sessionCount = await sessionRepo.count({ where: { contestId } });
    console.log(`🗑️ Deleting secure contest with ${inviteCount} invitations and ${sessionCount} sessions`);
  }

  const contestTitle = contest.title;
  const contestStartTime = contest.startTime?.toISOString?.();

  await repo().remove(contest);

  emitContestNotification({
    type: "contest_deleted",
    title: "Contest cancelled",
    message: `The contest "${contestTitle}" has been cancelled by the organizer.\n\nIf you had planned to participate, no further action is required from your side.`,
    contestId: contestId,
    contestTitle: contestTitle,
    startsAt: contestStartTime,
  });

  return { message: "Contest deleted successfully" };
};

/** 📊 Get contest statistics */
export const getContestStatistics = async (contestId: string) => {
  const contest = await repo().findOne({
    where: { id: contestId },
    relations: ["contestant", "contestProblems"],
  });

  if (!contest) throw { status: 404, message: "Contest not found" };

  return {
    totalParticipants: contest.contestant?.length || 0,
    totalProblems: contest.contestProblems?.length || 0,
    startTime: contest.startTime,
    endTime: contest.endTime,
    durationMinutes: contest.durationMinutes,
    status: getContestStatus(contest),
  };
};

/** 🕐 Helper: Get contest status */
const getContestStatus = (contest: Contest): string => {
  if (!contest.startTime || !contest.endTime) return "draft";

  const now = new Date();
  const start = new Date(contest.startTime);
  const end = new Date(contest.endTime);

  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "ongoing";
};

/** 🔍 Search contests by title or description */
export const searchContests = async (query: string, skip = 0, take = 20) => {
  const contests = await repo()
    .createQueryBuilder("contest")
    .leftJoinAndSelect("contest.createdBy", "createdBy")
    .leftJoinAndSelect("contest.contestProblems", "contestProblems")
    .where("contest.title ILIKE :query", { query: `%${query}%` })
    .orWhere("contest.description ILIKE :query", { query: `%${query}%` })
    .orderBy("contest.startTime", "ASC")
    .skip(skip)
    .take(take)
    .getMany();

  return contests;
};

/** 🔒 Create a secure contest (Invite Only) */
export const createSecureContest = async (data: any, creatorId: string) => {
  const creator = await userRepo().findOneBy({ id: creatorId });
  if (!creator) throw { status: 404, message: "Creator not found" };

  // Validate proctoring settings if provided, otherwise use defaults
  const proctoringSettings: ProctoringSettings = data.proctoringSettings || getDefaultProctoringSettings();
  const validationErrors = validateProctoringSettings(proctoringSettings);
  if (validationErrors.length > 0) {
    throw { status: 400, message: `Invalid proctoring settings: ${validationErrors.join(", ")}` };
  }

  const contest = repo().create({
    title: data.title,
    description: data.description,
    startTime: toDate(data.startDate),
    endTime: toDate(data.endDate),
    durationMinutes:
      data.durationMinutes ??
      data.duration ??
      calculateDurationMinutes(data.startDate, data.endDate),
    createdBy: creator,
    isInviteOnly: true,
    shareableLink: randomUUID(),
    // Apply proctoring settings (defaults to full proctoring for secure contests)
    enableVideoProctoring: proctoringSettings.enableVideoProctoring ?? true,
    enableAudioMonitoring: proctoringSettings.enableAudioMonitoring ?? false,
    enableCopyPasteDetection: proctoringSettings.enableCopyPasteDetection ?? true,
    enableTabSwitchDetection: proctoringSettings.enableTabSwitchDetection ?? true,
    enableScreenshotCapture: proctoringSettings.enableScreenshotCapture ?? true,
    enableFaceRecognition: proctoringSettings.enableFaceRecognition ?? true,
    requireCameraAccess: proctoringSettings.requireCameraAccess ?? true,
    requireMicrophoneAccess: proctoringSettings.requireMicrophoneAccess ?? false,
    enableFullscreenMode: proctoringSettings.enableFullscreenMode ?? true,
    screenshotIntervalSeconds: proctoringSettings.screenshotIntervalSeconds ?? 60,
    // 🕵️ Plagiarism Config (Allowed for Secure Contests)
    plagiarismConfig: data.plagiarismConfig,
  });

  const saved = await repo().save(contest);

  emitContestNotification({
    type: "contest_created",
    title: "New secure contest created",
    message: `A new secure contest "${saved.title}" has been created.`,
    contestId: saved.id,
    contestTitle: saved.title,
  });

  return saved;
};

/** 📋 List all public contests */
export const listContests = async (skip: number, take: number) => {
  const contests = await repo().find({
    where: { isInviteOnly: false },
    relations: ["createdBy", "contestProblems"],
    order: { startTime: "ASC" },
    skip,
    take,
  });
  return contests;
};
