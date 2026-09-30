import React, {useState} from 'react';
import {Eye, EyeOff} from 'lucide-react';

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  error?: string[];
  defaultValue?: string;
}

export function Field({
  name,
  label,
  type = 'text',
  required = true,
  maxLength,
  minLength,
  error,
  defaultValue
}: FieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {!required && <span> (tùy chọn)</span>}
      </label>
      <div className="input-row">
        <input
          id={name}
          name={name}
          type={show ? 'text' : type}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          defaultValue={defaultValue}
          autoComplete={type === 'password' ? 'current-password' : name === 'email' ? 'email' : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {type === 'password' && (
          <button
            className="reveal"
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <small id={`${name}-error`} className="field-error">
          {error.join(' ')}
        </small>
      )}
    </div>
  );
}
