import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import User from '../models/User.js';
import PracticeSession from '../models/PracticeSession.js';
import Achievement from '../models/Achievement.js';

const router = express.Router();

// Get all users statistics
router.get('/users/stats', authMiddleware, async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get users registered in last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: last24Hours }
    });

    // Get users registered in last 7 days
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: last7Days }
    });

    // Get total practice sessions
    const totalSessions = await PracticeSession.countDocuments();

    // Get total achievements unlocked
    const totalAchievements = await Achievement.countDocuments();

    // Get all users with their activity
    const users = await User.find()
      .select('username email totalPoints level createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      statistics: {
        totalUsers,
        newUsersToday,
        newUsersThisWeek,
        totalSessions,
        totalAchievements
      },
      recentUsers: users
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user stats', error: error.message });
  }
});

// Get individual user details
router.get('/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's practice sessions
    const sessions = await PracticeSession.find({ userId })
      .sort({ date: -1 })
      .limit(10);

    // Get user's achievements
    const achievements = await Achievement.find({ userId });

    res.json({
      user,
      sessions,
      achievements,
      activity: {
        totalSessions: sessions.length,
        totalAchievements: achievements.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user details', error: error.message });
  }
});

// Get activity logs (recent sessions across all users)
router.get('/activity/recent', authMiddleware, async (req, res) => {
  try {
    const recentSessions = await PracticeSession.find()
      .sort({ date: -1 })
      .limit(20)
      .populate('userId', 'username email');

    res.json({ recentSessions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch recent activity', error: error.message });
  }
});

// Get platform analytics
router.get('/analytics/overview', authMiddleware, async (req, res) => {
  try {
    // Users growth over last 30 days
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const userGrowth = await User.aggregate([
      {
        $match: { createdAt: { $gte: last30Days } }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Session activity over last 30 days
    const sessionActivity = await PracticeSession.aggregate([
      {
        $match: { date: { $gte: last30Days } }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
          avgScore: { $avg: "$score" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Top performing users
    const topUsers = await User.find()
      .sort({ totalPoints: -1 })
      .limit(10)
      .select('username email totalPoints level');

    res.json({
      userGrowth,
      sessionActivity,
      topUsers
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
});

export default router;
