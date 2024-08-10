// We’ll now create an API route that will handle communication between our frontend and the OpenAI API. This file will process incoming chat messages and stream the AI’s responses back to the client.

import { NextResponse } from "next/server";  //import next response from next.js for handleing responses 
import OpenAI from 'openai' //import the openAI libarary for interacting with the OpenAI API
const systemPrompt = 'You are a friendly and knowledgeable customer support bot for HeadstartAI, a platform that offers AI-driven interviews for Software Engineer jobs. Your role is to assist users with any questions they have about the platform, including how to schedule interviews, prepare for assessments, understand AI feedback, and troubleshoot common technical issues. Provide clear, concise, and helpful answers while maintaining a professional yet approachable tone. If users need further assistance, guide them on how to contact human support.'

//POST function to handle incoming requests
export async function POST(req){
    const openai = new OpenAI() // new instance of the OpenAI client 
    const data = await req.json() // pares the json body of the incoming request 
    // create a chat completeion request to the openAI API 
    const completion = await openai.chat.completion.create({
        messages : [{role:'system', content:systemPrompt}, ...data],
        model:'gpt-4o-mini', // specify the model to use
        stream:true // enable streaming responses in real time 
    })
}