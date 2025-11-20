"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import toast from "react-hot-toast";

interface UploadZoneProps {
  onFileSelect: (files: File[]) => void;
  disabled?: boolean;
  selectedFiles?: File[];
  onClearFile?: (index?: number) => void;
}

const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250 MB
const ACCEPTED_TYPES = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/m4a", "audio/ogg"];

export function UploadZone({ onFileSelect, disabled, selectedFiles: externalSelectedFiles, onClearFile }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalSelectedFiles, setInternalSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use external selectedFiles if provided (controlled), otherwise use internal state (uncontrolled)
  const selectedFiles = externalSelectedFiles !== undefined ? externalSelectedFiles : internalSelectedFiles;

  // Clear file input when selectedFiles is cleared
  useEffect(() => {
    if (selectedFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFiles]);

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Maximum size: 250 MB");
      return false;
    }

    // Check file type
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
      toast.error("Invalid file type. Allowed: MP3, WAV, M4A, OGG");
      return false;
    }

    return true;
  };

  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter(validateFile);

      if (validFiles.length === 0) return;

      if (validFiles.length < files.length) {
        toast.error(`${files.length - validFiles.length} file(s) were skipped (invalid format or too large)`);
      }

      setInternalSelectedFiles(prev => [...prev, ...validFiles]);
      onFileSelect(validFiles);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  const clearFile = (index?: number) => {
    if (onClearFile) {
      onClearFile(index);
    } else {
      if (index !== undefined) {
        setInternalSelectedFiles(prev => prev.filter((_, i) => i !== index));
      } else {
        setInternalSelectedFiles([]);
      }
    }
  };

  return (
    <div className="space-y-3">
      <Card
        className={`relative border-2 border-dashed transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="file-upload"
          ref={fileInputRef}
          className="hidden"
          accept=".mp3,.wav,.m4a,.ogg,audio/*"
          onChange={handleFileInput}
          disabled={disabled}
          multiple
        />

        {selectedFiles.length > 0 ? (
          <div className="p-8">
            <div className="space-y-3">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="h-10 w-10 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!disabled && (
                    <Button variant="ghost" size="sm" onClick={() => clearFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {!disabled && (
              <div className="mt-4 pt-4 border-t">
                <label
                  htmlFor="file-upload"
                  className="text-sm text-primary hover:underline cursor-pointer"
                >
                  + Add more files
                </label>
              </div>
            )}
          </div>
        ) : (
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center p-12 ${
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <Upload
              className={`h-12 w-12 mb-4 ${
                isDragging ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <p className="text-lg font-medium mb-2">
              {isDragging ? "Drop files here" : "Upload podcast files"}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Drag and drop audio files here or click to select
              <br />
              <span className="text-xs">
                Supported: MP3, WAV, M4A, OGG (max. 250 MB per file)
              </span>
            </p>
          </label>
        )}
      </Card>
    </div>
  );
}
