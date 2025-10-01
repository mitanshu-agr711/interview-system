import Express  from "express";
// import { createServer } from "http";
// import { Server } from "socket.io";
import router from "./routes/router.auth.js";

import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./model/connect.js";

// console.log("mongo",process.env.MONGO_URL);
const app = Express();
// const httpServer = createServer(app);
connectDB();
// const io = new Server(httpServer, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//   },
// });
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
    res.send("Hey there! This is the server for the chat app.");
});
app.use("/auth", router);

app.listen(5000, () => {
    console.log(`Server is running on port  5000`);
})
