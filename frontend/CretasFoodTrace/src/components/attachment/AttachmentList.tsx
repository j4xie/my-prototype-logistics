/**
 * AttachmentList — 列出某实体的全部附件 (缩略图 + 文件名 + 上传时间).
 *
 * 用法:
 *   <AttachmentList entityType="PURCHASE_ORDER" entityId={order.id} refreshKey={x} />
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1 Day 4)
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, FlatList, TouchableOpacity, Linking } from 'react-native';
import { Text, ActivityIndicator, Card, IconButton } from 'react-native-paper';
import { attachmentApi, Attachment, AttachmentEntityType } from '../../services/api/attachmentApi';

interface Props {
  entityType: AttachmentEntityType;
  entityId: string;
  factoryId?: string;
  /** 当父组件需触发刷新, 改这个值. */
  refreshKey?: number;
  onDelete?: (att: Attachment) => void;
  emptyText?: string;
}

export function AttachmentList({ entityType, entityId, factoryId, refreshKey, onDelete, emptyText }: Props) {
  const [list, setList] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    attachmentApi
      .list(entityType, entityId, factoryId)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? '加载附件失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, factoryId, refreshKey]);

  const open = (a: Attachment) => {
    Linking.openURL(a.fileUrl).catch(() => {
      setError(`无法打开: ${a.fileName}`);
    });
  };

  const handleDelete = async (a: Attachment) => {
    try {
      await attachmentApi.delete(a.id, factoryId);
      setList((prev) => prev.filter((x) => x.id !== a.id));
      onDelete?.(a);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '删除失败';
      setError(msg);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (list.length === 0) {
    return <Text style={styles.empty}>{emptyText ?? '暂无附件'}</Text>;
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => open(item)} style={styles.thumbBox}>
              {item.thumbnailUrl || item.fileCategory === 'PHOTO' ? (
                <Image
                  source={{ uri: item.thumbnailUrl ?? item.fileUrl }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumb, styles.fileIcon]}>
                  <Text style={styles.fileIconText}>{getCategoryIcon(item.fileCategory)}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.meta}>
              <Text numberOfLines={1} style={styles.fileName}>
                {item.fileName}
              </Text>
              <Text style={styles.subText}>
                {formatSize(item.fileSize)} · {formatTime(item.uploadedAt)}
              </Text>
              {item.description ? (
                <Text numberOfLines={2} style={styles.subText}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <IconButton icon="delete-outline" onPress={() => handleDelete(item)} accessibilityLabel="删除附件" />
          </View>
        </Card>
      )}
    />
  );
}

function getCategoryIcon(c: Attachment['fileCategory']): string {
  switch (c) {
    case 'VIDEO':
      return '🎬';
    case 'DOCUMENT':
      return '📄';
    case 'VOUCHER':
      return '🧾';
    case 'SIGNATURE':
      return '✍️';
    default:
      return '📎';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  card: { marginVertical: 4, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumbBox: { marginRight: 12 },
  thumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#e8e8e8' },
  fileIcon: { justifyContent: 'center', alignItems: 'center' },
  fileIconText: { fontSize: 24 },
  meta: { flex: 1 },
  fileName: { fontWeight: '600', fontSize: 14 },
  subText: { fontSize: 12, color: '#666', marginTop: 2 },
  center: { padding: 16, alignItems: 'center' },
  empty: { padding: 16, color: '#999', textAlign: 'center' },
  error: { padding: 16, color: '#d32f2f', textAlign: 'center' },
});
