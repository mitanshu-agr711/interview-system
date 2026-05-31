from fastapi import FastAPI
# from Pydantic import BaseModel
from llm import Model, evaluate_answer

from llm import prompt
app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Welcome to the Evaluation API"}

@app.post("/evaluate")
async def evaluate(data: Model):
    print("hello")
    return evaluate_answer(data)
    