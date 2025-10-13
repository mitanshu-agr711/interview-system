import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../model/user.model.js";
import { createAccessToken, createRefreshToken } from "../utils/tokengenerator.js";

import { v4 as uuidv4 } from 'uuid';

export const register = async (req: Request, res: Response) => {
  
  try {

    const { username,name,email, password } = req.body;

    if (!username || !name || !email || !password) {
      return res
        .status(400)
        .json({ message: "every field are required" });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

      if (!req.files || Array.isArray(req.files)) {
        return res.status(400).json({ message: "avatar file is required" });
      }

      const avatarLocalPath = (req.files as { [fieldname: string]: Express.Multer.File[] })["avatar"]?.[0]?.path;
  console.log("avtar",avatarLocalPath)

  if (!avatarLocalPath) {
   return res.status(400).json({ message: "avatar file is required" });
  }

  const avatar = await uploadCloudinary(avatarLocalPath)


  if (!avatar) {
    return res.status(400).json({ message: "avatar file is required" });
  }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      username,
      name,
      avatar: avatar.url,
      email,
      password: hashedPassword
    });

    return res
      .status(201)
       .json({ message: "User created successfully" });
        } catch (error) {
    return res.status(400).json({ error });
  }
};


export const login = async (req: Request, res: Response) => {
  try {
    const {  username, email, password } = req.body;

    if ((!username && !email) || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const query = username ? 
      { $or: [{ _id: username }, { email: username }] } : 
      { email: email }; 

    const user = await User.findOne(query).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const actualUserId = user._id.toString();
    const sessionId = uuidv4();
    const accessToken = createAccessToken(actualUserId);
    const refreshToken = await createRefreshToken(actualUserId, sessionId);
   
    res
      .status(200)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .cookie("sessionId", sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        user: { id: actualUserId, email: user.email },
        accessToken,
        message: "Login successful"
      });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};




// export const logout = async (req: Request, res: Response) => {
//   const token = req.cookies.refreshToken;
//   if (!token) return res.sendStatus(204);

//   try {
//     const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as any;
//     const user = await User.findById(payload.userId);
//     if (user) {
//       user.refreshToken = undefined;
//       await user.save();
//     }
//     res.clearCookie("refreshToken").sendStatus(204);
//   } catch {
//     res.clearCookie("refreshToken").sendStatus(204);
//   }
// };
