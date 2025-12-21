import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import MicroLesson from '../models/MicroLesson.js';
import User from '../models/User.js';

const router = express.Router();

// Get all micro-learning lessons
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get user with lessons to review
    const user = await User.findById(req.userId).populate('lessonsToReview.lessonId');
    
    // Get lessons that are due for review
    const today = new Date();
    const lessonsToReview = user.lessonsToReview
      .filter(review => review.dueDate <= today)
      .map(review => review.lessonId)
      .filter(lesson => lesson && lesson.isActive); // Ensure lesson exists and is active
    
    // Get all active lessons
    const allLessons = await MicroLesson.find({ isActive: true })
      .select('_id title description difficulty estimatedTime category')
      .sort({ createdAt: -1 });
    
    // Get user's completed lessons
    const completedLessonIds = user.completedMicroLessons.map(item => item.lessonId.toString());
    
    // Add completion status and review status to each lesson
    const lessonsWithStatus = allLessons.map(lesson => ({
      ...lesson.toObject(),
      completed: completedLessonIds.includes(lesson._id.toString()),
      dueForReview: lessonsToReview.some(reviewLesson => reviewLesson && reviewLesson._id && reviewLesson._id.toString() === lesson._id.toString())
    }));
    
    res.json({ 
      lessons: lessonsWithStatus,
      reviewCount: lessonsToReview.length
    });
  } catch (error) {
    console.error('Failed to fetch lessons:', error);
    res.status(500).json({ message: 'Failed to fetch lessons', error: error.message });
  }
});

// Get specific lesson by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const lesson = await MicroLesson.findById(req.params.id);
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    
    res.json({ lesson });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch lesson', error: error.message });
  }
});

// Mark lesson as completed
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const lesson = await MicroLesson.findById(req.params.id);
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    
    // Implement spaced repetition algorithm (SuperMemo SM-2)
    const quality = 5; // Default quality rating (0-5 scale)
    const now = new Date();
    
    // Calculate next review date using spaced repetition
    let interval = 1; // Default 1 day
    let easeFactor = 2.5; // Default ease factor
    let repetitions = 0;
    
    // Check if user already has this lesson in their completed list
    const user = await User.findById(req.userId);
    const existingLesson = user.completedMicroLessons.find(item => 
      item.lessonId && item.lessonId.toString() === lesson._id.toString()
    );
    
    if (existingLesson) {
      // Update existing lesson review data
      repetitions = existingLesson.repetitions + 1;
      
      if (quality < 3) {
        // If quality is poor, reset repetitions
        repetitions = 0;
        interval = 1;
      } else {
        if (repetitions === 1) {
          interval = 1;
        } else if (repetitions === 2) {
          interval = 6;
        } else {
          interval = Math.round(existingLesson.interval * existingLesson.easeFactor);
        }
        
        // Update ease factor
        easeFactor = existingLesson.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) easeFactor = 1.3;
      }
      
      // Update the existing lesson
      existingLesson.completedAt = now;
      existingLesson.reviewDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      existingLesson.interval = interval;
      existingLesson.easeFactor = easeFactor;
      existingLesson.repetitions = repetitions;
    } else {
      // Add new lesson to completed lessons
      user.completedMicroLessons.push({
        lessonId: lesson._id,
        completedAt: now,
        reviewDate: new Date(now.getTime() + interval * 24 * 60 * 60 * 1000),
        interval: interval,
        easeFactor: easeFactor,
        repetitions: repetitions
      });
    }
    
    // Add to lessons to review
    const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
    const existingReview = user.lessonsToReview.find(item => 
      item.lessonId && item.lessonId.toString() === lesson._id.toString()
    );
    
    if (existingReview) {
      existingReview.dueDate = dueDate;
    } else {
      user.lessonsToReview.push({
        lessonId: lesson._id,
        dueDate: dueDate
      });
    }
    
    // Award points for completing a lesson
    user.totalPoints += 10;
    
    // Check for streak bonus
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastLesson = user.completedMicroLessons
      .filter(item => item.completedAt)
      .sort((a, b) => b.completedAt - a.completedAt)[0];
      
    if (!lastLesson || new Date(lastLesson.completedAt).toDateString() !== yesterday.toDateString()) {
      // Streak broken, but still award points
      user.streak = 1;
    } else {
      // Continue streak
      user.streak = (user.streak || 0) + 1;
      
      // Bonus points for streaks
      if (user.streak >= 7) {
        user.totalPoints += 20; // Bonus for weekly streak
      } else if (user.streak >= 3) {
        user.totalPoints += 10; // Bonus for 3-day streak
      }
    }
    
    // Check for achievements
    const achievementUpdates = [];
    
    // First lesson achievement
    if (user.completedMicroLessons.length === 1) {
      achievementUpdates.push({
        achievementId: 'first_lesson',
        unlockedAt: now
      });
    }
    
    // 10 lessons achievement
    if (user.completedMicroLessons.length === 10) {
      achievementUpdates.push({
        achievementId: 'ten_lessons',
        unlockedAt: now
      });
    }
    
    if (achievementUpdates.length > 0) {
      user.achievements.push(...achievementUpdates);
    }
    
    await user.save();
    
    res.json({ 
      message: 'Lesson marked as completed',
      totalPoints: user.totalPoints,
      level: user.level,
      streak: user.streak,
      nextReviewDate: dueDate,
      interval: interval
    });
  } catch (error) {
    console.error('Failed to complete lesson:', error);
    res.status(500).json({ message: 'Failed to complete lesson', error: error.message });
  }
});

