import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import PracticeSession from '../models/PracticeSession.js';
import User from '../models/User.js';

const router = express.Router();

// Get user progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const sessions = await PracticeSession.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(30);

    // Calculate weekly progress
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekSessions = sessions.filter(s => s.date >= weekAgo);

    const weeklyData = thisWeekSessions.reduce((acc, session) => {
      const day = session.date.toLocaleDateString('en-US', { weekday: 'short' });
      if (!acc[day]) {
        acc[day] = { sessions: 0, totalScore: 0 };
      }
      acc[day].sessions += 1;
      acc[day].totalScore += session.score;
      return acc;
    }, {});

    const weeklyProgress = Object.entries(weeklyData).map(([day, data]) => ({
      day,
      averageScore: Math.round(data.totalScore / data.sessions),
      sessions: data.sessions
    }));

    // Calculate skill metrics
    const recentSessions = sessions.slice(0, 10);
    const metrics = {
      clarity: Math.round(recentSessions.reduce((sum, s) => sum + (s.metrics?.clarity || 0), 0) / recentSessions.length) || 0,
      pace: Math.round(recentSessions.reduce((sum, s) => sum + (s.metrics?.pace || 0), 0) / recentSessions.length) || 0,
      vocabulary: Math.round(recentSessions.reduce((sum, s) => sum + (s.metrics?.vocabulary || 0), 0) / recentSessions.length) || 0,
      confidence: Math.round(recentSessions.reduce((sum, s) => sum + (s.metrics?.confidence || 0), 0) / recentSessions.length) || 0
    };

    res.json({
      totalPoints: user.totalPoints,
      level: user.level,
      totalSessions: sessions.length,
      weeklyProgress,
      metrics,
      recentSessions: sessions.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch progress', error: error.message });
  }
});

export default router;
