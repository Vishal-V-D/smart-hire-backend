import morgan from "morgan";
import logger from "../utils/logger";

// Stream logs from Morgan into Winston
const stream = {
  write: (message: string) => logger.info(message.trim()),
};

// HTTP request logging middleware
export const requestLogger = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  { stream }
);
