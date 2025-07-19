'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  showHomeButton?: boolean;
  onBack?: () => void;
  className?: string;
}

export default function PageHeader({
  title,
  showHomeButton = true,
  onBack,
  className = ''
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleHome = () => {
    router.push('/home/selector');
  };

  return (
    <header className={`fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${className}`}>
      <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          title="返回"
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="text-lg font-semibold">{title}</h1>

        {showHomeButton && (
          <button
            onClick={handleHome}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="返回主页"
          >
            <Home size={18} />
          </button>
        )}

        {!showHomeButton && <div className="w-8 h-8"></div>}
      </div>
    </header>
  );
}
