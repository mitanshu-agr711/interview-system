import { Request, Response, NextFunction } from "express";
import { createAccessToken, createRefreshToken } from "../utils/tokengenerator.js";
import { redisClient } from "../utils/redisClient.js";
import {verifyRefreshToken} from "../utils/tokengenerator.js";

import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const verifyToken = (req: any, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Token missing" });
    return;
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, (err: jwt.VerifyErrors | null, payload: any) => {
    if (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    
     req.userId = payload.userId;
 

    next();
  });
};


export const refreshAccessToken = async (req: Request, res: Response):  Promise<void>=> {
  try {

//     console.log("aa rhi hai");
    console.log("aa rhi hai");
console.log("Cookies:", req.cookies);
    const token = req.cookies?.refreshToken;
    const sessionId = req.cookies?.sessionId;
    if (!token || !sessionId)
      {  res.status(401).json({ message: "No token or session" });
    return;
  }

    
    const payload = await verifyRefreshToken(token);
    if (!payload || payload.sessionId !== sessionId) {
     { res.status(403).json({ message: "Invalid token or session" });return ;}
    }

    
    await redisClient.del(`refreshToken:${payload.userId}:${sessionId}`);

   
    const newAccessToken = createAccessToken(payload.userId);
    const { token: newRefreshToken, sessionId: newSessionId } = await createRefreshToken(payload.userId);

    
    res
      .cookie("refreshToken", newRefreshToken, {
         httpOnly: true,
        secure: true,
        // secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 24 * 60 * 60 * 1000,
      })
      .cookie("sessionId", newSessionId, {
        httpOnly: true,
        secure: true,
        // secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        // sameSite: "strict",
        maxAge: 10 * 24 * 60 * 60 * 1000,
      })
      .json({ accessToken: newAccessToken });
      console.log("Access token refreshed successfully");

    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};


