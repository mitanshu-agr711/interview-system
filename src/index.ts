import Express  from "express";
import cors from "cors";
import { Redis } from "@upstash/redis";
import router from "./routes/router.auth.js";
import img  from "./routes/upload.js";
import workspaceRouter from "./routes/workspace.js";
import interviewRouter from "./routes/router.interview.js";

import dotenv from "dotenv";
dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

import { connectDB } from "./model/connect.js";


const app = Express();

connectDB();

app.use(cors());
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
    res.send("checking......");
});

app.get("/redis-test", async (_, res) => {
  await redis.set("server-test", "working", { ex: 60 });
  const value = await redis.get("server-test");
  res.json({ redis: value });
});

app.use("/auth", router);
app.use("/image", img);
app.use("/api/interview", interviewRouter); 
app.use("/api/workspace", workspaceRouter);



app.listen(5000, () => {
    console.log(`Server is running on port  5000`);
})
