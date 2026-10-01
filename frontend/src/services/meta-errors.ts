const errors:Record<string,string>={
 META_AUTHORIZATION_DENIED:'Bạn đã từ chối cấp quyền. Có thể bấm Kết nối để thử lại.',
 META_OAUTH_STATE_INVALID:'Yêu cầu kết nối đã hết hạn, đã dùng hoặc thuộc phiên khác. Hãy bắt đầu lại.',
 META_PERMISSIONS_REQUIRED:'Tài khoản chưa cấp đủ quyền cần thiết cho tích hợp tin nhắn.',
 META_ASSET_UNAVAILABLE:'Tài khoản này đã được gắn với doanh nghiệp khác. Liên hệ quản trị viên để đối soát.',
 UNAUTHENTICATED:'Phiên đăng nhập đã hết hạn. Đăng nhập lại trước khi kết nối.',
 FORBIDDEN:'Bạn không có quyền quản lý kết nối của doanh nghiệp này.',
 META_NOT_CONFIGURED:'Máy chủ chưa cấu hình đủ thông tin Meta. Liên hệ quản trị viên.',
 META_CONNECT_FAILED:'Kết nối Meta chưa thành công. Hãy bắt đầu lại; nếu vẫn lỗi, liên hệ quản trị viên.',
};
export function metaCallbackError(code:string):string{return errors[code]||errors.META_CONNECT_FAILED;}
