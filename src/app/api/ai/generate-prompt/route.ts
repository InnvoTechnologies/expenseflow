import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Get the session from the auth API
    const cookieHeader = req.headers.get("cookie") || "";
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    // Check if user is authenticated
    if (!session || !session.user?.id) {
      return NextResponse.json({
        status: 401,
        message: 'Unauthorized: You must be logged in to generate AI prompts',
      }, { status: 401 });
    }

    const body = await req.json();
    const { details, agentName, agentDescription } = body;

    if (!details || typeof details !== 'string' || details.trim().length === 0) {
      return NextResponse.json({
        status: 400,
        message: 'Details are required to generate a prompt',
      }, { status: 400 });
    }

    // Check if GROQ_API_KEY is available
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({
        status: 500,
        message: 'AI service is not configured',
      }, { status: 500 });
    }

    // Prepare the prompt for Groq
    const systemPrompt = `You are an expert AI assistant creator. Your task is to generate a detailed, professional system prompt for an AI agent based on the user's requirements.

The user wants to create an AI agent with these details:
${details}

${agentName ? `Agent Name: ${agentName}` : ''}
${agentDescription ? `Agent Description: ${agentDescription}` : ''}

Please generate a comprehensive system prompt that includes:
1. Clear role definition
2. Specific behaviors and personality traits
3. Guidelines for interactions
4. Any special instructions or constraints
5. Professional tone and helpful demeanor

The prompt should be detailed but not overly verbose. Focus on creating an effective system prompt that will guide the AI to perform well in its intended role.`;

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b', // Using Llama 3 8B model
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Generate a system prompt for an AI agent based on these requirements: ${details}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      console.error('Groq API error:', groqResponse.status, groqResponse.statusText);
      return NextResponse.json({
        status: 500,
        message: 'Failed to generate prompt with AI service',
      }, { status: 500 });
    }

    const groqData = await groqResponse.json();
    const generatedPrompt = groqData.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      return NextResponse.json({
        status: 500,
        message: 'Failed to generate prompt - no content received',
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 200,
      data: {
        prompt: generatedPrompt.trim(),
      },
      message: 'AI prompt generated successfully',
    });
  } catch (error) {
    console.error('Failed to generate AI prompt:', error);
    return NextResponse.json({
      status: 500,
      message: 'Internal Server Error',
    }, { status: 500 });
  }
}
