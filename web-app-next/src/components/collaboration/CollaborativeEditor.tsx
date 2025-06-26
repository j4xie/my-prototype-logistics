'use client';

import { useEffect, useRef, useState } from 'react';
import { getWebSocket } from '@/lib/websocket';

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: number;
}

interface CollaborativeEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  className?: string;
}

export default function CollaborativeEditor({
  documentId,
  initialContent = '',
  onContentChange,
  className = '',
}: CollaborativeEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initialContent);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const lastChangeRef = useRef<number>(0);

  useEffect(() => {
    // 检查是否启用Mock模式
    const isMockEnabled = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';

    if (isMockEnabled) {
      console.log('🔧 Mock模式已启用，跳过协作编辑器WebSocket连接');
      setIsConnected(false);
      return;
    }

    try {
      const ws = getWebSocket();

      // 加入文档协作
      ws.emit('join_document', { documentId });

      // 监听用户加入/离开
      ws.on('user_joined', (user: User) => {
        setConnectedUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
      });

      ws.on('user_left', (userId: string) => {
        setConnectedUsers(prev => prev.filter(u => u.id !== userId));
      });

      // 监听文档变化
      ws.on(
        'document_changed',
        (data: { content: string; userId: string; timestamp: number }) => {
          // 避免处理自己发出的变化
          if (data.timestamp > lastChangeRef.current) {
            setContent(data.content);
            onContentChange?.(data.content);
          }
        }
      );

      // 监听光标位置变化
      ws.on('cursor_moved', (data: { userId: string; position: number }) => {
        setConnectedUsers(prev =>
          prev.map(user =>
            user.id === data.userId ? { ...user, cursor: data.position } : user
          )
        );
      });

      // 连接状态监听
      ws.on('connect', () => setIsConnected(true));
      ws.on('disconnect', () => setIsConnected(false));

      return () => {
        ws.emit('leave_document', { documentId });
        ws.off('user_joined');
        ws.off('user_left');
        ws.off('document_changed');
        ws.off('cursor_moved');
        ws.off('connect');
        ws.off('disconnect');
      };
    } catch (error) {
      console.warn('协作编辑器WebSocket初始化失败:', error);
      setIsConnected(false);
    }
  }, [documentId, onContentChange]);

  const handleContentChange = (newContent: string) => {
    const timestamp = Date.now();
    lastChangeRef.current = timestamp;

    setContent(newContent);
    onContentChange?.(newContent);

    // 只在非Mock模式下发送变化到其他用户
    const isMockEnabled = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';
    if (!isMockEnabled && isConnected) {
      try {
        const ws = getWebSocket();
        ws.emit('document_change', {
          documentId,
          content: newContent,
          timestamp,
        });
      } catch (error) {
        console.warn('发送文档变化失败:', error);
      }
    }
  };

  const handleCursorMove = () => {
    const editor = editorRef.current;
    const isMockEnabled = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';

    if (editor && !isMockEnabled && isConnected) {
      try {
        const ws = getWebSocket();
        ws.emit('cursor_move', {
          documentId,
          position: editor.selectionStart,
        });
      } catch (error) {
        console.warn('发送光标位置失败:', error);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* 连接状态指示器 */}
      <div className="mb-2 flex items-center justify-between rounded-lg bg-gray-50 p-2">
        <div className="flex items-center space-x-2">
          <div
            className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? '已连接' : '连接中...'}
          </span>
        </div>

        {/* 在线用户 */}
        <div className="flex items-center space-x-1">
          <span className="text-sm text-gray-600">在线用户:</span>
          {connectedUsers.map(user => (
            <div
              key={user.id}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* 编辑器 */}
      <div className="relative">
        <textarea
          ref={editorRef}
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          onSelect={handleCursorMove}
          onKeyUp={handleCursorMove}
          className="h-64 w-full resize-none rounded-lg border border-gray-300 p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="开始协作编辑..."
          disabled={!isConnected}
        />

        {/* 其他用户光标指示器 */}
        {connectedUsers.map(user => {
          if (user.cursor === undefined) return null;

          // 简化的光标位置计算（实际项目中需要更精确的计算）
          const lines = content.substring(0, user.cursor).split('\n');
          const lineNumber = lines.length;
          const columnNumber = lines[lines.length - 1].length;

          return (
            <div
              key={`cursor-${user.id}`}
              className="pointer-events-none absolute"
              style={{
                top: `${lineNumber * 1.5}rem`,
                left: `${columnNumber * 0.6}rem`,
                backgroundColor: user.color,
                width: '2px',
                height: '1.2rem',
                zIndex: 10,
              }}
            >
              <div
                className="absolute bottom-full left-0 rounded px-1 py-0.5 text-xs whitespace-nowrap text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* 协作功能提示 */}
      <div className="mt-2 text-xs text-gray-500">
        💡 支持多人实时协作编辑，所有变更将自动同步
      </div>
    </div>
  );
}
