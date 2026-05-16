/**
 * SamplePhotoGalleryScreen — 样品照片网格视图 (Sprint 2 / Track F Follow-up Chat 2).
 *
 * 接 Sprint 1 Track C Attachment 真 API:
 *   - attachmentApi.list({ entityType: 'RD_SAMPLE', entityId })  → 网格
 *   - attachmentApi.uploadAndRegister(...)                       → 上传按钮 (内联使用 AttachmentUploadButton)
 *   - attachmentApi.delete(id)                                   → 长按删除
 *
 * 功能:
 *   - 3 列 grid thumbnails (FlatList numColumns=3)
 *   - Tap thumbnail → fullscreen Modal (Image + metadata + 关闭)
 *   - Long press → 确认对话框 → 软删除 (attachmentApi.delete)
 *   - 顶部 "📷 上传" 按钮 (AttachmentUploadButton, fileCategory=PHOTO, 强制只显示图片格式)
 *   - Pull-to-refresh
 *
 * Note: navigator wiring (route 'SamplePhotoGallery') 留 follow-up — 跟 PR #680 一致策略
 *   (修共享 navigator 文件需 organizer 拍板路由位置).
 *
 * Note: EXIF (相机/拍摄日期/GPS) 不显示 — 后端 Sprint 1 Attachment API 不返 EXIF 元数据
 *   (fileName / fileSize / mimeType / uploadedAt / description 是可用的全部元信息).
 *   完整 EXIF 留 Sprint 3 / backend 扩展 metadata 后再做.
 *
 * @author Cretas Team / Track F Follow-up Chat 2
 * @since 2026-05-16
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { attachmentApi, type Attachment } from '../../services/api/attachmentApi';
import { AttachmentUploadButton } from '../../components/attachment/AttachmentUploadButton';

type RDStackParamList = {
  SamplePhotoGallery: { sampleId: string; sampleCode?: string; sampleName?: string };
};

type Route = RouteProp<RDStackParamList, 'SamplePhotoGallery'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 8;
const GRID_GAP = 4;
const COLS = 3;
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (COLS - 1)) / COLS);

export const SamplePhotoGalleryScreen: React.FC = () => {
  const route = useRoute<Route>();
  const { sampleId, sampleCode, sampleName } = route.params;

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await attachmentApi.list('RD_SAMPLE', sampleId);
      // 只显示图片类附件; 其他类型 (VIDEO/DOCUMENT) 不在 gallery 显示
      const photosOnly = (data ?? []).filter(
        a => a.fileCategory === 'PHOTO' || a.fileType?.startsWith('image/'),
      );
      setAttachments(photosOnly);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载附件失败');
      setAttachments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sampleId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleUploaded = useCallback(() => {
    // 上传成功后刷新列表
    load();
  }, [load]);

  const handleDelete = useCallback(
    (att: Attachment) => {
      Alert.alert(
        '删除照片',
        `确认删除 ${att.fileName} ? 此操作软删, 后端 attachments 表保留记录.`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                await attachmentApi.delete(att.id);
                setAttachments(prev => prev.filter(x => x.id !== att.id));
                if (previewAttachment?.id === att.id) {
                  setPreviewAttachment(null);
                }
              } catch (e) {
                Alert.alert('删除失败', e instanceof Error ? e.message : String(e));
              }
            },
          },
        ],
      );
    },
    [previewAttachment],
  );

  const renderThumbnail = useCallback(
    ({ item }: { item: Attachment }) => (
      <TouchableOpacity
        style={styles.thumbWrap}
        onPress={() => setPreviewAttachment(item)}
        onLongPress={() => handleDelete(item)}
        delayLongPress={400}
      >
        <Image
          source={{ uri: item.thumbnailUrl ?? item.fileUrl }}
          style={styles.thumb}
          resizeMode="cover"
        />
      </TouchableOpacity>
    ),
    [handleDelete],
  );

  const header = useMemo(
    () => (
      <View style={styles.headerBox}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            {sampleCode ? <Text style={styles.headerCode}>{sampleCode}</Text> : null}
            <Text style={styles.headerTitle}>
              {sampleName ? `${sampleName} · ` : ''}照片 ({attachments.length})
            </Text>
          </View>
        </View>
        <View style={styles.uploadRow}>
          <AttachmentUploadButton
            entityType="RD_SAMPLE"
            entityId={sampleId}
            fileCategory="PHOTO"
            sources={['camera', 'gallery']}
            buttonLabel="📷 拍照 / 上传照片"
            onUploaded={handleUploaded}
          />
        </View>
        <Text style={styles.hint}>提示: 长按缩略图删除 · 点击缩略图查看大图</Text>
      </View>
    ),
    [sampleId, sampleCode, sampleName, attachments.length, handleUploaded],
  );

  if (loading && !refreshing && attachments.length === 0) {
    return (
      <View style={styles.fillCenter}>
        {header}
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={attachments}
        keyExtractor={item => item.id}
        renderItem={renderThumbnail}
        numColumns={COLS}
        ListHeaderComponent={header}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.gridRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>暂无照片</Text>
              <Text style={styles.emptySub}>点上方按钮上传第一张样品照片</Text>
            </View>
          ) : null
        }
      />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <PreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onDelete={handleDelete}
      />
    </View>
  );
};

// ==================== Preview Modal ====================

interface PreviewModalProps {
  attachment: Attachment | null;
  onClose: () => void;
  onDelete: (att: Attachment) => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ attachment, onClose, onDelete }) => {
  if (!attachment) return null;
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <Image source={{ uri: attachment.fileUrl }} style={styles.modalImage} resizeMode="contain" />
          <View style={styles.modalMetaBox}>
            <Text style={styles.modalFileName} numberOfLines={2}>
              {attachment.fileName}
            </Text>
            <Text style={styles.modalMeta}>
              {formatSize(attachment.fileSize)} · {attachment.fileType} · {formatTime(attachment.uploadedAt)}
            </Text>
            {attachment.description ? (
              <Text style={styles.modalMeta} numberOfLines={3}>
                {attachment.description}
              </Text>
            ) : null}
            {attachment.businessTag ? (
              <Text style={styles.modalTag}>标签: {attachment.businessTag}</Text>
            ) : null}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDanger]} onPress={() => onDelete(attachment)}>
              <Text style={styles.modalBtnText}>删除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={onClose}>
              <Text style={styles.modalBtnText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ==================== Helpers ====================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
      2,
      '0',
    )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  fillCenter: { flex: 1 },
  headerBox: {
    backgroundColor: '#fff',
    padding: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerCode: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  uploadRow: { marginTop: 10 },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' },

  gridContainer: { paddingBottom: 30 },
  gridRow: { paddingHorizontal: GRID_PADDING, marginBottom: GRID_GAP },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    marginRight: GRID_GAP,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  thumb: { width: '100%', height: '100%' },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 16, marginBottom: 4 },
  emptySub: { color: '#9CA3AF', fontSize: 13 },

  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
  },
  errorText: { color: '#991B1B', fontSize: 13 },
  retryText: { color: '#2563EB', fontSize: 13, marginTop: 4, fontWeight: '600' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: { width: '100%', maxWidth: 500, alignItems: 'center' },
  modalImage: { width: '100%', height: 360, marginBottom: 12, borderRadius: 8, backgroundColor: '#000' },
  modalMetaBox: { width: '100%', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 },
  modalFileName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 6 },
  modalMeta: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  modalTag: { fontSize: 13, color: '#2563EB', marginTop: 4, fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#2563EB' },
  modalBtnDanger: { backgroundColor: '#EF4444' },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

export default SamplePhotoGalleryScreen;
