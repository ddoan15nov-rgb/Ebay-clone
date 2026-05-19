'use client';

import React from 'react';

interface ItemCardSkeletonProps {
  count?: number;
}

export default function ItemCardSkeleton({ count = 1 }: ItemCardSkeletonProps) {
  const skeletons = Array.from({ length: count });

  return (
    <>
      {skeletons.map((_, i) => (
        <div
          key={i}
          className="card"
          style={{
            overflow: 'hidden',
            pointerEvents: 'none',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          {/* Square Image Area Skeleton */}
          <div
            className="skeleton-image"
            style={{
              width: '100%',
              aspectRatio: '1/1',
              background: 'var(--surface)',
            }}
          />

          {/* Info Area Skeleton */}
          <div style={{ padding: '10px 10px 12px' }}>
            {/* Title Line 1 */}
            <div
              className="skeleton-text"
              style={{
                width: '90%',
                height: '12px',
                marginBottom: '6px',
              }}
            />
            {/* Title Line 2 */}
            <div
              className="skeleton-text"
              style={{
                width: '70%',
                height: '12px',
                marginBottom: '10px',
              }}
            />

            {/* Price Line */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div
                className="skeleton-text"
                style={{
                  width: '40%',
                  height: '16px',
                  marginBottom: 0,
                }}
              />
              <div
                className="skeleton-text short"
                style={{
                  width: '25%',
                  height: '10px',
                  marginBottom: 0,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
