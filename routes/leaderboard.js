import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Get leaderboard
router.get('/', authMiddleware, async (req, res) => {
  try {
    const topUsers = await User.find()
      .select('username totalPoints level')
      .sort({ totalPoints: -1 })
      .limit(50);

    const currentUser = await User.findById(req.userId)
      .select('username totalPoints level');

    // Find current user's rank
    const allUsers = await User.find().sort({ totalPoints: -1 });
    const userRank = allUsers.findIndex(u => u._id.toString() === req.userId) + 1;

    res.json({
      leaderboard: topUsers.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        points: user.totalPoints,
        level: user.level
      })),
      currentUser: {
        rank: userRank,
        username: currentUser.username,
        points: currentUser.totalPoints,
        level: currentUser.level
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch leaderboard', error: error.message });
  }
});

export default router;
