/**
 * Attachment 通用组件 — C-ATT-1.
 *
 * 业务详情页用法:
 *   import { AttachmentList, AttachmentUploadButton } from '@/components/attachment';
 *   const [refreshKey, setRefreshKey] = useState(0);
 *   <AttachmentList entityType="PURCHASE_ORDER" entityId={order.id} refreshKey={refreshKey} />
 *   <AttachmentUploadButton
 *     entityType="PURCHASE_ORDER"
 *     entityId={order.id}
 *     onUploaded={() => setRefreshKey(k => k + 1)}
 *   />
 */

export { AttachmentList } from './AttachmentList';
export { AttachmentUploadButton } from './AttachmentUploadButton';
