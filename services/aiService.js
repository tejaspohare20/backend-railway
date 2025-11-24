import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

class AIService {
  async analyzeSpeech(transcript, duration) {
    try {
      const prompt = `
You are an expert speech coach analyzing a practice session. 
Analyze the following transcript and provide detailed feedback.

Transcript: "${transcript}"
Duration: ${duration} seconds

Provide a comprehensive analysis including:
1. Overall score (0-100)
2. Clarity assessment
3. Pace and rhythm feedback
4. Vocabulary usage
5. Confidence level
6. Filler words count
7. Specific improvement suggestions

Format your response as JSON with these fields:
{
  "score": number,
  "clarity": number (0-100),
  "pace": number (0-100),
  "vocabulary": number (0-100),
  "confidence": number (0-100),
  "fillerWords": number,
  "feedback": "detailed feedback text",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}
`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      
      const text = completion.choices[0].message.content;
      
      // Extract JSON from response (handle markdown code blocks if present)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      
      return JSON.parse(jsonText);

    } catch (error) {
      console.error('AI Analysis Error:', error);
      
      // Fallback response if AI fails
      return {
        score: 75,
        clarity: 70,
        pace: 75,
        vocabulary: 80,
        confidence: 70,
        fillerWords: 5,
        feedback: "Great practice session! Keep working on clarity and reducing filler words. Your vocabulary is good, and you're showing confidence in your delivery.",
        suggestions: [
          "Practice slowing down on key points",
          "Reduce filler words like 'um' and 'uh'",
          "Pause more intentionally between ideas"
        ]
      };
    }
  }

  async generatePracticeTopic() {
    try {
      const prompt = 'You are a creative speech coach. Generate an interesting speaking practice topic or scenario. Format your response as JSON with these fields: {"topic": "title", "description": "brief description", "tips": ["tip1", "tip2"]}';
      
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      });
      
