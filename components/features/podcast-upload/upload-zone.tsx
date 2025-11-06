"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, File, X, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import toast from "react-hot-toast";

interface UploadZoneProps {
  onFileSelect: (files: File[]) => void;
  disabled?: boolean;
  selectedFiles?: File[];
  onClearFile?: (index?: number) => void;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ACCEPTED_TYPES = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/m4a", "audio/ogg"];

export function UploadZone({ onFileSelect, disabled, selectedFiles: externalSelectedFiles, onClearFile }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalSelectedFiles, setInternalSelectedFiles] = useState<File[]>([]);
  const [showDurationInfo, setShowDurationInfo] = useState(false);
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

  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter(validateFile);

      if (validFiles.length === 0) return;

      if (validFiles.length < files.length) {
        toast.error(`${files.length - validFiles.length} Datei(en) wurden übersprungen (ungültiges Format oder zu groß)`);
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
                  + Weitere Dateien hinzufügen
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
              {isDragging ? "Dateien hier ablegen" : "Podcast-Dateien hochladen"}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Ziehen Sie Audio-Dateien hierher oder klicken Sie zum Auswählen
              <br />
              <span className="text-xs">
                Unterstützt: MP3, WAV, M4A, OGG (max. 500 MB pro Datei)
              </span>
            </p>
          </label>
        )}
      </Card>

      {/* Duration Validation Info Banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <div className="p-4">
          <button
            onClick={() => setShowDurationInfo(!showDurationInfo)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Wie wird die Dauer berechnet?
              </span>
            </div>
            {showDurationInfo ? (
              <ChevronUp className="h-4 w-4 text-blue-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600" />
            )}
          </button>

          {showDurationInfo && (
            <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-900 space-y-2">
              <p>
                Die angezeigte Dauer ist eine Schätzung Ihres Browsers.
                Nach dem Upload validiert unser Server die tatsächliche Länge für eine faire Abrechnung.
              </p>
              <p className="text-xs text-blue-700">
                <strong>Warum validieren wir die Dauer?</strong>
                <br />
                • Faire und genaue Quota-Verwaltung
                <br />
                • Schutz vor Manipulation
                <br />
                • Bei VBR-kodierten Dateien kann es zu kleinen Abweichungen (meist &lt;5%) kommen
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
