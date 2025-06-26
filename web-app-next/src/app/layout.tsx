import type { Metadata } from 'next';
// 使用本地字体避免网络连接问题
// import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { MSWProvider } from './msw-provider';
// import AiGlobalMonitor from '@/components/ai-global-monitor';
// // import { Inter } from 'next/font/google';

// 使用本地系统字体替代Google Fonts，遵循UI设计系统规范
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

// 移除Inter字体导入，使用Tailwind配置的系统字体
// // const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '黑牛食品溯源系统',
  description: '食品溯源管理系统 - 农业生产、加工、物流全链路追踪',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="font-sans antialiased">
        <MSWProvider>
        <Providers>{children}</Providers>
        </MSWProvider>
        {/* 临时注释掉AI监控组件避免Hydration错误 */}
        {/* <AiGlobalMonitor /> */}
      </body>
    </html>
  );
}
