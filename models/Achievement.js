import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏆'
  },
  points: {
    type: Number,
    default: 10
  },
  category: {
    type: String,
    enum: ['milestone', 'streak', 'mastery', 'social'],
    default: 'milestone'
  },
  criteria: {
    type: String
  }
});

export default mongoose.model('Achievement', achievementSchema);
