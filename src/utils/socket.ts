import { Server } from "socket.io";
import http from "http";

let io: Server | undefined;

const ALLOWED_ORIGINS = [
  "http://localhost:8000",
  "http://localhost:4000",
  "http://localhost:5000",
  "http://localhost:5173",
];

export const initSocket = (server: http.Server): Server => {
  io = new Server(server, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`⚡ [Contest Socket] Connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`❌ [Contest Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io not initialized in user-contest-service");
  }
  return io;
};

export interface ContestNotificationPayload {
  type:
  | "contest_created"
  | "contest_updated"
  | "contest_deleted"
  | "contest_registration"
  | "violation_reported"
  | "monitoring_photo_captured"
  | "participant_joined"
  | "participant_status_changed";
  title: string;
  message: string;
  contestId: string;
  contestTitle?: string;
  startsAt?: string;
  userId?: string;
  violation?: any;
  photoUrl?: string;
}

export const emitContestNotification = (payload: ContestNotificationPayload) => {
  if (!io) return;
  io.emit("contestNotification", payload);
};
