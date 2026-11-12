import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Blender-ELT Web | Modern 3D Studio in the Browser',
  description:
    'A lightweight, responsive, and extensible 3D creation suite powered by Three.js, React Three Fiber, and Next.js.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#1d1e22] text-[#dedede] antialiased min-h-screen">{children}</body>
    </html>
  );
}
