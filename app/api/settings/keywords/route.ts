import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYWORDS_FILE = path.join(DATA_DIR, 'negative-keywords.json');

async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function loadKeywords(): Promise<string> {
  try {
    const raw = await readFile(KEYWORDS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return data.keywords || '';
  } catch {
    return '';
  }
}

async function saveKeywords(keywords: string) {
  await ensureDir();
  await writeFile(KEYWORDS_FILE, JSON.stringify({ keywords, updatedAt: new Date().toISOString() }), 'utf-8');
}

export async function GET() {
  const keywords = await loadKeywords();
  return NextResponse.json({ keywords });
}

export async function POST(request: NextRequest) {
  const { keywords } = await request.json();
  await saveKeywords(keywords || '');
  return NextResponse.json({ ok: true, keywords });
}
