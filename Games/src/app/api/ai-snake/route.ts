import ZAI from 'z-ai-web-dev-sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json();
    const zai = await ZAI.create();

    let prompt = '';
    let maxTokens = 100;

    switch (type) {
      case 'tip':
        prompt = `You are a Snake game expert. Give ONE short, practical tip for playing Snake (2-3 sentences max). Be encouraging and specific. Examples: positioning strategies, corner avoidance, speed management.`;
        maxTokens = 80;
        break;
      
      case 'feedback':
        const { score, highScore, length } = data || {};
        const percentage = highScore > 0 ? Math.round((score / highScore) * 100) : 100;
        prompt = `A player just finished a Snake game. Score: ${score}, High Score: ${highScore}, Snake Length: ${length}. Give a brief encouraging reaction (2-3 sentences). If they beat their high score, celebrate! If score is ${percentage}% or more of high score, encourage them. Keep it fun and motivating!`;
        maxTokens = 100;
        break;
      
      case 'theme':
        prompt = `Generate a creative name for a Snake game color theme. Just respond with the theme name (2-4 words). Examples: "Neon Cyberpunk", "Ocean Depths", "Sunset Blaze", "Arctic Frost". Make it unique and evocative.`;
        maxTokens = 20;
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a fun, encouraging game assistant for MortApps Studios Snake game. Keep responses brief and engaging.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.8
    });

    const content = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ 
      success: true, 
      content: content.trim(),
      type 
    });

  } catch (error) {
    console.error('AI Snake API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to get AI response',
      fallback: getFallbackResponse()
    }, { status: 500 });
  }
}

function getFallbackResponse() {
  const tips = [
    "Keep your snake near the center to give yourself more reaction time!",
    "Try to create a pattern - it helps avoid trapping yourself!",
    "Move deliberately - speed isn't always your friend in tight spots!",
    "Watch where your tail is heading and plan your path accordingly!",
    "Corner yourself less by circling in wide patterns!"
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}
