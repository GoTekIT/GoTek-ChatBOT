import type {ChatMessage} from '../../types';
export function metaDeliveryLabel(status: NonNullable<ChatMessage['deliveryStatus']>): string {
 const labels = {
  queued: 'Đang chờ gửi',
  dispatching: 'Đang xử lý gửi — chưa có xác nhận',
  accepted: 'Meta đã tiếp nhận — chưa xác nhận khách đã nhận/đọc',
  unknown: 'Chưa rõ kết quả gửi — không tự gửi lại',
  cancelled: 'Đã hủy trước khi gửi',
 };
 return labels[status] || 'Chưa rõ trạng thái gửi';
}
