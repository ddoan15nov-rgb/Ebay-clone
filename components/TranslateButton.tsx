'use client';

import React, { useState } from 'react';
import { Globe, RotateCcw, Loader2 } from 'lucide-react';

interface TranslateButtonProps {
  text: string;
  onTranslated: (translatedText: string) => void;
  onReset: () => void;
  isTranslated: boolean;
}

export default function TranslateButton({
  text,
  onTranslated,
  onReset,
  isTranslated,
}: TranslateButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (isTranslated) {
      onReset();
      return;
    }

    setLoading(true);
    try {
      // Strip HTML tags for translation
      const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText }),
      });

      const data = await res.json();

      if (data.translatedText) {
        onTranslated(data.translatedText);
      } else {
        alert(data.error || 'Không thể dịch');
      }
    } catch {
      alert('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`translate-btn ${isTranslated ? 'translated' : ''}`}
      onClick={handleTranslate}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={14} style={{ animation: 'spin 0.6s linear infinite' }} />
      ) : isTranslated ? (
        <RotateCcw size={14} />
      ) : (
        <Globe size={14} />
      )}
      {loading
        ? 'Đang dịch...'
        : isTranslated
          ? 'Xem bản gốc'
          : 'Dịch sang Tiếng Việt'}
    </button>
  );
}
