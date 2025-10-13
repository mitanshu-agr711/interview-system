import Express  from "express";
import cors from "cors";

import router from "./routes/router.auth.js";
import img  from "./routes/upload.js";

import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./model/connect.js";


const app = Express();

connectDB();

app.use(cors());
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
    res.send("Hey there! This is the server for the chat app.");
});
app.use("/auth", router);
app.use("/image", img);

app.listen(5000, () => {
    console.log(`Server is running on port  5000`);
})
