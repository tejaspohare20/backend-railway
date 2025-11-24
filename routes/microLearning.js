import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import aiService from '../services/aiService.js';

const router = express.Router();

// Get micro-learning content
router.get('/', authMiddleware, async (req, res) => {
  try {
    const topics = [
      'Voice modulation',
      'Active listening',
      'Body language',
      'Storytelling techniques',
      'Handling objections',
      'Building rapport'
    ];

    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const content = await aiService.getMicroLearningContent(randomTopic);

    res.json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch content', error: error.message });
  }
});

// Get specific topic content
router.get('/:topic', authMiddleware, async (req, res) => {
  try {
    const content = await aiService.getMicroLearningContent(req.params.topic);
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch content', error: error.message });
  }
});

export default router;
