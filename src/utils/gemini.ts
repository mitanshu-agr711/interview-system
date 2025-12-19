import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GROQ_API_KEY; // Get from https://console.groq.com/keys

if (!apiKey) {
  throw new Error("GROQ_API_KEY is not defined in environment variables");
}

const groq = new Groq({ apiKey });

// No rate limiting needed - Groq is very generous
async function generateWithGroq(prompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that responds in JSON format."
      },
      {
        role: "user",
        content: prompt
      }
    ],
     model: "llama-3.3-70b-versatile", 
    temperature: 1,
    max_tokens: 8192,
    response_format: { type: "json_object" }
  });
  
  return response.choices[0].message.content || "";
}

export const evaluateAnswer = async (
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<{
  is_correct: boolean;
  short_reason: string;
  corrected_answer: string;
}> => {
  try {
    const prompt = `
Evaluate the correctness of a user's answer:

Question: ${question}
Correct answer: ${correctAnswer}
User answer: ${userAnswer}

Return JSON in this exact format:
{
  "is_correct": true/false,
  "short_reason": "brief explanation",
  "corrected_answer": "the correct answer"
}
`;

    let text = await generateWithGroq(prompt);
    text = text.replace(/```json|```/g, "").trim();
    return JSON.parse(text);
    
  } catch (err) {
    console.error("Groq Evaluate Error:", err);
    throw new Error("Failed to evaluate answer");
  }
};

export const generateInterviewQuestions = async (
  topic: string,
  count = 30
): Promise<Array<{ question: string; correctAnswer: string }>> => {
  try {
    const prompt = `
Generate exactly ${count} interview questions on the topic "${topic}".

Return ONLY a JSON array in this exact format.
Do NOT add any explanation or extra text.

[
  {
    "question": "question text here",
    "correctAnswer": "detailed correct answer here"
  }
]
`;

    let text = await generateWithGroq(prompt);

   
    text = text.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(text);

 
    const questions = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
        ? parsed.questions
        : null;

    if (!questions) {
      throw new Error("Invalid AI response format");
    }

   
    return questions.slice(0, count);

  } catch (error) {
    console.error("Error generating questions with Groq:", error);
    throw new Error("Failed to generate questions");
  }
};
