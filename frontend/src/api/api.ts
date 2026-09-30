const messages: Record<string, string> = {
  VERSION_CONFLICT: 'Quy tắc đã được thay đổi ở phiên khác. Tải lại danh sách trước khi thử lại.',
  RESPONSE_TOO_LARGE: 'Nguồn vượt quá giới hạn dung lượng.',
  REDIRECT_LIMIT: 'Nguồn chuyển hướng quá số lần cho phép.',
  REDIRECT_ORIGIN_BLOCKED: 'Nguồn chuyển hướng khác origin đã cho phép.',
  SOURCE_PAUSED: 'Nguồn đang tạm dừng. Bật lại trước khi xem thử.',
  SOURCE_CONTENT_EMPTY: 'Không tìm thấy nội dung đọc được trong nguồn.',
  SOURCE_XML_INVALID: 'Nguồn XML không hợp lệ.',
  SOURCE_CONTENT_UNSUPPORTED: 'Kiểu nội dung của nguồn chưa được hỗ trợ.',
  SSRF_BLOCKED: 'Địa chỉ nguồn không được phép truy cập.',
  SOURCE_DNS_FAILED: 'Không thể phân giải tên miền nguồn.',
  SOURCE_TIMEOUT: 'Nguồn phản hồi quá thời gian cho phép.',
  SOURCE_FETCH_FAILED: 'Không thể tải nguồn.',
  SOURCE_HTTP_ERROR: 'Nguồn trả về lỗi HTTP.',
  SOURCE_ENCODING_UNSUPPORTED: 'Nguồn dùng kiểu nén chưa hỗ trợ.',
  SOURCE_REDIRECT_INVALID: 'Nguồn có redirect không hợp lệ.',
  SUPPORT_GRANT_UNAVAILABLE: 'Quyền hỗ trợ không tồn tại, không dành cho bạn, đã thu hồi hoặc hết hạn.',
  SUPPORT_SUBJECT_UNAVAILABLE: 'Người hỗ trợ chưa có quyền nền tảng khả dụng.',
  PLATFORM_FORBIDDEN: 'Bạn không có quyền Platform Admin.',
  PROVIDER_SECRET_MISSING: 'Chưa có khóa provider trên server. Hãy cấu hình khóa trước khi bật.',
  CAPABILITY_UNAVAILABLE: 'Model không hỗ trợ khả năng được yêu cầu.',
  MODEL_NOT_GRANTED: 'Model chưa được cấp quyền hoặc đang bị tắt.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  WORKSPACE_DISABLED: 'Workspace đã tạm dừng.',
  INVALID_OR_EXPIRED_TOKEN: 'Liên kết không hợp lệ, đã dùng hoặc hết hạn.',
  RESEND_COOLDOWN: 'Vui lòng chờ 60 giây trước khi gửi lại.',
  RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.',
  LAST_OWNER: 'Workspace phải còn ít nhất một Owner.',
  SEAT_LIMIT: 'Đã đạt giới hạn thành viên.',
  ALREADY_MEMBER: 'Người này đã là thành viên.',
  CONFLICT: 'Dữ liệu đã tồn tại hoặc vừa thay đổi.',
  NO_MEMBERSHIP: 'Tài khoản chưa có workspace khả dụng.',
  VALIDATION: 'Vui lòng kiểm tra các trường thông tin bên dưới.',
  INTERNAL: 'Chưa thể xử lý. Vui lòng thử lại.'
};

const fieldLabelsMap: Record<string, string> = {
  widgetTitle: 'Tiêu đề hiển thị',
  widgetPosition: 'Vị trí hiển thị',
  widgetMode: 'Kích thước widget',
  color: 'Màu thương hiệu',
  widgetColor: 'Màu thương hiệu',
  assignmentEnabled: 'Phân công tự động',
  assignmentLimit: 'Giới hạn phân công',
  businessHours: 'Giờ làm việc',
  prechat: 'Biểu mẫu thông tin',
  name: 'Tên kênh',
  origin: 'Địa chỉ website',
  greeting: 'Lời chào'
};

function formatFieldErrors(fields?: Record<string, any>): string {
  if (!fields || typeof fields !== 'object') return '';
  const entries = Object.entries(fields);
  if (!entries.length) return '';
  const list: string[] = [];
  for (const [key, val] of entries) {
    let text = '';
    if (Array.isArray(val)) {
      text = val.filter(Boolean).join(', ');
    } else if (typeof val === 'string') {
      text = val;
    } else if (val && typeof val === 'object') {
      text = Object.values(val).flat().filter(Boolean).join(', ');
    }
    if (!text) continue;
    if (!key || key === '_errors') {
      list.push(text);
    } else {
      const friendlyName = fieldLabelsMap[key] || key;
      list.push(`${friendlyName}: ${text}`);
    }
  }
  return list.join('; ');
}

export class ApiError extends Error {
  code: string;
  fields: Record<string, string[]>;

  constructor(code: string, fields: Record<string, string[]> = {}) {
    let msg = messages[code] || code;
    if (code === 'VALIDATION' && fields && Object.keys(fields).length > 0) {
      const formatted = formatFieldErrors(fields);
      if (formatted) {
        msg = `Lỗi thuộc tính (${formatted})`;
      }
    }
    super(msg);
    this.code = code;
    this.fields = fields;
  }
}

export async function api(path: string, method = 'GET', body?: unknown) {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Gotek-Request': '1'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Không thể kết nối. Kiểm tra mạng và thử lại.');
  }

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  try {
    data = contentType.includes('application/json') ? await res.json() : {error: 'INTERNAL'};
  } catch {
    data = {error: 'INTERNAL'};
  }

  if (!res.ok) {
    throw new ApiError(data.error, data.fields);
  }
  return data;
}
