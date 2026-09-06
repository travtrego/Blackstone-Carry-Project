import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Blackstone Carry Review',
  description:
    'A learning tool for AI-assisted disclosure review and illustrative carried-interest calculations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
