const socketIO = require("socket.io");
const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello world from socket server!");
});

let users = [];
const messages = {}; // Store messages temporarily (Use DB for persistence)

// Helper Functions
const addUser = (userId, socketId) => {
  if (!users.some((user) => user.userId === userId)) {
    users.push({ userId, socketId });
  }
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (receiverId) => users.find((user) => user.userId === receiverId);

const createMessage = ({ senderId, receiverId, text, images }) => ({
  id: Date.now().toString(), // Unique ID for each message
  senderId,
  receiverId,
  text,
  images,
  seen: false
});

io.on("connection", (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on("addUser", (userId) => {
    addUser(userId, socket.id);
    io.emit("getUsers", users);
  });

  socket.on("sendMessage", ({ senderId, receiverId, text, images }) => {
    const message = createMessage({ senderId, receiverId, text, images });
    const user = getUser(receiverId);

    if (!messages[receiverId]) {
      messages[receiverId] = [];
    }
    messages[receiverId].push(message);

    if (user?.socketId) {
      io.to(user.socketId).emit("getMessage", message);
    }
  });

  socket.on("messageSeen", ({ senderId, receiverId, messageId }) => {
    if (messages[senderId]) {
      const message = messages[senderId].find((msg) => msg.receiverId === receiverId && msg.id === messageId);
      if (message) {
        message.seen = true;
        const senderUser = getUser(senderId);
        if (senderUser?.socketId) {
          io.to(senderUser.socketId).emit("messageSeen", { senderId, receiverId, messageId });
        }
      }
    }
  });

  socket.on("updateLastMessage", ({ lastMessage, lastMessagesId }) => {
    io.emit("getLastMessage", { lastMessage, lastMessagesId });
  });

  socket.on("disconnect", () => {
    console.log(`A user disconnected: ${socket.id}`);
    if (users.some((user) => user.socketId === socket.id)) {
      removeUser(socket.id);
      io.emit("getUsers", users);
    }
  });
});

server.listen(process.env.PORT || 4000, () => {
  console.log(`Server is running on port ${process.env.PORT || 4000}`);
});
