
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async getEarningStrategy(pendingAmt: number, withdrawableAmt: number, taskCount: number) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I have ₹${pendingAmt} pending and ₹${withdrawableAmt} withdrawable. I have completed ${taskCount} tasks. Give me a short, 2-sentence motivational tip to earn more on this app.`,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return response.text || "Keep completing tasks to reach your goals!";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Unlock your potential by completing high-reward tasks daily!";
    }
  }

  async analyzeTaskOpportunity(taskTitle: string, taskPrice: number) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this earning opportunity: "${taskTitle}" for ₹${taskPrice}. Is it a good deal compared to average microtasks? Keep it under 15 words.`,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return response.text || "Great opportunity! Complete it now.";
    } catch (error) {
      return "Solid reward for the effort required.";
    }
  }
}

export const geminiService = new GeminiService();
