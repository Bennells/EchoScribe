"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import toast from "react-hot-toast";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  selectedFile?: File | null;
  onClearFile?: () => void;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ACCEPTED_TYPES = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/m4a", "audio/ogg"];

export function UploadZone({ onFileSelect, disabled, selectedFile: externalSelectedFile, onClearFile }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalSelectedFile, setInternalSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use external selectedFile if provided (controlled), otherwise use internal state (uncontrolled)
  const selectedFile = externalSelectedFile !== undefined ? externalSelectedFile : internalSelectedFile;

  // Clear file input when selectedFile is cleared
  useEffect(() => {
    if (!selectedFile && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFile]);

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Datei ist zu groß. Maximale Größe: 500 MB");
      return false;
    }

    // Check file type
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
      toast.error("Ungültiger Dateityp. Erlaubt: MP3, WAV, M4A, OGG");
      return false;
    }

    return true;
  };

  const handleFile = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;

      setInternalSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, handleFile]
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
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const clearFile = () => {
    if (onClearFile) {
      onClearFile();
    } else {
      setInternalSelectedFile(null);
    }
  };

  return (
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
      />

      {selectedFile ? (
        <div className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <File className="h-10 w-10 text-primary" />
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!disabled && (
              <Button variant="ghost" size="sm" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
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
            {isDragging ? "Datei hier ablegen" : "Podcast-Datei hochladen"}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Ziehen Sie eine Audio-Datei hierher oder klicken Sie zum Auswählen
            <br />
            <span className="text-xs">
              Unterstützt: MP3, WAV, M4A, OGG (max. 500 MB)
            </span>
          </p>
        </label>
      )}
    </Card>
  );
}
