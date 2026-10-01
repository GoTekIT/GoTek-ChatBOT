import {useEffect, useRef, useState, type FormEvent} from 'react';
import {api, ApiError} from '@/api/api';

type Item = {
  id: string;
  title: string;
  content: string;
  active: boolean;
  revision: number;
  updated_at: string;
  draft_version_id: string;
  published_version_id: string | null;
  audience?: 'INTERNAL' | 'PUBLIC' | null;
  category_id: string | null;
  state: 'DRAFT' | 'READY' | 'FAILED';
};

type Version = {
  id: string;
  version_no: number;
  title: string;
  content: string;
  state: string;
  first_published_at: string | null;
  created_at: string;
  processed_at: string | null;
};

type Category = {id: string; name: string};
type Page = {items: Item[]; nextCursor: string | null};

const count = (value: string) => Array.from(value.trim()).length;

export function Knowledge({role}: {role: string}) {
  const allowed = role === 'Owner' || role === 'Admin';
  const [items, setItems] = useState<Item[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCategoryId, setImportCategoryId] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<Error | null>(null);

  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [historyVersions, setHistoryVersions] = useState<Version[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [sort, setSort] = useState('newest');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState<Error | null>(null);

  const categoryRequest = useRef<{name: string; id: string} | null>(null);
  const applied = useRef({search: '', active: '', sort: 'newest', categoryId: ''});
  const [error, setError] = useState<Error | null>(null);
  const [listError, setListError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');

  const sequence = useRef(0);
  const mutation = useRef<{key: string; id: string} | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleLength = count(title);
  const contentLength = count(content);
  const titleError = titleLength > 100 ? 'Tối đa 100 ký tự.' : title.length > 0 && !titleLength ? 'Nhập thông tin cho AI.' : '';
  const contentError = contentLength > 2000 ? 'Tối đa 2.000 ký tự.' : content.length > 0 && !contentLength ? 'Nhập nội dung.' : '';

  async function load(cursor?: string, filters = applied.current) {
    const current = ++sequence.current;
    setLoading(true);
    setListError(null);
    try {
      const query = new URLSearchParams({limit: '20', sort: filters.sort});
      if (filters.search) query.set('search', filters.search);
      if (filters.active) query.set('active', filters.active);
      if (filters.categoryId) query.set('categoryId', filters.categoryId);
      if (cursor) query.set('cursor', cursor);
      const page: Page = await api(`/knowledge/items?${query}`);
      if (current !== sequence.current) return false;
      setItems(previous => (cursor ? [...previous, ...page.items.filter(row => !previous.some(old => old.id === row.id))] : page.items));
      setNextCursor(page.nextCursor);
      setLoaded(true);
      return true;
    } catch (e) {
      if (current === sequence.current) setListError(e as Error);
      return false;
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      setCategoryError(null);
      setCategories(await api('/knowledge-categories'));
    } catch (e) {
      setCategoryError(e as Error);
    }
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!allowed || categoryBusy || busy || !name) return;
    if (categoryRequest.current?.name !== name) categoryRequest.current = {name, id: crypto.randomUUID()};
    setCategoryBusy(true);
    setCategoryError(null);
    try {
      const created: Category = await api('/knowledge-categories', 'POST', {name, requestId: categoryRequest.current.id});
      setCategories(previous => [...previous.filter(row => row.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
      setCategoryId(created.id);
      setCategoryName('');
      categoryRequest.current = null;
      setMessage('Đã tạo danh mục.');
    } catch (e) {
      setCategoryError(e as Error);
    } finally {
      setCategoryBusy(false);
    }
  }

  useEffect(() => {
    if (allowed) {
      void load();
      void loadCategories();
    }
    return () => {
      sequence.current++;
    };
  }, [allowed]);

  useEffect(() => {
    if (formOpen) titleInput.current?.focus();
  }, [formOpen, editing?.id]);

  function reset() {
    setFormOpen(false);
    setImportOpen(false);
    setEditing(null);
    setTitle('');
    setContent('');
    setActive(true);
    setCategoryId('');
    setImportFile(null);
    setImportCategoryId('');
    setImportError(null);
    mutation.current = null;
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    addButton.current?.focus();
  }

  function edit(item: Item) {
    setEditing(item);
    setTitle(item.title);
    setContent(item.content);
    setActive(item.active);
    setCategoryId(item.category_id ?? '');
    setFormOpen(true);
    setImportOpen(false);
    setHistoryItem(null);
    setError(null);
    setMessage('');
    mutation.current = null;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!allowed || busy || categoryBusy || !titleLength || !contentLength || titleError || contentError) return;
    const path = editing ? `/knowledge/items/${editing.id}/draft` : '/knowledge/items';
    const payload = editing
      ? {title: title.trim(), content: content.trim(), expectedRevision: editing.revision, categoryId: categoryId || null}
      : {title: title.trim(), content: content.trim(), active, categoryId: categoryId || null};
    const key = JSON.stringify({path, payload});
    if (mutation.current?.key !== key) mutation.current = {key, id: crypto.randomUUID()};
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await api(path, editing ? 'PATCH' : 'POST', {...payload, requestId: mutation.current.id});
      reset();
      const refreshed = await load();
      setMessage(refreshed ? 'Đã lưu bản nháp. Nội dung chưa được đưa vào phục vụ AI.' : 'Đã lưu bản nháp, nhưng chưa tải lại được danh sách. Chọn Tải lại; không cần lưu lại.');
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(item: Item, action: 'process' | 'publish', audience: 'PUBLIC' | 'INTERNAL' = 'PUBLIC') {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await api(`/knowledge/items/${item.id}/${action}`, 'POST', {
        requestId: crypto.randomUUID(),
        expectedRevision: item.revision,
        versionId: item.draft_version_id,
        ...(action === 'publish' ? {audience} : {})
      });
      setMessage(action === 'process' ? 'Đã xử lý bản nháp thành READY.' : (audience === 'PUBLIC' ? 'Đã xuất bản CÔNG KHAI (phục vụ AI).' : 'Đã xuất bản NỘI BỘ.'));
      await load();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function handleImportDocument(event: FormEvent) {
    event.preventDefault();
    if (!allowed || importBusy || !importFile) return;
    setImportBusy(true);
    setImportError(null);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      if (importCategoryId) formData.append('categoryId', importCategoryId);

      const result = await api('/knowledge/import-document', 'POST', formData);
      const countImported = result.imported ?? result.items?.length ?? 1;
      setMessage(`Đã nhập thành công ${countImported} mục tri thức từ tài liệu "${importFile.name}" (dạng bản nháp). Hãy xử lý và xuất bản để phục vụ AI.`);
      reset();
      await load();
    } catch (e) {
      setImportError(e as Error);
    } finally {
      setImportBusy(false);
    }
  }

  async function openHistory(item: Item) {
    setHistoryItem(item);
    setHistoryVersions([]);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const detail = await api(`/knowledge/items/${item.id}`);
      setHistoryVersions(detail.versions ?? []);
    } catch (e) {
      setHistoryError(e as Error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleRollback(v: Version) {
    if (!historyItem || historyBusy) return;
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      await api(`/knowledge/items/${historyItem.id}/rollback`, 'POST', {
        requestId: crypto.randomUUID(),
        expectedRevision: historyItem.revision,
        versionId: v.id
      });
      setMessage(`Đã khôi phục phiên bản #${v.version_no} thành bản nháp mới.`);
      await load();
      const refreshedDetail = await api(`/knowledge/items/${historyItem.id}`);
      setHistoryItem(refreshedDetail);
      setHistoryVersions(refreshedDetail.versions ?? []);
    } catch (e) {
      setHistoryError(e as Error);
    } finally {
      setHistoryBusy(false);
    }
  }

  const fieldError = (field: string) => (error instanceof ApiError ? error.fields[field]?.join(' ') : undefined);
  const readableError = (e: Error) =>
    e instanceof ApiError && e.code === 'VERSION_CONFLICT'
      ? 'Bản nháp đã thay đổi ở phiên khác. Nội dung bạn nhập được giữ lại. Tải lại danh sách, rồi chọn Chỉnh sửa để lấy phiên bản mới.'
      : e instanceof ApiError && e.code === 'IDEMPOTENCY_CONFLICT'
        ? 'Yêu cầu này đã được dùng cho dữ liệu khác. Hủy và mở lại biểu mẫu trước khi lưu.'
        : e.message;

  if (!allowed) {
    return (
      <>
        <h1>Kho thông tin</h1>
        <div className="notice error" role="alert">
          Bạn cần quyền Owner hoặc Admin để quản lý kho thông tin.
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Kho thông tin</h1>
      <p className="muted">Thông tin nhập thủ công & tài liệu · Bản nháp nội bộ. Chỉ phiên bản CÔNG KHAI được đưa vào phục vụ AI.</p>
      {message && <div className="notice" role="status">{message}</div>}

      <div style={{display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap'}}>
        <button
          className="primary"
          ref={addButton}
          disabled={busy || importBusy}
          onClick={() => {
            reset();
            setFormOpen(true);
            setMessage('');
          }}
        >
          Thêm thông tin
        </button>
        <button
          disabled={busy || importBusy}
          onClick={() => {
            reset();
            setImportOpen(true);
            setMessage('');
          }}
        >
          Nhập tài liệu (.docx, .pdf)
        </button>
      </div>

      <section className="panel" aria-label="Danh mục thông tin">
        <h2>Danh mục</h2>
        {categoryError && (
          <div className="notice error" role="alert">
            {readableError(categoryError)} <button type="button" disabled={categoryBusy} onClick={() => void loadCategories()}>Tải lại danh mục</button>
          </div>
        )}
        <form onSubmit={createCategory}>
          <label className="field">
            Tên danh mục
            <input required maxLength={100} value={categoryName} disabled={categoryBusy || busy} onChange={event => setCategoryName(event.target.value)} />
          </label>
          <button disabled={categoryBusy || busy || !categoryName.trim()}>{categoryBusy ? 'Đang tạo…' : 'Thêm danh mục'}</button>
        </form>
      </section>

      {importOpen && (
        <section className="panel" aria-label="Nhập tài liệu văn bản">
          <h2>Nhập tài liệu (.docx, .pdf)</h2>
          <p className="muted">
            Tải lên tài liệu văn bản dạng Word (.docx) hoặc PDF (.pdf). Hệ thống sẽ tự động trích xuất nội dung văn bản và tạo thành các bản nháp tri thức.
          </p>
          {importError && <div className="notice error" role="alert">{readableError(importError)}</div>}
          <form onSubmit={handleImportDocument}>
            <fieldset disabled={importBusy}>
              <label className="field">
                Tập tin văn bản (.docx, .pdf)
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".docx,.pdf"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    setImportFile(f ?? null);
                  }}
                />
                <small className="muted">Tối đa 2MB, giới hạn 120.000 ký tự. Không hỗ trợ nhận dạng chữ quét từ ảnh (OCR).</small>
              </label>
              <label className="field">
                Danh mục phân loại
                <select value={importCategoryId} onChange={e => setImportCategoryId(e.target.value)}>
                  <option value="">Chưa phân loại</option>
                  {categories.map(row => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <p style={{display: 'flex', gap: '8px', marginTop: '16px'}}>
                <button className="primary" disabled={importBusy || !importFile}>
                  {importBusy ? 'Đang trích xuất & nhập...' : 'Tải lên và trích xuất'}
                </button>
                <button type="button" onClick={reset}>Hủy</button>
              </p>
            </fieldset>
          </form>
        </section>
      )}

      {formOpen && (
        <section className="panel" aria-label={editing ? 'Chỉnh sửa bản nháp' : 'Thêm thông tin'}>
          <h2>{editing ? 'Chỉnh sửa bản nháp' : 'Thêm thông tin'}</h2>
          {error && <div className="notice error" role="alert">{readableError(error)}</div>}
          <form onSubmit={save}>
            <fieldset disabled={busy || categoryBusy}>
              <label className="field">
                Thông tin cho AI
                <input
                  ref={titleInput}
                  required
                  value={title}
                  aria-invalid={!!(titleError || fieldError('title'))}
                  aria-describedby="knowledge-title-help"
                  onChange={e => setTitle(e.target.value)}
                />
                <small id="knowledge-title-help">{titleLength}/100 {titleError || fieldError('title')}</small>
              </label>
              <label className="field">
                Nội dung
                <textarea
                  required
                  rows={8}
                  value={content}
                  aria-invalid={!!(contentError || fieldError('content'))}
                  aria-describedby="knowledge-content-help"
                  onChange={e => setContent(e.target.value)}
                />
                <small id="knowledge-content-help">{contentLength}/2000 {contentError || fieldError('content')}</small>
              </label>
              <label className="field">
                Danh mục
                <select value={categoryId} onChange={event => setCategoryId(event.target.value)}>
                  <option value="">Chưa phân loại</option>
                  {categoryId && !categories.some(row => row.id === categoryId) && (
                    <option value={categoryId}>Danh mục hiện tại</option>
                  )}
                  {categories.map(row => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
                {fieldError('categoryId') && <small role="alert">{fieldError('categoryId')}</small>}
              </label>
              {!editing && (
                <label>
                  <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Bật thông tin sau khi tạo (vẫn là bản nháp)
                </label>
              )}
              <p style={{display: 'flex', gap: '8px', marginTop: '16px'}}>
                <button className="primary" disabled={busy || !titleLength || !contentLength || !!titleError || !!contentError}>
                  {busy ? 'Đang lưu…' : editing ? 'Lưu bản nháp' : 'Tạo bản nháp'}
                </button>
                <button type="button" onClick={reset}>Hủy</button>
              </p>
            </fieldset>
          </form>
        </section>
      )}

      {historyItem && (
        <section className="panel" aria-label="Lịch sử phiên bản">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
            <h2>Lịch sử phiên bản: {historyItem.title}</h2>
            <button type="button" onClick={() => setHistoryItem(null)}>Đóng</button>
          </div>
          <p className="muted">Xem lại các phiên bản trong quá khứ và khôi phục (rollback) về bản nháp mới nếu cần.</p>
          {historyError && <div className="notice error" role="alert">{readableError(historyError)}</div>}
          {historyLoading && <p role="status">Đang tải lịch sử phiên bản...</p>}
          {!historyLoading && !historyVersions.length && <p className="empty">Chưa có lịch sử phiên bản nào.</p>}
          {!historyLoading && historyVersions.map(v => {
            const isCurrentDraft = v.id === historyItem.draft_version_id;
            const wasPublished = !!v.first_published_at;
            const canRollback = !isCurrentDraft && wasPublished;
            return (
              <article className="list-row" key={v.id} style={{marginBottom: '10px', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px'}}>
                <div style={{minWidth: 0, overflowWrap: 'anywhere'}}>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap'}}>
                    <strong>Phiên bản #{v.version_no}</strong>
                    {isCurrentDraft && (
                      <span style={{fontSize: '11px', padding: '2px 6px', background: '#eff5ff', border: '1px solid #b5c9ee', borderRadius: '4px', color: '#2656a8'}}>
                        Bản nháp hiện tại
                      </span>
                    )}
                    {wasPublished && (
                      <span style={{fontSize: '11px', padding: '2px 6px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', color: '#166534'}}>
                        Đã từng xuất bản
                      </span>
                    )}
                    <span style={{fontSize: '11px', color: 'var(--color-text-muted)'}}>{v.state}</span>
                  </div>
                  <p style={{margin: '4px 0', fontWeight: 500}}>{v.title}</p>
                  <p style={{whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)', maxHeight: '100px', overflowY: 'auto'}}>{v.content}</p>
                  <small className="muted">
                    Tạo lúc: {new Date(v.created_at).toLocaleString('vi-VN')}
                    {v.first_published_at ? ` · Xuất bản: ${new Date(v.first_published_at).toLocaleString('vi-VN')}` : ''}
                  </small>
                </div>
                {canRollback && (
                  <button
                    disabled={historyBusy || busy}
                    onClick={() => void handleRollback(v)}
                  >
                    {historyBusy ? 'Đang khôi phục...' : 'Khôi phục phiên bản'}
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="panel" aria-label="Danh sách thông tin">
        <form
          onSubmit={event => {
            event.preventDefault();
            applied.current = {search: search.trim(), active: activeFilter, sort, categoryId: categoryFilter};
            void load();
          }}
        >
          <fieldset disabled={loading || busy}>
            <label className="field">
              Tìm thông tin
              <input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="field">
              Trạng thái
              <select value={activeFilter} onChange={event => setActiveFilter(event.target.value)}>
                <option value="">Tất cả</option>
                <option value="true">Đang bật</option>
                <option value="false">Đã tắt</option>
              </select>
            </label>
            <label className="field">
              Danh mục
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                <option value="">Tất cả danh mục</option>
                {categories.map(row => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Sắp xếp
              <select value={sort} onChange={event => setSort(event.target.value)}>
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
            </label>
            <button type="submit">Tìm kiếm</button>
          </fieldset>
        </form>
        <button disabled={loading || busy} onClick={() => void load()}>Tải lại</button>

        {listError && <div className="notice error" role="alert">{readableError(listError)}</div>}
        {loading && <p role="status">Đang tải thông tin…</p>}
        {loaded && !loading && !listError && !items.length && (
          <p className="empty">
            {applied.current.search || applied.current.active || applied.current.categoryId
              ? 'Không có thông tin phù hợp với bộ lọc.'
              : 'Chưa có thông tin. Thêm thông tin để tạo bản nháp đầu tiên.'}
          </p>
        )}

        {items.map(item => (
          <article className="list-row" key={item.id}>
            <div style={{minWidth: 0, overflowWrap: 'anywhere'}}>
              <strong>{item.title}</strong>
              <p style={{whiteSpace: 'pre-wrap'}}>{item.content}</p>
              <small>
                {item.category_id ? (categories.find(row => row.id === item.category_id)?.name ?? 'Danh mục hiện tại') : 'Chưa phân loại'}
                {' · '}
                {item.state}
                {' · '}
                {item.active ? 'Đang bật' : 'Đã tắt'}
                {' · '}
                Phiên bản {item.revision}
                {' · '}
                {new Date(item.updated_at).toLocaleString('vi-VN')}
              </small>
              <p className="muted">
                {item.published_version_id
                  ? (item.audience === 'PUBLIC'
                      ? 'Đã xuất bản CÔNG KHAI (phục vụ AI) · Sửa bản nháp không thay đổi bản đang phục vụ.'
                      : 'Đã xuất bản NỘI BỘ · Sửa bản nháp không thay đổi bản đang phục vụ.')
                  : 'Chưa xuất bản'}
              </p>
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center'}}>
              <button disabled={busy} onClick={() => edit(item)}>Chỉnh sửa</button>
              <button disabled={busy} onClick={() => void openHistory(item)}>Lịch sử</button>
              <button disabled={busy || item.state === 'READY'} onClick={() => void lifecycle(item, 'process')}>Xử lý (READY)</button>
              <button className="primary" disabled={busy || item.state !== 'READY'} onClick={() => void lifecycle(item, 'publish', 'PUBLIC')}>
                Xuất bản công khai
              </button>
              <button disabled={busy || item.state !== 'READY'} onClick={() => void lifecycle(item, 'publish', 'INTERNAL')}>
                Xuất bản nội bộ
              </button>
            </div>
          </article>
        ))}

        {nextCursor && <button disabled={loading || busy} onClick={() => void load(nextCursor)}>Tải thêm</button>}
      </section>
    </>
  );
}
