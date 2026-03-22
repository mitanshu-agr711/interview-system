import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GROQ_API_KEY; // Get from https://console.groq.com/keys

if (!apiKey) {
  throw new Error("GROQ_API_KEY is not defined in environment variables");
}

const groq = new Groq({ apiKey });

type InterviewQuestion = {
  question: string;
  correctAnswer: string;
};

const cleanJsonText = (text: string): string =>
  text.replace(/```json|```/g, "").trim();

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(cleanJsonText(text));
  } catch {
    return null;
  }
};

const normalizeQuestions = (candidate: unknown): InterviewQuestion[] => {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item: any) => {
      const question = typeof item?.question === "string" ? item.question.trim() : "";
      const correctAnswer =
        typeof item?.correctAnswer === "string"
          ? item.correctAnswer.trim()
          : typeof item?.answer === "string"
            ? item.answer.trim()
            : "";

      if (!question || !correctAnswer) {
        return null;
      }

      return { question, correctAnswer };
    })
    .filter((q: InterviewQuestion | null): q is InterviewQuestion => q !== null);
};

const extractQuestions = (parsed: any): InterviewQuestion[] => {
  const direct = normalizeQuestions(parsed);
  if (direct.length > 0) {
    return direct;
  }

  const list =
    parsed?.questions ??
    parsed?.data ??
    parsed?.items ??
    parsed?.interviewQuestions;

  const nested = normalizeQuestions(list);
  if (nested.length > 0) {
    return nested;
  }

  if (typeof list === "string") {
    const reparsed = tryParseJson(list);
    const stringQuestions = normalizeQuestions(reparsed);
    if (stringQuestions.length > 0) {
      return stringQuestions;
    }
  }

  return [];
};

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
    temperature: 0.2,
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

Return ONLY a JSON object in this exact format.
Do NOT add any explanation or extra text.

{
  "questions": [
    {
      "question": "question text here",
      "correctAnswer": "detailed correct answer here"
    }
  ]
}
`;

    let text = await generateWithGroq(prompt);

    const parsed = tryParseJson(text);
    if (!parsed) {
      throw new Error("Invalid JSON returned by Groq");
    }

    const questions = extractQuestions(parsed);
    if (questions.length === 0) {
      throw new Error("Invalid AI response format");
    }

    return questions.slice(0, count);

  } catch (error) {
    console.error("Error generating questions with Groq:", error);
    throw new Error("Failed to generate questions");
  }
};
