import type { Metadata } from 'next';
// 使用本地字体避免网络连接问题
// import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import AiGlobalMonitor from '@/components/ai-global-monitor';

// 使用本地系统字体替代Google Fonts
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

export const metadata: Metadata = {
  title: '食品溯源系统 - 智能农业管理平台',
  description:
    '基于区块链和AI的食品安全溯源系统，支持实时协作、智能预测和全链路追踪',
  keywords: '食品溯源,智能农业,区块链,AI预测,实时协作',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className="font-sans antialiased"
      >
        <Providers>{children}</Providers>
        <AiGlobalMonitor />
      </body>
    </html>
  );
}