// Submit quiz answers
router.post('/:id/quiz', authMiddleware, async (req, res) => {
  try {
    const { answers } = req.body; // Array of selected answer indices
    const lesson = await MicroLesson.findById(req.params.id);
    
    if (!lesson || !lesson.isActive) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Invalid answers format' });
    }
    
    // Calculate score
    let correctAnswers = 0;
    const results = lesson.quizQuestions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      if (isCorrect) correctAnswers++;
      
      return {
        question: question.question,
        options: question.options,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      };
    });
    
    const score = Math.round((correctAnswers / lesson.quizQuestions.length) * 100);
    
    // Award bonus points for quiz completion
    let bonusPoints = 0;
    if (score >= 80) {
      bonusPoints = 5; // Extra points for high score
    } else if (score >= 60) {
      bonusPoints = 3;
    } else {
      bonusPoints = 1; // Encouragement points
    }
    
    // Update user with spaced repetition and gamification
    const user = await User.findById(req.userId);
    
    // Quality rating for spaced repetition (0-5 scale)
    const quality = Math.floor(score / 20); // Convert 0-100 score to 0-5 scale
    
    // Update spaced repetition data for this lesson
    const now = new Date();
    let interval = 1; // Default 1 day
    let easeFactor = 2.5; // Default ease factor
    let repetitions = 0;
    
    // Find the lesson in completed lessons
    const lessonEntry = user.completedMicroLessons.find(item => 
      item.lessonId && item.lessonId.toString() === lesson._id.toString()
    );
    
    if (lessonEntry) {
      // Update existing lesson review data based on quiz performance
      repetitions = lessonEntry.repetitions + 1;
      
      if (quality < 3) {
        // If quality is poor, reset repetitions
        repetitions = 0;
        interval = 1;
      } else {
        if (repetitions === 1) {
          interval = 1;
        } else if (repetitions === 2) {
          interval = 6;
        } else {
          interval = Math.round(lessonEntry.interval * lessonEntry.easeFactor);
        }
        
        // Update ease factor based on performance
        easeFactor = lessonEntry.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) easeFactor = 1.3;
      }
      
      // Update the lesson entry
      lessonEntry.reviewDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
      lessonEntry.interval = interval;
      lessonEntry.easeFactor = easeFactor;
      lessonEntry.repetitions = repetitions;
    }
    
    // Update lessons to review
    const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
    const existingReview = user.lessonsToReview.find(item => 
      item.lessonId && item.lessonId.toString() === lesson._id.toString()
    );
    
    if (existingReview) {
      existingReview.dueDate = dueDate;
    } else {
      user.lessonsToReview.push({
        lessonId: lesson._id,
        dueDate: dueDate
      });
    }
    
    // Award points
    user.totalPoints += bonusPoints;
    
    // Check for perfect score achievement
    if (score === 100) {
      const now = new Date();
      user.achievements.push({
        achievementId: 'perfect_score',
        unlockedAt: now
      });
    }
    
    // Quiz master achievement (10 quizzes)
    const quizCount = user.completedMicroLessons.filter(lesson => 
      lesson.repetitions > 0 // Count lessons that have been reviewed
    ).length;
    
    if (quizCount === 10) {
      user.achievements.push({
        achievementId: 'quiz_master',
        unlockedAt: new Date()
      });
    }
    
    await user.save();
    
    res.json({ 
      score,
      results,
      bonusPoints,
      message: `You scored ${score}% on the quiz!`,
      totalPoints: user.totalPoints,
      level: user.level,
      nextReviewDate: dueDate,
      interval: interval
    });
  } catch (error) {
    console.error('Failed to submit quiz:', error);
    res.status(500).json({ message: 'Failed to submit quiz', error: error.message });
  }
});

