import jwt, { Secret, SignOptions } from "jsonwebtoken";

const JWT_SECRET: Secret = process.env.JWT_SECRET || "secret";
const JWT_REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET || "refresh_secret";

const ACCESS_TOKEN_EXPIRES_IN = "24h"; // Extended to 24 hours
const REFRESH_TOKEN_EXPIRES_IN = "7d"; // Long-lived

export const signJwt = (payload: object) => {
  return signAccessToken(payload); // Backward compatibility
};

export const signAccessToken = (payload: object) => {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const signRefreshToken = (payload: object) => {
  const options: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRES_IN };
  return jwt.sign(payload, JWT_REFRESH_SECRET, options);
};

export const verifyJwt = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err: any) {
    throw { status: 403, message: "Invalid or expired access token" };
  }
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err: any) {
    throw { status: 403, message: "Invalid or expired refresh token" };
  }
};
