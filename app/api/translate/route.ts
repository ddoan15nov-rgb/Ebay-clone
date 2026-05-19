import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache to avoid redundant translation calls
const translationCache = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Thiếu nội dung cần dịch' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = text.substring(0, 200); // use first 200 chars as key
    if (translationCache.has(cacheKey)) {
      return NextResponse.json({
        translatedText: translationCache.get(cacheKey),
        cached: true,
      });
    }

    // Use Gemini API for context-aware translations
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Thiếu GEMINI_API_KEY trong cấu hình');
    }

    const prompt = `You are an expert translator for eBay gold scrap, jewelry, and e-waste listings. Translate the following English text to Vietnamese. Use terminology appropriate for Vietnamese gold recovery and scrap buyers (e.g., 'Gold filled' = 'Bọc vàng', 'Scrap' = 'Phế liệu', 'Yield' = 'Tỷ lệ thu hồi', 'As-is' = 'Bán theo tình trạng hiện tại', 'Untested' = 'Chưa qua kiểm tra').

IMPORTANT: The text below contains HTML markup. You MUST preserve all HTML tags, structure, classes, attributes, and styling perfectly. ONLY translate the visible text content inside the tags. Do not strip, alter, or break the HTML layout. Return ONLY the final HTML.

Text to translate:
${text}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent translation
        }
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API Error:', errText);
      throw new Error(`Translation failed: ${res.status}`);
    }

    const data = await res.json();
    
    let translatedText = '';
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      translatedText = data.candidates[0].content.parts[0].text.trim();
    }

    if (!translatedText) {
      throw new Error('Empty translation result from Gemini');
    }

    // Cache the result
    translationCache.set(cacheKey, translatedText);

    // Keep cache size manageable
    if (translationCache.size > 500) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }

    return NextResponse.json({
      translatedText,
      cached: false,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Không thể dịch. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