// Get lessons by category
router.get('/category/:category', authMiddleware, async (req, res) => {
  try {
    const lessons = await MicroLesson.find({ 
      category: req.params.category, 
      isActive: true 
    })
    .select('_id title description difficulty estimatedTime')
    .sort({ createdAt: -1 });
    
    // Get user's completed lessons
    const user = await User.findById(req.userId);
    const completedLessonIds = user.completedMicroLessons.map(item => item.lessonId.toString());
    
    // Add completion status to each lesson
    const lessonsWithStatus = lessons.map(lesson => ({
      ...lesson.toObject(),
      completed: completedLessonIds.includes(lesson._id.toString())
    }));
    
    res.json({ lessons: lessonsWithStatus });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch lessons', error: error.message });
  }
});

// Generate a new AI-powered micro lesson (admin only)
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { topic, category, difficulty } = req.body;
    
    if (!topic || !category || !difficulty) {
      return res.status(400).json({ message: 'Topic, category, and difficulty are required' });
    }
    
    // Generate content using AI service
    const aiContent = await aiService.getMicroLearningContent(topic);
    
    // Create new lesson
    const newLesson = new MicroLesson({
      title: aiContent.title || topic,
      description: aiContent.content || `Learn about ${topic}`,
      content: aiContent.content || `Detailed content about ${topic}`,
      category,
      difficulty,
      estimatedTime: 5, // Default time
      keyPoints: aiContent.keyPoints || [],
      practiceExercise: aiContent.practice || `Practice exercise for ${topic}`
    });
    
    await newLesson.save();
    
    res.status(201).json({ message: 'Lesson created successfully', lesson: newLesson });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate lesson', error: error.message });
  }
});

// Get lessons due for review
router.get('/review', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('lessonsToReview.lessonId');
    
    // Get lessons that are due for review
    const today = new Date();
    const lessonsToReview = user.lessonsToReview
      .filter(review => review.dueDate <= today && review.lessonId && review.lessonId.isActive)
      .map(review => ({
        ...review.lessonId.toObject(),
        dueDate: review.dueDate
      }));
    
    res.json({ lessons: lessonsToReview });
  } catch (error) {
    console.error('Failed to fetch review lessons:', error);
    res.status(500).json({ message: 'Failed to fetch review lessons', error: error.message });
  }
});

export default router;