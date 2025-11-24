import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import Achievement from '../models/Achievement.js';
import User from '../models/User.js';

const router = express.Router();

// Get all achievements
router.get('/', authMiddleware, async (req, res) => {
  try {
    const allAchievements = await Achievement.find();
    const user = await User.findById(req.userId).populate('achievements');

    const achievementsWithStatus = allAchievements.map(achievement => ({
      ...achievement.toObject(),
      unlocked: user.achievements.some(a => a._id.toString() === achievement._id.toString())
    }));

    res.json({ achievements: achievementsWithStatus });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch achievements', error: error.message });
  }
});

// Initialize default achievements
router.post('/init', async (req, res) => {
  try {
    const defaultAchievements = [
      { name: 'First Steps', description: 'Complete your first practice session', icon: '🎯', points: 10, category: 'milestone' },
      { name: 'Week Warrior', description: 'Practice 7 days in a row', icon: '🔥', points: 50, category: 'streak' },
      { name: 'Perfect Score', description: 'Get a score of 95 or higher', icon: '⭐', points: 30, category: 'mastery' },
      { name: 'Social Butterfly', description: 'Chat with 5 different peers', icon: '💬', points: 20, category: 'social' },
      { name: 'Century Club', description: 'Earn 100 total points', icon: '💯', points: 25, category: 'milestone' },
      { name: 'Master Speaker', description: 'Complete 50 practice sessions', icon: '🏆', points: 100, category: 'mastery' }
    ];

    await Achievement.insertMany(defaultAchievements);
    res.json({ message: 'Achievements initialized successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to initialize achievements', error: error.message });
  }
});

export default router;
