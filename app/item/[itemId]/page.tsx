'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Heart,
  Ban,
  ExternalLink,
  User,
  Star,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Share2,
  Calculator as CalcIcon,
} from 'lucide-react';
import { EbayItemDetail } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';
import { useFavorites, useBlockedSellers } from '@/hooks/useLocalStorage';
import BidPanel from '@/components/BidPanel';
import TranslateButton from '@/components/TranslateButton';
import Calculator from '@/components/Calculator';

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const router = useRouter();

  const [item, setItem] = useState<EbayItemDetail & { source?: string; stubError?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Touch swipe tracking for image gallery
  const touchRef = React.useRef<{ startX: number; startY: number; swiped: boolean } | null>(null);
  const [translated, setTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);

  const { toggleFavorite, isFavorite, isLoaded: isFavLoaded } = useFavorites();
  const { blockSeller } = useBlockedSellers();

  useEffect(() => {
    document.body.classList.add('no-tab-bar');
    return () => document.body.classList.remove('no-tab-bar');
  }, []);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`/api/ebay/item/${itemId}`);
        const data = await res.json();
        setItem(data);
      } catch {
        console.error('Failed to fetch item');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [itemId]);

  // Smart Polling Effect
  useEffect(() => {
    if (!item?.endTime) return;

    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      const now = new Date().getTime();
      const end = new Date(item.endTime!).getTime();
      const timeLeft = end - now;

      if (timeLeft <= 840000 && timeLeft > -60000) {
        try {
          const res = await fetch(`/api/ebay/item/${item.itemId}?t=${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            setItem(prev => prev ? { ...prev, price: data.price, bidCount: data.bidCount, endTime: data.endTime, isSold: data.isSold, winner: data.winner } : null);
          }
        } catch {}
      }

      if (timeLeft > 0 && timeLeft <= 840000) {
        const interval = timeLeft <= 30000 ? 1000 : 10000;
        timeoutId = setTimeout(poll, interval);
      }
    };

    const now = new Date().getTime();
    const end = new Date(item.endTime).getTime();
    const timeLeft = end - now;
    if (timeLeft > 0 && timeLeft <= 840000) {
      const interval = timeLeft <= 30000 ? 1000 : 10000;
      timeoutId = setTimeout(poll, interval);
    }

    return () => clearTimeout(timeoutId);
  }, [item?.endTime, item?.itemId]);

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '80dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Stub case: real eBay item pasted but API couldn't load full details
  if (item && (item as { source?: string }).source === 'stub') {
    const ebayUrl = `https://www.ebay.com/itm/${itemId}`;
    return (
      <div className="page-container" style={{ paddingTop: 24 }}>
        <button
          className="btn-ghost"
          onClick={() => router.back()}
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={18} /> Quay lại
        </button>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>eBay Item #{itemId}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            Chưa thể tải thông tin sản phẩm — nhấn nút bên dưới để xem trên eBay
          </p>
          <a
            href={ebayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gold"
            style={{ textDecoration: 'none', display: 'inline-flex' }}
          >
            <ExternalLink size={16} />
            Xem trên eBay
          </a>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page-container">
        <button className="btn-ghost" onClick={() => router.back()}>
          <ArrowLeft size={20} /> Quay lại
        </button>
        <div className="empty-state">
          <p>Không tìm thấy sản phẩm</p>
        </div>
      </div>
    );
  }

  const images = item.images?.length ? item.images : [item.imageUrl];
  const fav = isFavorite(item.itemId);

  const handleShare = async () => {
    const shareUrl = item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`;
    const shareData = {
      title: item.title,
      text: `$${item.price} - ${item.title}`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link đã được sao chép!');
      }
    } catch { /* user cancelled share */ }
  };

  return (
    <>
      {/* Fixed floating buttons — always visible when scrolling */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(12px + var(--safe-top))',
          left: 12,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: 'none',
            color: 'white',
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} />
        </button>
      </div>
      <div
        style={{
          position: 'fixed',
          top: 'calc(12px + var(--safe-top))',
          right: 12,
          zIndex: 50,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={handleShare}
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: 'none',
            color: 'white',
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Share2 size={16} />
        </button>
        {isFavLoaded && (
          <button
            onClick={() => toggleFavorite(item.itemId)}
            style={{
              background: fav ? 'rgba(231, 76, 60, 0.85)' : 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              border: 'none',
              color: 'white',
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <Heart size={18} fill={fav ? '#fff' : 'none'} color="#fff" />
          </button>
        )}
      </div>

      <div className="page-transition-detail" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        {/* Image gallery */}
        <div style={{ position: 'relative', background: 'var(--surface)' }}>

          {/* Main image — swipeable */}
          <div
            onTouchStart={(e) => {
              const touch = e.touches[0];
              touchRef.current = { startX: touch.clientX, startY: touch.clientY, swiped: false };
            }}
            onTouchMove={(e) => {
              if (!touchRef.current) return;
              const dx = e.touches[0].clientX - touchRef.current.startX;
              const dy = e.touches[0].clientY - touchRef.current.startY;
              // If horizontal movement is dominant and exceeds threshold, mark as swipe
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && !touchRef.current.swiped) {
                touchRef.current.swiped = true;
                if (dx < 0 && activeImage < images.length - 1) {
                  setActiveImage(prev => prev + 1);
                } else if (dx > 0 && activeImage > 0) {
                  setActiveImage(prev => prev - 1);
                }
              }
            }}
            onTouchEnd={() => {
              const wasSwiped = touchRef.current?.swiped;
              touchRef.current = null;
              // Only open zoom if it wasn't a swipe
              if (!wasSwiped) return;
            }}
            onClick={() => {
              // Only open zoom if last touch wasn't a swipe
              if (!touchRef.current?.swiped) setZoomOpen(true);
            }}
            style={{
              width: '100%',
              paddingTop: '100%',
              position: 'relative',
              cursor: 'zoom-in',
              touchAction: 'pan-y',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[activeImage]}
              alt={item.title}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transition: 'opacity 0.2s ease',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Image nav dots */}
          {images.length > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 0 12px',
              }}
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  style={{
                    width: i === activeImage ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === activeImage ? 'var(--gold)' : 'var(--text-dim)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="page-container">
          {/* Title + Price */}
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4, marginBottom: 8 }}>
            {item.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold)' }}>
              ${item.price}
            </span>
            {item.bidCount !== undefined && item.bidCount > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {item.bidCount} lượt đấu
              </span>
            )}
            {item.shippingCost && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                + ${item.shippingCost} ship
              </span>
            )}
          </div>
          
          {item.isSold && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(46, 204, 113, 0.15)', color: 'var(--success)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, marginBottom: 12 }}>
              🏆 Đã Bán
            </div>
          )}

          {/* Timer */}
          <ItemTimer endTime={item.endTime} listingType={item.listingType} />

          {/* Seller info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
            }}
          >
            <User size={16} color="var(--text-muted)" />
            <div style={{ flex: 1 }}>
              <a href={`/seller/${encodeURIComponent(item.seller.username)}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)', textDecoration: 'none' }}>
                {item.seller.username} →
              </a>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={10} color="var(--gold)" fill="var(--gold)" />
                  {item.seller.feedbackPercentage}% ({item.seller.feedbackScore})
                </span>
                {item.itemLocation && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} />
                    {item.itemLocation}
                  </span>
                )}
              </div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                if (confirm(`Chặn người bán "${item.seller.username}"?`)) {
                  blockSeller(item.seller.username);
                  router.back();
                }
              }}
            >
              <Ban size={16} />
            </button>
          </div>

          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <a
              href={item.itemWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
            >
              <ExternalLink size={14} />
              eBay
            </a>
            <button
              className="btn btn-outline"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setCalcOpen(true)}
            >
              <CalcIcon size={14} />
              Máy tính
            </button>
            {item.buyingOptions?.includes('BEST_OFFER') && (
              <a
                href={`https://offer.ebay.com/ws/eBayISAPI.dll?MakeBid&item=${item.itemId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gold"
                style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}
              >
                Trả Giá
              </a>
            )}
          </div>

          {/* Gixen Bid Panel */}
          {item.listingType !== 'FIXED_PRICE' && (
            <BidPanel itemId={item.itemId} currentPrice={item.price} title={item.title} endTime={item.endTime} />
          )}

          {/* Description */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Mô tả</h2>
              <TranslateButton
                text={item.description || ''}
                onTranslated={(text) => {
                  setTranslatedText(text);
                  setTranslated(true);
                }}
                onReset={() => setTranslated(false)}
                isTranslated={translated}
              />
            </div>

            <div
              style={{
                padding: 14,
                background: 'var(--surface)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
              }}
            >
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: translated ? translatedText : (item.description || 'Không có mô tả') 
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomOpen && (
        <ZoomableImageViewer
          images={images}
          activeIndex={activeImage}
          onChangeIndex={setActiveImage}
          onClose={() => setZoomOpen(false)}
          title={item.title}
        />
      )}
      {/* Calculator Bottom Sheet */}
      <Calculator
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        initialValue={String(
          Math.round(
            (parseFloat(item?.price || '0') + parseFloat(item?.shippingCost || '0')) * 100
          ) / 100
        )}
      />

    </>
  );
}

// Sub-component for the timer
function ItemTimer({ endTime, listingType }: { endTime: string; listingType: string }) {
  const { display, isEnded } = useCountdown(endTime);

  if (!endTime) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        background: isEnded ? 'rgba(231,76,60,0.1)' : 'var(--gold-glow)',
        marginBottom: 12,
      }}
    >
      <Clock size={16} color={isEnded ? 'var(--danger)' : 'var(--gold)'} />
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isEnded ? 'var(--danger)' : 'var(--gold)' }}>
        {isEnded ? 'Đã kết thúc' : `Kết thúc sau ${display}`}
      </span>
      {listingType === 'FIXED_PRICE' && (
        <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Mua Ngay</span>
      )}
    </div>
  );
}

// ──── Zoomable Image Viewer ────
// Supports: pinch-to-zoom, pan when zoomed, swipe when not zoomed, double-tap
// Supports: pinch-to-zoom, pan when zoomed, swipe when not zoomed, double-tap
function ZoomableImageViewer({
  images,
  activeIndex,
  onChangeIndex,
  onClose,
  title,
}: {
  images: string[];
  activeIndex: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
  title: string;
}) {
  const [scale, setScale] = React.useState(1);
  const [translate, setTranslate] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Clamp translate so image edges can't go past the viewport
  const clampTranslate = (tx: number, ty: number, s: number) => {
    if (s <= 1.05) return { x: 0, y: 0 };
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return { x: tx, y: ty };

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    // Get the displayed image size (before scale)
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const imgRatio = iw / ih;
    const containerRatio = cw / ch;
    let displayW: number, displayH: number;
    if (imgRatio > containerRatio) {
      displayW = cw;
      displayH = cw / imgRatio;
    } else {
      displayH = ch;
      displayW = ch * imgRatio;
    }

    // Max pan = (scaled size - container size) / 2
    const maxX = Math.max(0, (displayW * s - cw) / 2);
    const maxY = Math.max(0, (displayH * s - ch) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(maxY, Math.max(-maxY, ty)),
    };
  };

  // Refs for gesture tracking
  const gestureRef = React.useRef<{
    type: 'none' | 'pan' | 'pinch' | 'swipe';
    startX: number;
    startY: number;
    startScale: number;
    startDist: number;
    startTranslate: { x: number; y: number };
    lastTap: number;
    moved: boolean;
  }>({
    type: 'none',
    startX: 0,
    startY: 0,
    startScale: 1,
    startDist: 0,
    startTranslate: { x: 0, y: 0 },
    lastTap: 0,
    moved: false,
  });

  // Reset zoom when switching images
  React.useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [activeIndex]);

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    g.moved = false;

    if (e.touches.length === 2) {
      e.preventDefault();
      g.type = 'pinch';
      g.startDist = getTouchDistance(e.touches);
      g.startScale = scale;
      g.startTranslate = { ...translate };
    } else if (e.touches.length === 1) {
      g.startX = e.touches[0].clientX;
      g.startY = e.touches[0].clientY;
      g.startTranslate = { ...translate };
      g.type = scale > 1.05 ? 'pan' : 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;

    if (e.touches.length === 2 && g.type === 'pinch') {
      e.preventDefault();
      const newDist = getTouchDistance(e.touches);
      const distRatio = newDist / g.startDist;
      // Dampen the zoom ratio so it feels smoother and less sensitive
      const dampedRatio = 1 + (distRatio - 1) * 0.7; 
      const newScale = Math.min(5, Math.max(1, g.startScale * dampedRatio));
      setScale(newScale);
      
      // Reset translate if zoomed all the way out
      if (newScale <= 1.05) {
        setTranslate({ x: 0, y: 0 });
      }
      g.moved = true;
      return;
    }

    if (e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - g.startX;
    const dy = e.touches[0].clientY - g.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (scale > 1.05) {
      e.preventDefault();
      g.type = 'pan';
      const raw = { x: g.startTranslate.x + dx, y: g.startTranslate.y + dy };
      setTranslate(clampTranslate(raw.x, raw.y, scale));
      g.moved = true;
    } else if (g.type !== 'swipe' && (absDx > 15 || absDy > 15)) {
      g.type = 'swipe';
      g.moved = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current;

    // Double-tap detection
    if (!g.moved && e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - g.lastTap < 300) {
        // Double tap → toggle zoom
        if (scale > 1.05) {
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        } else {
          setScale(3);
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const tapX = e.changedTouches[0].clientX - rect.left - rect.width / 2;
          const tapY = e.changedTouches[0].clientY - rect.top - rect.height / 2;
          setTranslate({ x: -tapX * 2, y: -tapY * 2 });
        }
        g.lastTap = 0;
      } else {
        g.lastTap = now;
      }
    }

    // Swipe to change image or swipe down to close
    if (g.type === 'swipe' && scale <= 1.05 && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - g.startX;
      const dy = e.changedTouches[0].clientY - g.startY;
      
      if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        // Swipe down to close
        onClose();
      } else if (Math.abs(dx) > 50) {
        if (dx < 0 && activeIndex < images.length - 1) {
          onChangeIndex(activeIndex + 1);
        } else if (dx > 0 && activeIndex > 0) {
          onChangeIndex(activeIndex - 1);
        }
      }
    }

    // Snap back to 1x if close, or re-clamp after pinching
    if (g.type === 'pinch' && scale < 1.05) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else if (g.type === 'pinch') {
      // Re-clamp in case the user pinched off-center
      setTranslate((prev) => clampTranslate(prev.x, prev.y, scale));
    }

    g.type = 'none';
    g.moved = false;
  };

  return (
    <div
      ref={containerRef}
      className="image-viewer"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'none', overflow: 'hidden' }}
    >
      <button className="image-viewer-close" onClick={onClose}>
        <X size={18} />
      </button>

      {/* Navigation Buttons */}
      {images.length > 1 && activeIndex > 0 && (
        <button 
          className="image-viewer-nav"
          onClick={(e) => { e.stopPropagation(); onChangeIndex(activeIndex - 1); }}
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 302,
            cursor: 'pointer'
          }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {images.length > 1 && activeIndex < images.length - 1 && (
        <button 
          className="image-viewer-nav"
          onClick={(e) => { e.stopPropagation(); onChangeIndex(activeIndex + 1); }}
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 302,
            cursor: 'pointer'
          }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 301,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: '0.75rem',
          fontWeight: 600,
        }}>
          {activeIndex + 1} / {images.length}
          {scale > 1.05 && ` · ${scale.toFixed(1)}x`}
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={images[activeIndex]}
        alt={title}
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: scale === 1 ? 'transform 0.2s ease' : 'none',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
