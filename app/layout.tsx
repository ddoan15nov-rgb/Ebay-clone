import type { Metadata, Viewport } from 'next';
import './globals.css';
import TabBar from '@/components/TabBar';

export const metadata: Metadata = {
  title: 'Gold Scrap Hunter',
  description: 'Tìm kiếm và theo dõi các sản phẩm vàng phế liệu trên eBay',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GoldHunter',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <main>{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
