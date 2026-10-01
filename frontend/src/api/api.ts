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
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  WORKSPACE_DISABLED: 'Workspace đã tạm dừng.',
  INVALID_OR_EXPIRED_TOKEN: 'Liên kết hoặc mã xác thực không hợp lệ, đã dùng hoặc hết hạn.',
  RESEND_COOLDOWN: 'Vui lòng chờ 60 giây trước khi gửi lại.',
  RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.',
  LAST_OWNER: 'Workspace phải còn ít nhất một Owner.',
  SEAT_LIMIT: 'Đã đạt giới hạn thành viên.',
  ALREADY_MEMBER: 'Người này đã là thành viên.',
  CONFLICT: 'Dữ liệu đã tồn tại hoặc vừa thay đổi.',
  NO_MEMBERSHIP: 'Tài khoản chưa có workspace khả dụng.',
  VALIDATION: 'Vui lòng kiểm tra các trường bên dưới.',
  INTERNAL: 'Chưa thể xử lý. Vui lòng thử lại.',
  INCORRECT_CURRENT_PASSWORD: 'Mật khẩu hiện tại không chính xác.',
  USER_NOT_FOUND: 'Không tìm thấy thông tin tài khoản người dùng.',
  DOCUMENT_TOO_LARGE: 'Tập tin vượt quá giới hạn 2MB.',
  DOCUMENT_TEXT_TOO_LARGE: 'Nội dung văn bản vượt quá 120.000 ký tự.',
  INVALID_DOCUMENT: 'Tập tin không hợp lệ hoặc bị hỏng.',
  EMPTY_DOCUMENT: 'Tập tin không có nội dung văn bản.',
  UNSUPPORTED_DOCUMENT_FORMAT: 'Chỉ hỗ trợ tập tin văn bản .pdf hoặc .docx.',
  FILE_REQUIRED: 'Vui lòng chọn tập tin cần nhập.',
  ALREADY_DRAFT: 'Phiên bản này đã là bản nháp hiện tại.',
  ROLLBACK_UNAVAILABLE: 'Chỉ có thể khôi phục phiên bản đã từng được xuất bản.',
  NO_PUBLISHED_SOURCE: 'Chưa có phiên bản nào được xuất bản.',
  INVALID_STATE: 'Trạng thái phiên bản không hợp lệ cho thao tác này.',
  INACTIVE_ITEM: 'Mục tri thức đang bị tắt.',
  CANNOT_DELETE_PUBLISHED_KNOWLEDGE: 'Không thể xoá tài liệu đã xuất bản cho AI. Hãy chuyển sang nội bộ hoặc tắt kích hoạt.',
  CANNOT_DELETE_CITED_KNOWLEDGE: 'Tài liệu đang được trích dẫn trong hội thoại AI và không thể xoá.',
  AI_KNOWLEDGE_NOT_FOUND: 'Không tìm thấy thông tin phù hợp trong dữ liệu của doanh nghiệp.'
};

export class ApiError extends Error {
  constructor(public code: string, public fields: Record<string, string[]> = {}) {
    super(messages[code] || code);
  }
}

const TOKEN_KEY = 'gotek_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

export function removeStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function api(path: string, method = 'GET', body?: unknown, customHeaders?: Record<string, string>) {
  let res: Response;
  const token = getStoredToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {
    'X-Gotek-Request': '1',
    ...(customHeaders || {})
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: isFormData ? (body as FormData) : (body === undefined ? undefined : JSON.stringify(body))
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
    throw new ApiError(data.error || 'INTERNAL', data.fields);
  }

  return data;
}
