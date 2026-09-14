import type { Metadata } from 'next';
import '../styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'FG Thumb Studio',
  description: 'Editor simultâneo de thumbs para Instagram e TikTok',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Vina+Sans&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
