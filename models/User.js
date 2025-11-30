import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  achievements: [{
    achievementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Achievement'
    },
    unlockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  contacts: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  contactRequests: [{
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fromUsername: String,
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sentContactRequests: [{
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    toUsername: String,
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedMicroLessons: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MicroLesson'
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for better query performance (only add ones not already defined by schema options)
userSchema.index({ totalPoints: -1 });

export default mongoose.model('User', userSchema);