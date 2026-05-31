from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
# from typing import TypedDict
from dotenv import load_dotenv
import os
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.output_parsers import StrOutputParser


    
load_dotenv()

from langchain_groq import ChatGroq

api_key = os.getenv("GROQ_API_KEY")
print("Initializing LLM...", api_key)

llm = ChatGroq(
    api_key=api_key,
    model="llama-3.1-8b-instant"
)


class Model(BaseModel):
    question: str
    correct_answer: str
    student_answer: str


class EvaluationResult(BaseModel):
    marks: int
    percentage: str
    normalized_score: float
    feedback: str

structured_llm = llm.with_structured_output(EvaluationResult)

prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """
You are an intelligent examiner.

Your task is to evaluate the student's answer based on:
1. Correctness
2. Completeness
3. Relevance

You will receive:
- Question
- Correct Answer
- Student Answer

Evaluation Rules:
- If the student answer is fully correct, give 100 marks.
- If the answer is completely wrong, give 0 marks.
- If the answer is partially correct, give marks between 0 and 100 based on correctness and completeness.
- Give fair partial marks.

Also calculate:
- percentage score
- final normalized score between 0 and 1

Return response ONLY in JSON format.

Example Output:
{{
    "marks": 75,
    "percentage": "75%",
    "normalized_score": 0.75,
    "feedback": "Student answer is partially correct but missed some important concepts."
}}
        """
    ),

    HumanMessagePromptTemplate.from_template(
        """
Question:
{question}

Correct Answer:
{correct_answer}

Student Answer:
{student_answer}
        """
    )
])



def evaluate_answer(state:Model):  
    question = state.question
    correct_answer = state.correct_answer
    student_answer = state.student_answer
    response = prompt.format_messages(
        question=question,
        correct_answer=correct_answer,
        student_answer=student_answer
    )
    output = structured_llm.invoke(response) 
    if output.marks<40:
        output.marks = 0
        output.percentage = "0%"
        output.normalized_score = 0.0
        output.feedback = "Student answer is completely wrong."
    return output

