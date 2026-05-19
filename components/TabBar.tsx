'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Heart, ShoppingCart, Ban } from 'lucide-react';

const tabs = [
  { href: '/', icon: Home, label: 'Trang Chủ' },
  { href: '/favorites', icon: Heart, label: 'Yêu Thích' },
  { href: '/purchases', icon: ShoppingCart, label: 'Mua Hàng' },
  { href: '/blocked', icon: Ban, label: 'Chặn' },
];

export default function TabBar() {
  const pathname = usePathname();

  // Hide tab bar on item detail page
  if (pathname.startsWith('/item/')) return null;

  return (
    <nav className="tab-bar">
      {tabs.map(({ href, icon: Icon, label }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`tab-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