      const text = completion.choices[0].message.content;
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Topic Generation Error:', error);
      return {
        topic: "Tell your success story",
        description: "Share a moment when you overcame a challenge and achieved something meaningful",
        tips: ["Start with context", "Build tension", "End with the lesson learned"]
      };
    }
  }

  async getMicroLearningContent(topic) {
    try {
      const prompt = `You are an expert communication teacher creating bite-sized learning content. Create a micro-learning lesson about: ${topic}. Format your response as JSON with these fields: {"title": "lesson title", "content": "brief content", "keyPoints": ["point1", "point2"], "practice": "exercise description"}`;
      
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      
      const text = completion.choices[0].message.content;
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Micro-learning Error:', error);
      return {
        title: topic,
        content: "Learn effective communication techniques",
        keyPoints: ["Clarity", "Confidence", "Connection"],
        practice: "Practice speaking clearly for 2 minutes"
      };
    }
  }

  async getChatResponse(message, history = []) {
    try {
      // Build messages array for OpenAI chat
      const messages = [
        {
          role: "system",
          content: "You are an expert communication coach and speaking assistant. Help users improve their speaking skills, answer questions about communication, and provide friendly, encouraging guidance. Keep responses concise and practical."
        }
      ];
      
      // Add conversation history
      if (history.length > 0) {
        history.forEach(msg => {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        });
      }
      
      // Add current message
      messages.push({ role: "user", content: message });
      
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.7,
      });
      
      const reply = completion.choices[0].message.content;
      
      return reply.trim();
    } catch (error) {
      console.error('Chat Response Error:', error);
      // Fallback to rule-based responses
      return this.getRuleBasedResponse(message);
    }
  }

  getRuleBasedResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Greeting responses
    if (lowerMessage.match(/\b(hi|hello|hey|greetings)\b/)) {
      return "Hello! I'm your AI communication coach. I'm here to help you improve your speaking skills. What would you like to work on today?";
    }
    
    // Public speaking
    if (lowerMessage.match(/\b(public speaking|presentation|speech)\b/)) {
      return "Great question about public speaking! Here are 3 key tips:\n\n1. **Practice thoroughly** - Know your material inside out\n2. **Start strong** - Hook your audience in the first 30 seconds\n3. **Use the power of pause** - Silence can be more powerful than words\n\nWould you like specific advice on any of these areas?";
    }
    
    // Confidence
    if (lowerMessage.match(/\b(confidence|confident|nervous|anxiety)\b/)) {
      return "Building speaking confidence takes practice! Here's what works:\n\n✓ Start with small, low-pressure situations\n✓ Record yourself and review (you're better than you think!)\n✓ Practice power poses before speaking\n✓ Remember: your audience wants you to succeed\n\nWhat specific situation makes you nervous?";
    }
    
    // Filler words
    if (lowerMessage.match(/\b(filler words|um|uh|like|you know)\b/)) {
      return "Reducing filler words is totally achievable! Try these techniques:\n\n1. **Pause instead** - When you feel 'um' coming, just pause\n2. **Slow down** - Filler words increase when we rush\n3. **Record & count** - Awareness is the first step\n4. **Practice deliberately** - Focus on one conversation at a time\n\nIt takes about 3 weeks of conscious practice to see improvement!";
    }
    
    // Interview
    if (lowerMessage.match(/\b(interview|job|career)\b/)) {
      return "Job interview success tips:\n\n📌 Research the company thoroughly\n📌 Prepare STAR stories (Situation, Task, Action, Result)\n📌 Practice your 2-minute 'tell me about yourself'\n📌 Prepare 3-5 good questions to ask them\n📌 Speak at 150-160 words per minute (not too fast!)\n\nWhat type of role are you interviewing for?";
    }
    
    // Voice/tone
    if (lowerMessage.match(/\b(voice|tone|speaking voice|sound)\b/)) {
      return "Your voice is a powerful tool! Here's how to improve it:\n\n🎤 Breathe from your diaphragm, not your chest\n🎤 Vary your pitch to maintain interest\n🎤 Record yourself - identify what you like\n🎤 Hydrate well before speaking\n🎤 Warm up with vocal exercises\n\nWould you like specific exercises to practice?";
    }
    
    // Tips/advice
    if (lowerMessage.match(/\b(tip|tips|advice|help|improve)\b/)) {
      return "Here are my top communication tips:\n\n1. **Practice active listening** - It makes you a better speaker\n2. **Know your audience** - Adapt your message to them\n3. **Use stories** - They're 22x more memorable than facts\n4. **Body language matters** - 55% of communication is nonverbal\n5. **Get feedback** - Record yourself or ask trusted friends\n\nWhat specific area would you like to focus on?";
    }
    
    // Body language
    if (lowerMessage.match(/\b(body language|gesture|posture|eye contact)\b/)) {
      return "Body language speaks volumes! Key points:\n\n👁️ **Eye contact**: 3-5 seconds per person in a group\n🤝 **Open posture**: No crossed arms, face the audience\n✋ **Gestures**: Use them naturally to emphasize points\n📏 **Space**: Don't hide behind podiums if possible\n😊 **Smile**: It makes you and others feel better\n\nWhat aspect would you like to work on?";
    }
    
    // Story telling
    if (lowerMessage.match(/\b(story|storytelling|narrative)\b/)) {
      return "Storytelling is a superpower! Use this structure:\n\n📖 **Hook**: Start with intrigue or emotion\n📖 **Context**: Set the scene briefly\n📖 **Conflict**: What was the challenge?\n📖 **Climax**: The turning point\n📖 **Resolution**: How it ended\n📖 **Lesson**: What did you/they learn?\n\nStories should be 60-90 seconds for maximum impact!";
    }
    
    // Thank you
    if (lowerMessage.match(/\b(thank|thanks|appreciate)\b/)) {
      return "You're welcome! I'm here to help you become a more confident communicator. Feel free to ask me anything about speaking, presentations, or communication skills. What else can I help you with?";
    }
    
    // Default response with helpful prompts
    return "I'm your communication coach! I can help you with:\n\n• Public speaking & presentations\n• Building confidence\n• Reducing filler words\n• Interview preparation\n• Voice & tone improvement\n• Body language\n• Storytelling techniques\n\nWhat would you like to work on? Ask me anything!";
  }
}

export default new AIService();
