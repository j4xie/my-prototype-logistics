import type { Metadata } from 'next';
// 使用本地字体避免网络连接问题
// import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import AiGlobalMonitor from '@/components/ai-global-monitor';
import { Inter } from 'next/font/google';

// 使用本地系统字体替代Google Fonts
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '黑牛食品溯源系统',
  description: '食品溯源管理系统 - 农业生产、加工、物流全链路追踪',
};

// MSW浏览器端初始化组件
function MSWProvider({ children }: { children: React.ReactNode }) {
  // 仅在客户端且开发环境下初始化MSW
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    import('@/mocks/setup').then(({ autoInitializeForDevelopment }) => {
      autoInitializeForDevelopment().catch(console.error);
    });
  }

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <MSWProvider>
        <Providers>{children}</Providers>
        </MSWProvider>
        <AiGlobalMonitor />
      </body>
    </html>
  );
}
