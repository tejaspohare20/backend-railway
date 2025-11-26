import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import PracticeSession from '../models/PracticeSession.js';
import User from '../models/User.js';
import aiService from '../services/aiService.js';

const router = express.Router();

// Get user's practice sessions
router.get('/practice', authMiddleware, async (req, res) => {
  try {
    const sessions = await PracticeSession.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(20);

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sessions', error: error.message });
  }
});

// Create new practice session with AI feedback
router.post('/practice', authMiddleware, async (req, res) => {
  try {
    const { transcript, duration } = req.body;

    if (!transcript || !duration) {
      return res.status(400).json({ message: 'Transcript and duration are required' });
    }

    // Get AI analysis
    const analysis = await aiService.analyzeSpeech(transcript, duration);

    // Create practice session
    const session = new PracticeSession({
      userId: req.userId,
      transcript,
      duration,
      score: analysis.score,
      feedback: analysis.feedback,
      metrics: {
        clarity: analysis.clarity,
        pace: analysis.pace,
        vocabulary: analysis.vocabulary,
        confidence: analysis.confidence,
        fillerWords: analysis.fillerWords
      }
    });

    await session.save();

    // Update user points
    const pointsEarned = Math.round(analysis.score / 10);
    await User.findByIdAndUpdate(req.userId, {
      $inc: { totalPoints: pointsEarned }
    });

    res.status(201).json({
      session,
      feedback: analysis.feedback,
      suggestions: analysis.suggestions,
      pointsEarned
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create session', error: error.message });
  }
});

// Get practice topic suggestion
router.get('/topic', authMiddleware, async (req, res) => {
  try {
    const topic = await aiService.generatePracticeTopic();
    res.json(topic);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate topic', error: error.message });
  }
});

// Get session analytics
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const sessions = await PracticeSession.find({ userId: req.userId });

    if (sessions.length === 0) {
      return res.json({
        totalSessions: 0,
        averageScore: 0,
        totalTime: 0,
        progress: []
      });
    }

    const totalSessions = sessions.length;
    const averageScore = sessions.reduce((sum, s) => sum + s.score, 0) / totalSessions;
    const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);

    const progress = sessions.slice(-7).map(s => ({
      date: s.date,
      score: s.score
    }));

    res.json({
      totalSessions,
      averageScore: Math.round(averageScore),
      totalTime,
      progress
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
});

// AI Chat endpoint
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, history } = req.body;
    console.log('AI chat request received:', { message, historyLength: history?.length || 0 });

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get AI chat response
    const reply = await aiService.getChatResponse(message, history || []);
    console.log('AI chat response generated:', reply.substring(0, 100) + '...');

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Failed to get chat response', error: error.message });
  }
});

export default router;
