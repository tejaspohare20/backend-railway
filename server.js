import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import progressRoutes from './routes/progress.js';
import leaderboardRoutes from './routes/leaderboard.js';
import achievementsRoutes from './routes/achievements.js';
import microLearningRoutes from './routes/microLearning.js';
import adminRoutes from './routes/admin.js';
import contactsRoutes from './routes/contacts.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/micro-learning', microLearningRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contacts', contactsRoutes);

// Socket.IO for peer chat - Random matching system
let waitingUsers = [];
const activeRooms = new Map();
const onlineUsers = new Map(); // Track all online users

// Function to broadcast online users count
function broadcastOnlineStats() {
  const stats = {
    totalOnline: onlineUsers.size,
    waiting: waitingUsers.length,
    inCall: activeRooms.size / 2, // Divide by 2 because each room has 2 users
    onlineUsersList: Array.from(onlineUsers.values()).map(user => ({
      userName: user.userName,
      status: activeRooms.has(user.socketId) ? 'in-chat' : waitingUsers.find(w => w.id === user.socketId) ? 'waiting' : 'idle'
    }))
  };
  io.emit('online-stats', stats);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-chat', (data) => {
    const userName = data?.userName || 'Anonymous';
    socket.userName = userName;
    
    // Add to online users
    onlineUsers.set(socket.id, { userName, socketId: socket.id });
    broadcastOnlineStats();

    // Try to match with a waiting user
    if (waitingUsers.length > 0) {
      const peer = waitingUsers.shift();
      const roomId = `room_${socket.id}_${peer.id}`;
      
      // Both users join the same room
      socket.join(roomId);
      peer.join(roomId);
      
      // Store room info
      activeRooms.set(socket.id, { roomId, peerId: peer.id, peerName: peer.userName });
      activeRooms.set(peer.id, { roomId, peerId: socket.id, peerName: userName });
      
      // Notify both users they are matched
      socket.emit('peer-matched', { peerName: peer.userName, roomId });
      peer.emit('peer-matched', { peerName: userName, roomId });
      
      console.log(`Matched ${socket.id} (${userName}) with ${peer.id} (${peer.userName}) in room ${roomId}`);
      broadcastOnlineStats();
    } else {
      // Add to waiting list
      waitingUsers.push(socket);
      socket.emit('waiting-for-peer');
      console.log(`User ${socket.id} (${userName}) is waiting for a peer`);
      broadcastOnlineStats();
    }
  });

  socket.on('message', (data) => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('message', {
        message: data.message,
        sender: socket.userName,
        timestamp: new Date()
      });
    }
  });

  // WebRTC signaling
  socket.on('voice-call-request', (data) => {
    console.log(`Voice call request from ${socket.id} (${socket.userName})`);
    const roomInfo = activeRooms.get(socket.id);
    console.log('Room info:', roomInfo);
    if (roomInfo) {
      console.log(`Sending voice-call-request to room ${roomInfo.roomId}`);
      socket.to(roomInfo.roomId).emit('voice-call-request', { from: socket.userName });
      console.log(`Voice call request sent to ${roomInfo.peerName}`);
    } else {
      console.log('No room info found for this socket');
    }
  });

  socket.on('voice-call-accepted', () => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('voice-call-accepted');
    }
  });

  socket.on('voice-call-rejected', () => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('voice-call-rejected');
    }
  });

  socket.on('voice-call-offer', (data) => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('voice-call-offer', data);
    }
  });

  socket.on('voice-call-answer', (data) => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('voice-call-answer', data);
    }
  });

  socket.on('ice-candidate', (data) => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('ice-candidate', data);
    }
  });

  socket.on('voice-call-ended', () => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('voice-call-ended');
    }
  });

  socket.on('typing', () => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('peer-typing', { userName: socket.userName });
    }
  });

  socket.on('stop-typing', () => {
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('peer-stop-typing');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from online users
    onlineUsers.delete(socket.id);
    
    // Remove from waiting list if present
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    
    // Notify peer if in an active room
    const roomInfo = activeRooms.get(socket.id);
    if (roomInfo) {
      socket.to(roomInfo.roomId).emit('peer-disconnected', { peerName: socket.userName });
      activeRooms.delete(roomInfo.peerId);
      activeRooms.delete(socket.id);
    }
    
    // Broadcast updated stats
    broadcastOnlineStats();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5002;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
});
