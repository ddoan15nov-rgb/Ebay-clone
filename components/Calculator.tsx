'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Delete, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalculatorProps {
  open: boolean;
  onClose: () => void;
  initialValue?: string;
}

interface HistoryEntry {
  expression: string;
  result: string;
}

export default function Calculator({ open, onClose, initialValue }: CalculatorProps) {
  const [expression, setExpression] = useState(initialValue || '0');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const displayRef = React.useRef<HTMLDivElement>(null);

  // Sync cursor with external changes
  useEffect(() => {
    if (initialValue) {
      setCursorPos(initialValue.length);
    }
  }, [initialValue]);

  // Auto-scroll history to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      if (displayRef.current) {
        displayRef.current.scrollTop = displayRef.current.scrollHeight;
      }
    }, 10);
  };

  // Safely evaluate the expression
  const evaluate = (expr: string): number | null => {
    try {
      let sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');
      sanitized = sanitized.replace(/[+\-*/. ]+$/, '');
      if (!sanitized) return null;
      if (/[^0-9+\-*/.() ]/.test(sanitized)) return null;
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) return null;
      return Math.round(result * 10000) / 10000;
    } catch {
      return null;
    }
  };

  const moveCursor = useCallback((delta: number) => {
    if (isCalculated) setIsCalculated(false);
    setCursorPos((prev) => {
      const current = prev === null ? expression.length : prev;
      let next = current + delta;
      
      // Skip over spaces around operators " + " (3 chars)
      if (delta < 0 && expression.charAt(next) === ' ' && next >= 2) {
        next -= 2;
      } else if (delta > 0 && expression.charAt(next - 1) === ' ' && next <= expression.length - 2) {
        next += 2;
      }
      
      return Math.max(0, Math.min(expression.length, next));
    });
  }, [expression, isCalculated]);

  const insertText = useCallback((text: string) => {
    if (isCalculated) {
      setExpression(text);
      setCursorPos(text.length);
      setIsCalculated(false);
      return;
    }
    setExpression((prev) => {
      if (prev === '0' && text !== '.' && text !== ' ' && !text.match(/[+−×÷]/)) {
        setCursorPos(text.length);
        return text;
      }
      const c = cursorPos === null ? prev.length : cursorPos;
      const newExpr = prev.slice(0, c) + text + prev.slice(c);
      setCursorPos(c + text.length);
      return newExpr;
    });
  }, [cursorPos, isCalculated]);

  const inputDigit = useCallback((digit: string) => {
    insertText(digit);
  }, [insertText]);

  const inputDot = useCallback(() => {
    if (isCalculated) {
      setExpression('0.');
      setCursorPos(2);
      setIsCalculated(false);
      return;
    }
    const c = cursorPos === null ? expression.length : cursorPos;
    const beforeCursor = expression.slice(0, c);
    const segments = beforeCursor.split(/[ +−×÷]/);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment.includes('.')) {
      insertText('.');
    }
  }, [expression, cursorPos, isCalculated, insertText]);

  const handleBackspace = useCallback(() => {
    if (isCalculated) {
      setExpression('0');
      setCursorPos(null);
      setIsCalculated(false);
      return;
    }
    setExpression((prev) => {
      const c = cursorPos === null ? prev.length : cursorPos;
      if (c === 0) return prev; // nothing to delete
      
      // Handle trailing spaces around operators
      if (prev.charAt(c - 1) === ' ' && c >= 3) {
        setCursorPos(c - 3);
        const newExpr = prev.slice(0, c - 3) + prev.slice(c);
        return newExpr === '' ? '0' : newExpr;
      } else {
        setCursorPos(c - 1);
        const newExpr = prev.slice(0, c - 1) + prev.slice(c);
        return newExpr === '' ? '0' : newExpr;
      }
    });
  }, [cursorPos, isCalculated]);

  const handleOperator = useCallback((op: string) => {
    insertText(` ${op} `);
  }, [insertText]);

  const handleEquals = useCallback(() => {
    const result = evaluate(expression);
    if (result !== null) {
      setHistory((prev) => [...prev, { expression, result: String(result) }]);
      setExpression(String(result));
      setCursorPos(String(result).length);
      setIsCalculated(true);
      scrollToBottom();
    }
  }, [expression]);

  const handleClear = useCallback(() => {
    setExpression('0');
    setCursorPos(null);
    setIsCalculated(false);
  }, []);

  const handleAllClear = useCallback(() => {
    setExpression('0');
    setCursorPos(null);
    setHistory([]);
    setIsCalculated(false);
  }, []);

  const handlePercent = useCallback(() => {
    if (isCalculated) {
      const result = evaluate(expression);
      if (result !== null) {
        const percentResult = Math.round((result / 100) * 10000) / 10000;
        setHistory((prev) => [...prev, { expression: `${expression}%`, result: String(percentResult) }]);
        setExpression(String(percentResult));
        setCursorPos(null);
        setIsCalculated(true);
        scrollToBottom();
      }
      return;
    }

    // Contextual percentage parsing
    setExpression((prev) => {
      const c = cursorPos === null ? prev.length : cursorPos;
      const beforeCursor = prev.slice(0, c);
      const afterCursor = prev.slice(c);

      const match = beforeCursor.match(/(.*[+−×÷] *|^)([0-9.]+)$/);
      if (!match) {
        const baseValue = evaluate(beforeCursor);
        if (baseValue !== null) {
           const percentVal = baseValue / 100;
           setCursorPos(String(percentVal).length);
           return String(percentVal) + afterCursor;
        }
        return prev;
      }

      const precedingExpr = match[1].trim();
      const lastNumberStr = match[2];
      const lastNumber = parseFloat(lastNumberStr);

      if (!precedingExpr) {
        const percentVal = lastNumber / 100;
        const newStr = String(percentVal);
        setCursorPos(newStr.length);
        return newStr + afterCursor;
      } else {
        const operator = precedingExpr.slice(-1);
        const baseExpr = precedingExpr.slice(0, -1).trim();

        const baseValue = evaluate(baseExpr);
        if (baseValue !== null) {
          let percentVal = 0;
          if (operator === '+' || operator === '−') {
            percentVal = baseValue * (lastNumber / 100);
          } else {
            percentVal = lastNumber / 100;
          }
          
          percentVal = Math.round(percentVal * 10000) / 10000;
          const newExpr = `${baseExpr} ${operator} ${percentVal}`;
          setCursorPos(newExpr.length);
          return newExpr + afterCursor;
        }
      }
      return prev;
    });
  }, [cursorPos, isCalculated, expression]);

  // Tap a history result to reuse it
  const reuseResult = useCallback((result: string) => {
    setExpression(result);
    setIsCalculated(false);
  }, []);

  if (!open) return null;

  const liveResult = evaluate(expression);

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 12,
    fontSize: '1.2rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
    height: 52,
    WebkitTapHighlightColor: 'transparent',
  };

  const numBtn: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
  };

  const opBtn: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(212, 175, 55, 0.2)',
    color: 'var(--gold)',
  };

  const eqBtn: React.CSSProperties = {
    ...btnBase,
    background: 'var(--gold)',
    color: '#000',
    fontWeight: 700,
  };

  const fnBtn: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Calculator Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 201,
          background: 'var(--bg)',
          borderRadius: '20px 20px 0 0',
          padding: '16px 16px calc(var(--safe-bottom, 0px) + 12px)',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        {/* Handle + close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Máy tính</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Cursor Navigation */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button 
                onClick={() => moveCursor(-1)} 
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => moveCursor(1)} 
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            {history.length > 0 && (
              <button
                onClick={handleAllClear}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', fontSize: '0.65rem', padding: '2px 6px',
                }}
              >
                Xóa lịch sử
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Multi-line Display */}
        <div
          ref={displayRef}
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 12,
            minHeight: 110,
            maxHeight: 180,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* History lines */}
          {history.map((entry, i) => (
            <div key={i} style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '0.72rem',
                color: 'var(--text-dim)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}>
                {entry.expression}
              </div>
              <div
                onClick={() => reuseResult(entry.result)}
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  marginBottom: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                = {entry.result}
              </div>
            </div>
          ))}

          {/* Current expression */}
          <div style={{ textAlign: 'right', marginTop: history.length > 0 ? 4 : 'auto' }}>
            <div style={{
              fontSize: expression.length > 20 ? '1.2rem' : expression.length > 12 ? '1.5rem' : '1.8rem',
              fontWeight: 500,
              color: '#fff',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              lineHeight: 1.3,
            }}>
              {expression.slice(0, cursorPos === null ? expression.length : cursorPos)}
              {!isCalculated && (
                <span style={{ 
                  borderRight: '2px solid var(--gold)', 
                  marginRight: '-2px',
                  animation: 'blink 1s step-end infinite' 
                }} />
              )}
              {expression.slice(cursorPos === null ? expression.length : cursorPos)}
            </div>
            {/* Live preview */}
            {!isCalculated && liveResult !== null && String(liveResult) !== expression && (
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--gold)',
                fontFamily: 'monospace',
                opacity: 0.7,
                marginTop: 2,
              }}>
                = {liveResult}
              </div>
            )}
          </div>
        </div>

        {/* Button Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          <button style={{...fnBtn, color: expression === '0' ? '#ef4444' : fnBtn.color}} onClick={expression === '0' ? handleAllClear : handleClear}>
            {expression === '0' ? 'AC' : 'C'}
          </button>
          <button style={fnBtn} onClick={() => inputDigit('(')}>(</button>
          <button style={fnBtn} onClick={() => inputDigit(')')}>)</button>
          <button style={fnBtn} onClick={handleBackspace}><Delete size={18} /></button>

          <button style={numBtn} onClick={() => inputDigit('7')}>7</button>
          <button style={numBtn} onClick={() => inputDigit('8')}>8</button>
          <button style={numBtn} onClick={() => inputDigit('9')}>9</button>
          <button style={opBtn} onClick={() => handleOperator('÷')}>÷</button>

          <button style={numBtn} onClick={() => inputDigit('4')}>4</button>
          <button style={numBtn} onClick={() => inputDigit('5')}>5</button>
          <button style={numBtn} onClick={() => inputDigit('6')}>6</button>
          <button style={opBtn} onClick={() => handleOperator('×')}>×</button>

          <button style={numBtn} onClick={() => inputDigit('1')}>1</button>
          <button style={numBtn} onClick={() => inputDigit('2')}>2</button>
          <button style={numBtn} onClick={() => inputDigit('3')}>3</button>
          <button style={opBtn} onClick={() => handleOperator('−')}>−</button>

          <button style={numBtn} onClick={() => inputDigit('0')}>0</button>
          <button style={numBtn} onClick={inputDot}>.</button>
          <button style={fnBtn} onClick={handlePercent}>%</button>
          <button style={opBtn} onClick={() => handleOperator('+')}>+</button>

          <button style={{ ...eqBtn, gridColumn: 'span 4' }} onClick={handleEquals}>=</button>
        </div>
      </div>
    </>
  );
}
