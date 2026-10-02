import React, { useState } from 'react';
import { api, ApiError } from '../../api/api';

export interface FaqStep {
  stepNumber: number;
  title: string;
  description: string;
  imageUrl?: string;
}

interface MultiStepFaqViewProps {
  categories: Array<{ id: string; name: string }>;
  onNotify: (msg: string) => void;
  onSuccess: () => void;
}

export const MultiStepFaqView: React.FC<MultiStepFaqViewProps> = ({
  categories,
  onNotify,
  onSuccess,
}) => {
  const [question, setQuestion] = useState('');
  const [summaryAnswer, setSummaryAnswer] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [audience, setAudience] = useState<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  const [steps, setSteps] = useState<FaqStep[]>([
    { stepNumber: 1, title: '', description: '', imageUrl: '' },
  ]);
  const [allowedImages, setAllowedImages] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { stepNumber: prev.length + 1, title: '', description: '', imageUrl: '' },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepNumber: i + 1 }))
    );
  };

  const updateStep = (index: number, field: keyof FaqStep, val: any) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: val } : s))
    );
  };

  const addAllowedImage = () => {
    setAllowedImages((prev) => [...prev, '']);
  };

  const updateAllowedImage = (index: number, val: string) => {
    setAllowedImages((prev) => prev.map((img, i) => (i === index ? val : img)));
  };

  const removeAllowedImage = (index: number) => {
    setAllowedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Vui lòng nhập câu hỏi thường gặp.');
      return;
    }

    const validSteps = steps
      .filter((s) => s.title.trim() || s.description.trim())
      .map((s, idx) => ({
        stepNumber: idx + 1,
        title: s.title.trim(),
        description: s.description.trim(),
        imageUrl: s.imageUrl?.trim() || undefined,
      }));

    if (!summaryAnswer.trim() && validSteps.length === 0) {
      setError('Vui lòng nhập câu trả lời tóm tắt hoặc ít nhất 1 bước hướng dẫn.');
      return;
    }

    const validAllowedImages = allowedImages
      .map((img) => img.trim())
      .filter((img) => /^https?:\/\//i.test(img));

    setBusy(true);
    setError(null);

    try {
      await api('/ai/pipeline/faq', 'POST', {
        question: question.trim(),
        answer: summaryAnswer.trim() || undefined,
        steps: validSteps.length > 0 ? validSteps : undefined,
        allowedImages: validAllowedImages.length > 0 ? validAllowedImages : undefined,
        categoryId: categoryId || null,
        audience,
      });

      onNotify(`Đã tạo thành công FAQ: "${question.trim()}"`);
      // Reset form
      setQuestion('');
      setSummaryAnswer('');
      setSteps([{ stepNumber: 1, title: '', description: '', imageUrl: '' }]);
      setAllowedImages(['']);
      onSuccess();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err.message || 'Lỗi khi lưu FAQ nhiều bước');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">help_center</span>
            Soạn FAQ Nhiều Bước Kèm Ảnh Minh Họa Được Phép (UC-037)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Định dạng câu trả lời từng bước (step-by-step) với hình ảnh minh họa an toàn, giúp AI Bot giải thích quy trình rõ ràng và hiển thị ảnh đúng ngữ cảnh.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-xs rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Question & Meta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Câu hỏi thường gặp *
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="VD: Làm sao để cài đặt mã nhúng widget lên trang web?"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Danh mục tri thức
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
            >
              <option value="">-- Chưa phân loại --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Answer & Audience Scoping */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tóm tắt câu trả lời (Ngắn gọn)
            </label>
            <textarea
              rows={2}
              value={summaryAnswer}
              onChange={(e) => setSummaryAnswer(e.target.value)}
              placeholder="Bạn có thể cài đặt mã nhúng dễ dàng qua 3 bước sau đây..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Đối tượng sử dụng (Audience Scoping - UC-041)
            </label>
            <div className="space-y-2 mt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="faqAudience"
                  checked={audience === 'PUBLIC'}
                  onChange={() => setAudience('PUBLIC')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">PUBLIC</span>
                <span className="text-slate-400 text-[11px]">(Công khai trên Widget Bot)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="faqAudience"
                  checked={audience === 'INTERNAL'}
                  onChange={() => setAudience('INTERNAL')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="font-semibold text-amber-700 dark:text-amber-400">INTERNAL</span>
                <span className="text-slate-400 text-[11px]">(Chỉ nhân viên nội bộ)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Steps Builder */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">format_list_numbered</span>
              Các bước hướng dẫn chi tiết ({steps.length} bước)
            </h4>
            <button
              type="button"
              onClick={addStep}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Thêm bước tiếp theo
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs">
                    {step.stepNumber}
                  </span>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                    >
                      Xoá bước này
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tiêu đề bước {step.stepNumber} *
                    </label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => updateStep(idx, 'title', e.target.value)}
                      placeholder="VD: Vào Cài đặt kênh -> Chọn Website..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Link hình ảnh minh họa bước này (Tùy chọn)
                    </label>
                    <input
                      type="url"
                      value={step.imageUrl || ''}
                      onChange={(e) => updateStep(idx, 'imageUrl', e.target.value)}
                      placeholder="https://example.com/step-1.png"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Mô tả chi tiết bước {step.stepNumber} *
                  </label>
                  <textarea
                    rows={2}
                    value={step.description}
                    onChange={(e) => updateStep(idx, 'description', e.target.value)}
                    placeholder="Mô tả các thao tác cụ thể người dùng cần làm..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allowed Images Whitelist */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">verified</span>
                Danh sách URL hình ảnh được phép dùng kèm (Allowed Images)
              </h4>
              <p className="text-[11px] text-slate-400">
                Các link ảnh này sẽ được bot nhận diện và gửi kèm cho khách khi trả lời câu hỏi này.
              </p>
            </div>
            <button
              type="button"
              onClick={addAllowedImage}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Thêm link ảnh
            </button>
          </div>

          <div className="space-y-2">
            {allowedImages.map((img, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="url"
                  value={img}
                  onChange={(e) => updateAllowedImage(i, e.target.value)}
                  placeholder="https://cdn.gotek.vn/assets/guide-diagram.png"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"
                />
                {allowedImages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAllowedImage(i)}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {busy ? 'Đang tạo FAQ & Vector...' : 'Lưu FAQ Vào Kho Tri Thức'}
          </button>
        </div>
      </form>
    </div>
  );
};
