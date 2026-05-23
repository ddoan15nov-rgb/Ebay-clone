'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Clock, Gavel, Crosshair } from 'lucide-react';
import { EbayItem } from '@/lib/types';
import { useCountdown } from '@/hooks/useCountdown';

interface ItemCardProps {
  item: EbayItem;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string) => void;
  onBlockSeller: (seller: string) => void;
  snipeBid?: string | null;
  index?: number;
}

export default function ItemCard({
  item,
  isFavorite,
  onToggleFavorite,
  snipeBid,
  index = 0,
}: ItemCardProps) {
  const { display, isEnded } = useCountdown(item.endTime);
  const isAuction = item.listingType === 'AUCTION';
  const [imageError, setImageError] = React.useState(!item.imageUrl);

  // Don't show timer for FIXED_PRICE items that have "ended"
  // (they're still available for purchase, the endTime is just a listing renewal date)
  const showTimer = isAuction && item.endTime;

  return (
    <div
      className={`card${index >= 0 ? ' animate-card-in' : ''}`}
      style={index >= 0 ? { animationDelay: `${index * 40}ms`, overflow: 'hidden' } : { overflow: 'hidden' }}
    >
      <Link href={`/item/${item.itemId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        {/* Image area */}
        <div style={{ position: 'relative', paddingTop: '100%', background: 'var(--surface)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {imageError ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle at 30% 30%, #2a2a2a, #0a0a0a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}
            >
              🥇
            </div>
          ) : (
            <img
              src={item.imageUrl}
              alt={item.title}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
              onError={() => setImageError(true)}
            />
          )}

          {/* Timer badge — only for auctions */}
          {showTimer && (
            <div style={{ position: 'absolute', top: 8, left: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  background: isEnded
                    ? 'rgba(231, 76, 60, 0.9)'
                    : item.endTime && new Date(item.endTime).getTime() - Date.now() < 3600000
                      ? 'rgba(231, 76, 60, 0.9)'
                      : 'rgba(0, 0, 0, 0.75)',
                  color: '#fff',
                  backdropFilter: 'blur(4px)',
                  letterSpacing: '0.02em',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Clock size={10} />
                {display}
              </span>
            </div>
          )}

          {/* Buy Now badge for FIXED_PRICE */}
          {!isAuction && (
            <div style={{ position: 'absolute', top: 8, left: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  background: 'rgba(46, 204, 113, 0.9)',
                  color: '#fff',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                Mua Ngay
              </span>
            </div>
          )}

          {/* Bid count badge — only for auctions with bids */}
          {isAuction && item.bidCount !== undefined && item.bidCount > 0 && (
            <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: '#fff',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Gavel size={10} />
                {item.bidCount} bid{item.bidCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Snipe bid badge */}
          {snipeBid && (
            <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  background: 'rgba(212, 175, 55, 0.9)',
                  color: '#000',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Crosshair size={9} />
                ${parseFloat(snipeBid).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Info area */}
        <div style={{ padding: '10px 10px 12px' }}>
          <p
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: 6,
              minHeight: '2.1em',
            }}
          >
            {item.title}
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold)' }}>
              ${item.price}
            </span>
            {item.originalCurrency && item.originalCurrency !== 'USD' && item.originalPrice && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                ({parseFloat(item.originalPrice).toFixed(2)} {item.originalCurrency})
              </span>
            )}
            {item.shippingCost && (
              <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                + ${item.shippingCost} ship
                {item.originalCurrency && item.originalCurrency !== 'USD' && item.originalShippingCost && (
                  ` (${parseFloat(item.originalShippingCost).toFixed(2)} ${item.originalCurrency})`
                )}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Heart button — floating on top-right of image */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(item.itemId);
        }}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: isFavorite ? 'rgba(231, 76, 60, 0.85)' : 'rgba(0, 0, 0, 0.5)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(4px)',
          zIndex: 2,
        }}
        aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
      >
        <Heart
          size={14}
          fill={isFavorite ? '#fff' : 'none'}
          color="#fff"
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
