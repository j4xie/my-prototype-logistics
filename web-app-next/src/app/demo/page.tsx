'use client';

import React, { useState } from 'react';
import CollaborativeEditor from '@/components/collaboration/CollaborativeEditor';
import { Table } from '@/components/ui';
import { getAIService } from '@/lib/ai-service';
import { getWebSocket } from '@/lib/websocket';

// 示例数据
const sampleData = [
  { id: 1, name: '有机大米', status: '已收获', location: '黑龙江', quality: 95 },
  { id: 2, name: '绿色蔬菜', status: '生长中', location: '山东', quality: 88 },
  { id: 3, name: '果园苹果', status: '待收获', location: '陕西', quality: 92 },
];

const columns = [
  {
    key: 'name',
    title: '产品名称',
  },
  {
    key: 'status',
    title: '状态',
    render: (status: string) => (
      <span className={`px-2 py-1 rounded-full text-xs ${
        status === '已收获' ? 'bg-green-100 text-green-800' :
        status === '生长中' ? 'bg-yellow-100 text-yellow-800' :
        'bg-blue-100 text-blue-800'
      }`}>
        {status}
      </span>
    ),
  },
  {
    key: 'location',
    title: '产地',
  },
  {
    key: 'quality',
    title: '质量评分',
    render: (quality: number) => (
      <div className="flex items-center">
        <span className="mr-2">{quality}</span>
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full" 
            style={{ width: `${quality}%` }}
          />
        </div>
      </div>
    ),
  },
];

export default function DemoPage() {
  const [editorContent, setEditorContent] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [wsStatus, setWsStatus] = useState('disconnected');

  // AI服务示例
  const handleAIQuery = async () => {
    try {
      const aiService = getAIService();
      const response = await aiService.chat([
        { role: 'user', content: '请分析当前农场的产量预测情况' }
      ]);
      setAiResponse(response.message);
    } catch (error) {
      console.error('AI查询失败:', error);
      setAiResponse('AI服务暂不可用');
    }
  };

  // WebSocket状态检查
  const checkWebSocketStatus = () => {
    try {
      const ws = getWebSocket();
      setWsStatus(ws.isConnected ? 'connected' : 'disconnected');
    } catch {
      setWsStatus('not_initialized');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                食品溯源系统 - 功能演示
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={checkWebSocketStatus}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                检查连接状态
              </button>
              <span className={`px-2 py-1 text-xs rounded ${
                wsStatus === 'connected' ? 'bg-green-100 text-green-800' :
                wsStatus === 'disconnected' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                WebSocket: {wsStatus}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 实时协作编辑器 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              📝 实时协作编辑器
            </h2>
            <CollaborativeEditor
              documentId="demo-document"
              initialContent="这是一个实时协作编辑器演示..."
              onContentChange={setEditorContent}
              className="mb-4"
            />
            <div className="text-sm text-gray-600">
              <p>当前内容长度: {editorContent.length} 字符</p>
            </div>
          </div>

          {/* AI智能助手 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              🤖 AI智能助手
            </h2>
            <div className="space-y-4">
              <button
                onClick={handleAIQuery}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                询问AI助手
              </button>
              {aiResponse && (
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-700">{aiResponse}</p>
                </div>
              )}
            </div>
          </div>

          {/* 基础表格 */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                📊 数据表格
              </h2>
              <Table
                data={sampleData}
                columns={columns}
                loading={false}
              />
            </div>
          </div>

        </div>

        {/* 功能说明 */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            🚀 新增功能特性
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border border-gray-200 rounded">
              <h3 className="font-medium text-gray-900 mb-2">WebSocket 实时通信</h3>
              <p className="text-sm text-gray-600">
                支持实时数据推送、多人协作、状态同步
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded">
              <h3 className="font-medium text-gray-900 mb-2">AI 智能分析</h3>
              <p className="text-sm text-gray-600">
                智能预测、风险评估、个性化推荐
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded">
              <h3 className="font-medium text-gray-900 mb-2">高级表格</h3>
              <p className="text-sm text-gray-600">
                排序、筛选、分页、多选等高级功能
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded">
              <h3 className="font-medium text-gray-900 mb-2">协作编辑</h3>
              <p className="text-sm text-gray-600">
                多人实时编辑、版本控制、冲突解决
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 