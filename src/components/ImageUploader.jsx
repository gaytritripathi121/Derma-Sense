import React, { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { validateImageFileClient } from '../utils/validation.js';
import { formatBytes } from '../utils/formatting.js';

export default function ImageUploader({ file, previewUrl, onFileSelect, onClear }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = (files) => {
    const chosen = files?.[0];
    if (!chosen) return;
    const check = validateImageFileClient(chosen);
    if (!check.valid) {
      setError(check.error);
      return;
    }
    setError('');
    onFileSelect(chosen);
  };

  return (
    <div className="space-y-3">
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
        >
          <UploadCloud className="h-9 w-9 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-900">
            Drop a skin lesion photograph here, or browse from disk
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Accepted formats: JPG, JPEG, PNG · Maximum size 15 MB · Minimum 64×64 px
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Select Image File
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Selected lesion preview"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {file.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                <span>{file.type || 'image'}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(file.size)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Image remains in browser/request memory for ephemeral screening and Grad-CAM generation only.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  Replace Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    onClear();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 whitespace-nowrap"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
