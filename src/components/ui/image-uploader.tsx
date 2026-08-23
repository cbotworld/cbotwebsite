'use client';

import React, { useState, useRef } from 'react';
import { Upload, RefreshCw, Trash2, Link as LinkIcon, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadImageToSupabase, normalizeUploadedImageValue, compressImageFile } from '@/lib/supabase';
import { uploadPublicImage } from '@/lib/actions/imageUploadActions';
import { Button } from './button';
import { Input } from './input';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  bucket?: string;
  placeholder?: string;
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  label = 'Team Poster Image',
  bucket = 'teams',
  placeholder = 'Upload poster image or paste URL',
  className = '',
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastSizeNote, setLastSizeNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, WEBP, SVG, etc.)');
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setLastSizeNote(null);

    try {
      const beforeKb = Math.round(file.size / 1024);
      const compressed = await compressImageFile(file, {
        maxEdge: 1000,
        quality: 0.78,
        maxBytes: 350_000,
      });
      const jpegFile = new File([compressed], `${Date.now()}.jpg`, { type: 'image/jpeg' });

      let publicUrl = '';
      try {
        publicUrl = await uploadImageToSupabase(jpegFile, bucket);
      } catch (clientErr) {
        console.warn('Browser storage upload failed, trying server upload:', clientErr);
      }

      if (!publicUrl || publicUrl.startsWith('data:')) {
        const formData = new FormData();
        formData.append('file', jpegFile);
        formData.append('bucket', bucket);
        const res = await uploadPublicImage(formData);
        if (!res.success || !res.url) {
          throw new Error(res.error || 'Could not upload image to public storage');
        }
        publicUrl = res.url;
      }

      onChange(publicUrl);
      setUploadStatus('success');
      setLastSizeNote(`Compressed from ${beforeKb}KB · auto-optimized JPEG`);
    } catch (err) {
      console.error('Failed to upload image:', err);
      setUploadStatus('error');
      setLastSizeNote(
        err instanceof Error
          ? err.message
          : 'Upload failed. The website cannot show inline images — try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlBlur = async () => {
    if (!value?.startsWith('data:image/')) return;
    setIsUploading(true);
    try {
      const normalized = await normalizeUploadedImageValue(value);
      if (normalized && !normalized.startsWith('data:')) {
        onChange(normalized);
        setUploadStatus('success');
        setLastSizeNote('Pasted image compressed & uploaded');
        return;
      }
      const res = await fetch(value);
      const blob = await res.blob();
      const compressed = await compressImageFile(blob);
      const jpegFile = new File([compressed], `pasted-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', jpegFile);
      formData.append('bucket', bucket);
      const uploaded = await uploadPublicImage(formData);
      if (!uploaded.success || !uploaded.url) {
        throw new Error(uploaded.error || 'Could not upload pasted image');
      }
      onChange(uploaded.url);
      setUploadStatus('success');
      setLastSizeNote('Pasted image compressed & uploaded');
    } catch (err) {
      console.error('Failed to normalize pasted image:', err);
      setUploadStatus('error');
      setLastSizeNote(
        err instanceof Error ? err.message : 'Pasted image could not be uploaded to public storage'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    onChange('');
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground block mb-0.5">{label}</label>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium transition-colors flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" />
            {showUrlInput ? 'Use File Upload' : 'Paste Direct URL'}
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Direct URL Input Mode */}
      {showUrlInput ? (
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              void handleUrlBlur();
            }}
            placeholder={placeholder || 'https://...'}
            className="text-xs border-amber-500/30 focus:border-amber-500"
          />
          <p className="text-[10px] text-muted-foreground">
            Paste a public URL. If you paste a large base64 image, it is compressed automatically on blur.
          </p>
          {value && (
            <div className="relative h-28 w-full rounded-lg overflow-hidden border border-border bg-black/40 flex items-center justify-center">
              <img src={value} alt="Preview" className="h-full w-full object-contain" />
            </div>
          )}
        </div>
      ) : (
        /* Visual Upload Card & Dropzone */
        <div className="space-y-2">
          {value ? (
            /* Current Image Preview & Replace Controls */
            <div className="relative border border-amber-500/40 rounded-xl p-3 bg-amber-500/5 backdrop-blur-sm transition-all hover:border-amber-500/60">
              <div className="flex items-center gap-4">
                {/* Image Thumbnail */}
                <div className="relative h-20 w-24 rounded-lg overflow-hidden border border-amber-500/30 bg-black/60 shrink-0 group">
                  <img
                    src={value}
                    alt="Team Poster"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ImageIcon className="h-5 w-5 text-amber-400" />
                  </div>
                </div>

                {/* Info & Replace / Remove Buttons */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 truncate">Poster Loaded</span>
                    {uploadStatus === 'success' && !value.startsWith('data:') && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Compressed & uploaded
                      </span>
                    )}
                    {uploadStatus === 'error' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                        <AlertCircle className="h-3 w-3" /> Upload failed
                      </span>
                    )}
                  </div>
                  {lastSizeNote ? (
                    <p className={`text-[10px] font-medium ${uploadStatus === 'error' ? 'text-rose-400' : 'text-emerald-400/90'}`}>
                      {lastSizeNote}
                    </p>
                  ) : null}
                  {value.startsWith('data:') ? (
                    <p className="text-[11px] text-rose-400 font-semibold">
                      Inline preview only — the website will not show this. Click Replace Image, then Save.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground truncate font-mono bg-black/20 px-2 py-1 rounded border border-border/40">
                      {value}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTriggerUpload}
                      disabled={isUploading}
                      className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 font-semibold flex items-center gap-1.5"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3" /> Replace Image
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      disabled={isUploading}
                      className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Dropzone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleTriggerUpload}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-amber-400 bg-amber-500/20 scale-[0.99]'
                  : 'border-amber-500/30 hover:border-amber-500/60 bg-muted/20 hover:bg-amber-500/5'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  {isUploading ? (
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {isUploading ? 'Uploading image to Supabase...' : 'Click to Upload or Drag & Drop'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Auto-compressed to max 1000px / ~350KB JPEG, then uploaded to Supabase
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
