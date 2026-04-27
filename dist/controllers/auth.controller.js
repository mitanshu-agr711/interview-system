import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../model/user.model.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/tokengenerator.js";
import { redisClient } from "../utils/redisClient.js";
import { sendResetPasswordEmail } from "../utils/emails.js";
import { v4 as uuidv4 } from 'uuid';
const RESET_TOKEN_EXPIRE_MS = 5 * 60 * 1000;
export const register = async (req, res) => {
    try {
        const { username, name, email, password, avatar } = req.body;
        if (!username || !name || !email || !password || !avatar) {
            res.status(400).json({ message: "Every field is required" });
            return;
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ message: "User already exists" });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            name,
            email,
            avatar,
            password: hashedPassword,
        });
        res.status(201).json({ message: "User created successfully" });
        return;
    }
    catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Internal server error" });
        return;
    }
};
export const login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if ((!username && !email) || !password) {
            res.status(400).json({ message: "All fields are required" });
            return;
        }
        const query = username
            ? { $or: [{ username: username }, { email: username }] }
            : { email: email };
        const user = await User.findOne(query).select("+password");
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        const actualUserId = user._id.toString();
        const sessionId = uuidv4();
        const accessToken = createAccessToken(actualUserId);
        const refreshToken = await createRefreshToken(actualUserId, sessionId);
        const isProd = process.env.NODE_ENV === "production";
        res
            .status(200)
            .cookie("refreshToken", refreshToken.token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 10 * 24 * 60 * 60 * 1000,
            path: "/"
        })
            .cookie("sessionId", sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 10 * 24 * 60 * 60 * 1000,
            path: "/"
        })
            .json({
            user: { id: actualUserId, email: user.email, avatar: user.avatar, name: user.name },
            accessToken,
            message: "Login successful"
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const logout = async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    const sessionId = req.cookies?.sessionId;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    let userIdFromAccessToken;
    if (accessToken) {
        try {
            const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
            if (typeof decoded.userId === "string") {
                userIdFromAccessToken = decoded.userId;
            }
        }
        catch {
            // Ignore invalid/expired access token and continue with refresh-token-based logout.
        }
    }
    try {
        if (sessionId && userIdFromAccessToken) {
            await redisClient.del(`refreshToken:${userIdFromAccessToken}:${sessionId}`);
        }
        else if (refreshToken) {
            const payload = await verifyRefreshToken(refreshToken);
            if (payload) {
                await redisClient.del(`refreshToken:${payload.userId}:${payload.sessionId}`);
            }
        }
    }
    catch (error) {
        console.error("Logout error while deleting Redis token:", error);
    }
    const clearCookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
    };
    res
        .clearCookie("refreshToken", clearCookieOptions)
        .clearCookie("sessionId", clearCookieOptions)
        .status(200)
        .json({ message: "Logged out successfully" });
};
export const forgetPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: "Email is required" });
            return;
        }
        const user = await User.findOne({ email });
        if (!user) {
            // Avoid revealing if an email is registered.
            res.status(200).json({ message: "If this email exists, a reset link has been sent" });
            return;
        }
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRE_MS);
        await user.save();
        const clientBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const resetLink = `${clientBaseUrl}/reset-password?token=${rawToken}&id=${user._id.toString()}`;
        await sendResetPasswordEmail(user.email, user.name, resetLink);
        res.status(200).json({ message: "If this email exists, a reset link has been sent" });
        return;
    }
    catch (error) {
        console.error("Forget password error:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};
export const resetPassword = async (req, res) => {
    try {
        const { token, userId, password, confirmPassword } = req.body;
        if (!token || !userId || !password || !confirmPassword) {
            res.status(400).json({ message: "token, userId, password and confirmPassword are required" });
            return;
        }
        if (password !== confirmPassword) {
            res.status(400).json({ message: "Password and confirm password do not match" });
            return;
        }
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            _id: userId,
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() },
        });
        if (!user) {
            res.status(400).json({ message: "Invalid or expired reset link" });
            return;
        }
        const newHashedPassword = await bcrypt.hash(password, 10);
        user.password = newHashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(200).json({ message: "Password reset successful" });
        return;
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};
