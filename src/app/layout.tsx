import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://pradeepparmar902.github.io/My_Restaurants/'),
  title: 'Tadka Truck – QR Ordering & Restaurant Growth Platform',
  description:
    'One QR scan connects ordering, kitchen, billing, payment, reviews and repeat visits.',
  openGraph: {
    title: 'Tadka Truck – QR Ordering & Restaurant Growth Platform',
    description:
      'Scan, order your favorites, share your moment & earn rewards at Tadka Truck!',
    url: 'https://pradeepparmar902.github.io/My_Restaurants/',
    siteName: 'Tadka Truck',
    images: [
      {
        url: 'https://pradeepparmar902.github.io/My_Restaurants/og-tadka.jpg',
        width: 1200,
        height: 630,
        alt: 'Tadka Truck – Scan, Order, Share & Earn Rewards',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tadka Truck – QR Ordering & Restaurant Growth Platform',
    description:
      'Scan, order your favorites, share your moment & earn rewards at Tadka Truck!',
    images: ['https://pradeepparmar902.github.io/My_Restaurants/og-tadka.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1b1030',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
