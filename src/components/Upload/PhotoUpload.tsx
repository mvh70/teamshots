"use client";

import React, {useCallback, useEffect, useRef, useState, startTransition} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { PlusIcon } from "@heroicons/react/24/outline";
import { InlineError, LoadingSpinner } from "@/components/ui";
import { useDeviceCapabilities } from "@/hooks/useDeviceCapabilities";
import CameraPermissionError from "@/components/Upload/CameraPermissionError";
import type { UploadMetadata, UploadResult } from "@/hooks/useUploadFlow";
import { validateSelfieFace } from "@/lib/face-detection";

type PhotoUploadProps = {
  disabled?: boolean;
  maxFileSizeMb?: number;
  accept?: string;
  multiple?: boolean;
  onSelect?: (file: File | File[]) => void;
  onUpload?: (file: File, metadata?: UploadMetadata) => Promise<UploadResult | void>;
  onUploaded?: (result: UploadResult | UploadResult[], metadata?: UploadMetadata | UploadMetadata[]) => void;
  testId?: string;
  autoOpenCamera?: boolean;
  isProcessing?: boolean;
  onCameraError?: (message: string) => void;
  /** Layout for camera/upload buttons: 'vertical' (default) or 'horizontal' (side-by-side) */
  buttonLayout?: 'vertical' | 'horizontal';
  /** Hide the plus icon (useful for compact/sticky layouts) */
  hidePlusIcon?: boolean;
};

export default function PhotoUpload({
  disabled,
  maxFileSizeMb = 50,
  accept = "image/*",
  multiple = false,
  onSelect,
  onUpload,
  onUploaded,
  testId = "file-input",
  autoOpenCamera = false,
  isProcessing = false,
  onCameraError,
  buttonLayout = 'vertical',
  hidePlusIcon = false
}: PhotoUploadProps) {
  const t = useTranslations("common");
  const tMobileHandoff = useTranslations("mobileHandoff");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoRefMobile = useRef<HTMLVideoElement | null>(null);
  const videoRefDesktop = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const device = useDeviceCapabilities();
  const { isIOSDevice, preferNativeCamera, isMobile } = device;
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Validation error shown in spinner area (separate from inline errors)
  const [validationError, setValidationError] = useState<string | null>(null);
  const validationErrorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadingFileCount, setUploadingFileCount] = useState<number>(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  // Desktop camera modal drag state
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 32 }); // Start near top (32px = pt-8)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const hasAutoOpenedRef = useRef(false);
  const awaitingIOSCameraCaptureRef = useRef(false);
  const resetUploadState = () => {
    setIsUploading(false);
    setUploadingFileCount(0);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (validationErrorTimerRef.current) clearTimeout(validationErrorTimerRef.current);
    };
  }, [previewUrl, previewUrls, stream]);

  // Helper to show validation error with auto-dismiss
  // When camera is open, immediately re-enable capture button
  const showValidationError = useCallback((message: string, autoDismissMs = 4000) => {
    // Clear any existing timer
    if (validationErrorTimerRef.current) {
      clearTimeout(validationErrorTimerRef.current);
    }
    setValidationError(message);

    // If camera is open, immediately re-enable capture button
    // (error shows in camera overlay, user can retry right away)
    if (cameraOpen) {
      setIsUploading(false);
      setUploadingFileCount(0);
    }

    // Auto-dismiss after delay
    validationErrorTimerRef.current = setTimeout(() => {
      setValidationError(null);
      // Only reset uploading state if not already reset (camera case)
      if (!cameraOpen) {
        setIsUploading(false);
        setUploadingFileCount(0);
      }
    }, autoDismissMs);
  }, [cameraOpen]);


  // Simple: show spinner if uploading OR parent is processing
  const showSpinner = isUploading || isProcessing;

  // Auto-open camera if requested (moved below openCamera declaration)

  const validateFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return "Only image files are allowed";
    }
    const maxBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {

      return `File size too large. Maximum allowed size is ${maxFileSizeMb}MB`;
    }
    return null;
  };

  // Face detection is now handled by validateSelfieFace from face-detection utility
  // This uses BlazeFace model for accurate detection across all skin tones

  const reportCameraError = useCallback(
    (message: string, type?: string) => {
      const errorType = type ?? 'camera-error'
      setError(message)
      setErrorType(errorType)
      // Only call onCameraError for non-camera errors, or camera errors that won't show the modal
      // Camera errors starting with 'camera-' will show the modal instead
      if (!errorType.startsWith('camera-')) {
        onCameraError?.(message)
      }
    },
    [onCameraError]
  )

  const buildMetadata = useCallback(
    (file: File, overrides?: Partial<UploadMetadata>): UploadMetadata => {
      const source =
        overrides?.source ||
        (awaitingIOSCameraCaptureRef.current
          ? 'ios-camera'
          : file.name.startsWith('capture-')
          ? 'camera'
          : 'file')

      return {
        source,
        objectUrl: overrides?.objectUrl
      }
    },
    []
  )

  const handleFile = async (file: File, overrides?: Partial<UploadMetadata>): Promise<boolean> => {
    // Show spinner immediately when file is selected
    setIsUploading(true);
    setUploadingFileCount(1);
    setError(null);
    setErrorType(null);
    setValidationError(null);
    if (validationErrorTimerRef.current) {
      clearTimeout(validationErrorTimerRef.current);
    }

    const err = validateFile(file);
    if (err) {
      // Show error in spinner area with auto-dismiss
      showValidationError(err);
      return false;
    }

    // Check for face detection using BlazeFace model
    console.log('[PhotoUpload] Starting face validation for file:', file.name)
    const faceValidation = await validateSelfieFace(file);
    console.log('[PhotoUpload] Face validation result:', faceValidation)
    if (!faceValidation.isValid) {
      // Show error in spinner area with auto-dismiss
      showValidationError(faceValidation.error || "Face validation failed. Please upload a photo with one clear face.");
      return false;
    }

    const preview = URL.createObjectURL(file);
    const metadata = buildMetadata(file, { ...overrides, objectUrl: preview })

    if (multiple) {
      setPreviewUrls((prev) => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return [...prev, preview];
      });
    } else {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
    }
    onSelect?.(file);

    if (onUpload) {
      try {
        // Add timeout handling for upload
        const uploadPromise = onUpload(file, metadata);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Upload timeout. Please try again.")), 10000)
        );
        
        const result = await Promise.race([uploadPromise, timeoutPromise]) as UploadResult | void;
        if (result && result.key) {
          // Call onUploaded - parent will set isProcessing=true and keep spinner visible
          // Keep isUploading true until parent hides component
          const finalResult: UploadResult = {
            key: result.key,
            url: result.url || preview,
            source: result.source || metadata.source  // Use result.source first, fallback to metadata.source
          }
          // Ensure URL is always set for camera sources to show approval flow
          if ((finalResult.source === 'camera' || finalResult.source === 'ios-camera') && !finalResult.url) {
            finalResult.url = preview
          }
          onUploaded?.(finalResult, metadata);
          resetUploadState();
          return true;
        } else {
          // No result - reset state
          resetUploadState();
          return false;
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Upload failed";
        if (errorMessage.includes("timeout")) {
          setError("Upload timeout. Please check your connection and try again.");
        } else {
          setError(errorMessage);
        }
        setIsUploading(false);
        setUploadingFileCount(0);
        return false;
      }
    } else {
      setIsUploading(true);
      setUploadingFileCount(1);
      try {
        const result = await defaultUpload(file);
        if (result && result.key) {
          // Call onUploaded - parent will set isProcessing=true and keep spinner visible
          // Keep isUploading true until parent hides component
          const finalResult: UploadResult = { key: result.key, url: preview, source: metadata.source }
          onUploaded?.(finalResult, metadata);
          resetUploadState();
          return true;
        } else {
          // No result - reset state
          resetUploadState();
          return false;
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Upload failed";
        if (errorMessage.includes("timeout")) {
          setError("Upload timeout. Please check your connection and try again.");
        } else {
          setError(errorMessage);
        }
        setIsUploading(false);
        setUploadingFileCount(0);
        return false;
      }
    }
  };

  const handleFiles = async (files: File[]) => {
    // Show spinner immediately
    setIsUploading(true);
    setUploadingFileCount(files.length);
    setError(null);
    setErrorType(null);
    setValidationError(null);
    if (validationErrorTimerRef.current) {
      clearTimeout(validationErrorTimerRef.current);
    }

    const validFiles: File[] = [];
    const errors: string[] = [];
    const previews: string[] = [];
    const uploadResults: UploadResult[] = [];
    const metadataList: UploadMetadata[] = [];

    // Validate all files first
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const err = validateFile(file);
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }

      // Check for face detection using BlazeFace model
      console.log('[PhotoUpload] Starting face validation for file (multiple):', file.name)
      const faceValidation = await validateSelfieFace(file);
      console.log('[PhotoUpload] Face validation result (multiple):', faceValidation)
      if (!faceValidation.isValid) {
        errors.push(`${file.name}: ${faceValidation.error || "Face validation failed"}`);
        continue;
      }

      validFiles.push(file);
      const preview = URL.createObjectURL(file);
      previews.push(preview);
      metadataList.push(buildMetadata(file, { objectUrl: preview }));
    }

    // Show errors if any - use spinner area for all-failed case
    if (errors.length > 0) {
      if (validFiles.length === 0) {
        // All files failed - show in spinner area with auto-dismiss
        const errorMsg = files.length === 1
          ? errors[0].split(': ').slice(1).join(': ') // Single file: show just the error
          : `${errors.length} file(s) failed validation`;
        showValidationError(errorMsg);
        return false;
      }
      // Some files passed - continue processing but note errors
      setError(errors.join('; '));
      setErrorType('validation-error');
    }

    // Update previews
    setPreviewUrls((prev) => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return previews;
    });

    // Call onSelect with all valid files
    onSelect?.(validFiles);

    // Upload all valid files
    if (onUpload) {
      try {
        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const metadata = metadataList[i];
          
          const uploadPromise = onUpload(file, metadata);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Upload timeout. Please try again.")), 10000)
          );
          
          const result = await Promise.race([uploadPromise, timeoutPromise]) as UploadResult | void;
          if (result && result.key) {
            uploadResults.push({
              key: result.key,
              url: result.url || previews[i],
              source: metadata.source
            });
          }
        }
        if (uploadResults.length > 0) {
          // Call onUploaded - parent will set isProcessing=true and keep spinner visible
          // Keep isUploading true until parent hides component
          onUploaded?.(multiple ? uploadResults : uploadResults[0], multiple ? metadataList : metadataList[0]);
          resetUploadState();
        } else {
          // No successful uploads - reset state
          resetUploadState();
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Upload failed";
        if (errorMessage.includes("timeout")) {
          setError("Upload timeout. Please check your connection and try again.");
        } else {
          setError(errorMessage);
        }
        setIsUploading(false);
        setUploadingFileCount(0);
      }
    } else {
      try {
        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          const metadata = metadataList[i];
          
          const result = await defaultUpload(file);
          if (result && result.key) {
            uploadResults.push({
              key: result.key,
              url: previews[i],
              source: metadata.source
            });
          }
        }
        if (uploadResults.length > 0) {
          // Call onUploaded - parent will set isProcessing=true and keep spinner visible
          // Keep isUploading true until parent hides component
          onUploaded?.(multiple ? uploadResults : uploadResults[0], multiple ? metadataList : metadataList[0]);
          resetUploadState();
        } else {
          // No successful uploads - reset state
          resetUploadState();
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Upload failed";
        if (errorMessage.includes("timeout")) {
          setError("Upload timeout. Please check your connection and try again.");
        } else {
          setError(errorMessage);
        }
        setIsUploading(false);
        setUploadingFileCount(0);
      }
    }
  };

  const defaultUpload = async (file: File): Promise<UploadResult> => {
    // Server-side proxy upload to avoid CORS issues
    const ext = file.name.split('.')?.pop()?.toLowerCase();
    setIsUploading(true);
    const res = await fetch('/api/uploads/proxy', {
      method: 'POST',
      headers: {
        'x-file-content-type': file.type,
        'x-file-extension': ext || '',
        'x-file-type': 'selfie'
      },
      body: file,
      credentials: 'include' // Required for Safari to send cookies
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Upload failed');
    }
    const { key } = await res.json();
    setIsUploading(false);
    return { key };
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (multiple && files.length > 1) {
      await handleFiles(files);
    } else {
      await handleFile(files[0]);
    }
    awaitingIOSCameraCaptureRef.current = false;
    
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    
    if (multiple && files.length > 1) {
      await handleFiles(files);
    } else {
      await handleFile(files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const openFilePicker = () => inputRef.current?.click();

  const openCamera = useCallback(async () => {
    setError(null);
    setErrorType(null);

    if (preferNativeCamera) {
      awaitingIOSCameraCaptureRef.current = isIOSDevice;
      if (isIOSDevice) {
        cameraInputRef.current?.click();
      } else {
        inputRef.current?.click();
      }
      return false;
    }
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reportCameraError("Camera not supported in this browser", 'camera-not-supported');
        return false;
      }
      
      try {
        await navigator.permissions.query({ name: 'camera' as PermissionName });
      } catch {
        // Permission query failed, continue with direct access
      }
      
      const s = await navigator.mediaDevices.getUserMedia({ 
        audio: false, 
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      setStream(s);
      setCameraOpen(true);
      setCameraReady(false);
      awaitingIOSCameraCaptureRef.current = false;

      if (typeof window !== 'undefined' && (isMobile || isIOSDevice)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Camera access error:", error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          reportCameraError("Camera access denied", 'camera-permission-denied');
        } else if (error.name === 'NotFoundError') {
          reportCameraError("No camera found on this device.", 'camera-not-found');
        } else if (error.name === 'NotSupportedError') {
          reportCameraError("Camera not supported in this browser.", 'camera-not-supported');
        } else if (error.name === 'OverconstrainedError') {
          reportCameraError("Camera constraints not supported. Trying with basic settings...", 'camera-error');
          try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
            setStream(s);
            setCameraOpen(true);
            setCameraReady(false);
            return false;
          } catch {
            reportCameraError("Camera access failed even with basic settings.", 'camera-error');
          }
        } else {
          reportCameraError(`Camera error: ${error.message}`);
        }
      } else {
        reportCameraError("Unable to access camera");
      }
    }
  }, [preferNativeCamera, isIOSDevice, isMobile, reportCameraError]);

  const closeCamera = () => {
    setCameraOpen(false);
    setError(null);
    setErrorType(null);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    awaitingIOSCameraCaptureRef.current = false;
    // Reset modal position when closing
    setModalPosition({ x: 0, y: 32 });
    setIsDragging(false);
  };

  // Desktop camera modal drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!modalRef.current) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y
    };
  }, [modalPosition]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;

    // Keep modal within viewport bounds
    const modalWidth = modalRef.current?.offsetWidth || 400;
    const modalHeight = modalRef.current?.offsetHeight || 400;
    const maxX = window.innerWidth - modalWidth;
    const maxY = window.innerHeight - modalHeight;

    setModalPosition({
      x: Math.max(-maxX / 2, Math.min(maxX / 2, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove drag event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Auto-open camera if requested - use useEffect to handle prop changes properly
  useEffect(() => {
    if (autoOpenCamera && !hasAutoOpenedRef.current && typeof window !== 'undefined' && !cameraOpen) {
      hasAutoOpenedRef.current = true;
      // Use startTransition for non-urgent update
      startTransition(() => {
        openCamera();
      });
    }
  }, [autoOpenCamera, cameraOpen, openCamera]);

  // Attach stream to video after modal renders
  useEffect(() => {
    if (!cameraOpen || !stream) return;
    
    // Capture ref values at the start of the effect for cleanup
    const mobileVideo = videoRefMobile.current;
    const desktopVideo = videoRefDesktop.current;
    
    // Small delay to ensure DOM is ready, especially for mobile portal
    const timeoutId = setTimeout(() => {
      // Determine which video element to use based on screen size and device type
      // Treat iPad as mobile for camera UI
      const useMobileVideo = isMobile || isIOSDevice;
      const v = (useMobileVideo ? videoRefMobile.current : videoRefDesktop.current) as (HTMLVideoElement & { srcObject?: MediaStream }) | null;
      
      // Fallback to the other ref if primary one is not available
      const videoElement = v || videoRefMobile.current || videoRefDesktop.current;
      if (!videoElement) return;
      
      // Set srcObject to attach the stream
      (videoElement as HTMLVideoElement & { srcObject?: MediaStream }).srcObject = stream;
      
      // Update the main videoRef for capture function
      videoRef.current = videoElement;
      
      const onLoaded = async () => {
        try { 
          await videoElement.play(); 
        } catch (error) {
          console.error('Video play error:', error);
          // Retry play after a short delay
          setTimeout(async () => {
            try { 
              await videoElement.play(); 
            } catch (retryError) {
              console.error('Video play retry error:', retryError);
            }
          }, 100);
        }
        
        // If width/height still zero, retry once shortly (Safari quirk)
        if ((videoElement.videoWidth || 0) === 0) {
          setTimeout(async () => {
            try { 
              await videoElement.play(); 
              setCameraReady(true);
            } catch (retryError) {
              console.error('Video play retry error:', retryError);
              setCameraReady(true); // Set ready anyway to allow capture attempts
            }
          }, 200);
        } else {
          setCameraReady(true);
        }
      };
      
      videoElement.onloadedmetadata = onLoaded;
      
      // Also try to play immediately if metadata is already loaded
      if (videoElement.readyState >= 2) {
        onLoaded();
      }
    }, 50);
    
    return () => { 
      clearTimeout(timeoutId);
      if (mobileVideo) {
        mobileVideo.onloadedmetadata = null;
      }
      if (desktopVideo) {
        desktopVideo.onloadedmetadata = null;
      }
    };
  }, [cameraOpen, stream, isIOSDevice, isMobile]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      const success = await handleFile(file, { source: 'camera' });
      // Only close camera if upload was successful
      if (success) {
        closeCamera();
      }
    }, "image/jpeg", 0.92);
  };

  return (
    <div className={`w-full h-full ${hidePlusIcon ? '' : 'min-h-[200px]'}`}>
      {showSpinner ? (
        <div
          className={`rounded-2xl p-4 md:p-8 h-full flex items-center justify-center text-center border ${
            validationError
              ? 'bg-gradient-to-br from-red-50 via-red-50 to-red-100 border-red-200'
              : 'bg-gradient-to-br from-white via-gray-50 to-gray-100 border-gray-200'
          }`}
          data-testid="upload-progress"
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            {validationError ? (
              <>
                {/* Error Icon */}
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                {/* Error Message */}
                <p className="text-base text-red-700 font-medium max-w-xs">
                  {validationError}
                </p>
                {/* Auto-dismiss indicator */}
                <p className="text-xs text-red-500">
                  {t("dismissingAutomatically", { defaultValue: "Dismissing automatically..." })}
                </p>
              </>
            ) : (
              <>
                <LoadingSpinner size="lg" />
                <p className="text-lg text-gray-700 font-medium">
                  {uploadingFileCount > 1
                    ? t("processingImages", { count: uploadingFileCount })
                    : t("processingImage")}
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => { if (e.key === "Enter") openFilePicker(); }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          aria-disabled={disabled}
          aria-label="Upload photo by clicking or dragging and dropping"
          className={hidePlusIcon
            ? "w-full"
            : `rounded-2xl p-3 md:p-6 lg:p-8 h-full flex flex-col items-center justify-center text-center cursor-pointer focus:outline-none transition-all duration-200 ${
            dragOver 
              ? "border-2 border-brand-primary bg-brand-primary/5 shadow-lg scale-[1.01]" 
              : "border border-gray-200 bg-gradient-to-br from-white via-gray-50 to-gray-100 hover:shadow-lg"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          data-testid="dropzone"
        >
          {/* Title - shown on desktop when QR code is also visible */}
          {!isMobile && (
            <h3 className="text-base font-semibold text-gray-900 text-center mb-3">
              {tMobileHandoff('useYourComputer')}
            </h3>
          )}
          <div className={`w-full flex flex-col ${hidePlusIcon ? '' : 'items-center'}`}>
            {/* Plus icon - hidden when hidePlusIcon is true or on desktop */}
            {!hidePlusIcon && isMobile && (
              <div className="mb-2 flex items-center justify-center">
                <PlusIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-400" />
              </div>
            )}
            {/* Buttons - layout controlled by buttonLayout prop */}
            <div className={`flex w-full ${buttonLayout === 'horizontal' ? 'flex-row gap-2' : 'flex-col gap-2'}`}>
              <button
                type="button"
                className={`${buttonLayout === 'horizontal' ? 'flex-1' : 'w-full'} ${hidePlusIcon ? 'px-3 py-3' : 'px-4 py-3'} text-sm font-bold rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover transition-all duration-200 flex items-center justify-center gap-2 ${hidePlusIcon ? 'shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30' : 'shadow-sm hover:shadow-md'} active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={(e) => { e.stopPropagation(); openCamera(); }}
                disabled={disabled}
                aria-label="Open camera to take a photo"
                data-testid="camera-button"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t("useCamera")}</span>
              </button>
              <button
                type="button"
                className={`${buttonLayout === 'horizontal' ? 'flex-1' : 'w-full'} ${hidePlusIcon ? 'px-3 py-3' : 'px-4 py-3'} text-sm font-bold rounded-xl border-2 ${hidePlusIcon ? 'border-gray-200' : 'border-gray-200'} bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2 ${hidePlusIcon ? 'shadow-sm hover:shadow-md' : 'shadow-sm hover:shadow-md'} active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
                disabled={disabled}
                aria-label="Choose a file from your device"
                data-testid="file-picker-button"
              >
                <svg className="w-5 h-5 flex-shrink-0 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{t("uploadPhoto")}</span>
              </button>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={onInputChange}
            disabled={disabled}
            data-testid={testId}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept={accept}
            capture="user"
            className="hidden"
            onChange={onInputChange}
            disabled={disabled}
            data-testid={`${testId}-camera`}
          />
        </div>
      )}

      {(() => {
        // Always show modal for camera errors, even if errorType is somehow not set
        const isCameraError = (errorType && errorType.startsWith('camera-')) ||
                             (error && (error.includes('Camera') || error.includes('camera')))

        if (error && isCameraError) {
          return (
            <CameraPermissionError
              onRetry={() => {
                setError(null);
                setErrorType(null);
                openCamera();
              }}
              onDismiss={() => {
                setError(null);
                setErrorType(null);
              }}
            />
          )
        } else if (error) {
          return <InlineError message={error} className="mt-3" data-testid={errorType || "error-message"} />
        }
        return null
      })()}

      {cameraOpen && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60" data-testid="camera-interface">
          {/* Mobile: Top sheet - fixed to top */}
          <div className="md:hidden fixed top-0 left-0 right-0 bottom-0 bg-white z-[10000] flex flex-col">
            <div className="relative w-full flex-1 min-h-0">
              <video 
                ref={videoRefMobile} 
                className="w-full h-full rounded-none bg-black object-cover" 
                playsInline 
                muted 
                autoPlay
                width="100%"
                style={{ display: 'block' }}
              />
              <canvas ref={canvasRef} className="hidden" />
              {/* Error overlay for mobile - shows both camera errors and validation errors */}
              {(error || validationError) && (
                <div className="absolute top-4 left-4 right-4 z-20">
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-200 shadow-md flex items-center justify-between">
                    <span>{validationError || error}</span>
                    <button
                      onClick={() => {
                        setError(null);
                        setValidationError(null);
                        if (validationErrorTimerRef.current) {
                          clearTimeout(validationErrorTimerRef.current);
                        }
                        setIsUploading(false);
                      }}
                      className="ml-2 text-red-800 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 pb-4 bg-white border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={closeCamera}
                disabled={isUploading}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm rounded-md ${cameraReady ? 'bg-brand-primary text-white hover:bg-brand-primary-hover' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                onClick={capturePhoto}
                disabled={!cameraReady || isUploading}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" className="border-white/30 border-t-white" />
                    {t("processing")}
                  </span>
                ) : (
                  t("capture")
                )}
              </button>
            </div>
          </div>
          {/* Desktop: Draggable modal (positioned near laptop camera) */}
          <div className="hidden md:flex md:items-start md:justify-center h-full">
            <div
              ref={modalRef}
              className="bg-white rounded-lg p-4 w-full max-w-md shadow-lg"
              style={{
                transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
                cursor: isDragging ? 'grabbing' : 'default'
              }}
            >
              {/* Drag handle with instruction text */}
              <div
                className="mb-3 pb-3 border-b border-gray-100 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleDragStart}
              >
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/>
                  </svg>
                  <span>{t("dragCameraInstruction")}</span>
                </div>
              </div>
              <div className="relative w-full">
                <video 
                  ref={videoRefDesktop} 
                  className="w-full rounded-md bg-black aspect-video object-cover" 
                  playsInline 
                  muted 
                  autoPlay
                  width="100%"
                  style={{ display: 'block' }}
                />
                <canvas ref={canvasRef} className="hidden" />
                {/* Error overlay for desktop - shows both camera errors and validation errors */}
                {(error || validationError) && (
                  <div className="absolute top-2 left-2 right-2 z-10">
                    <div className="bg-red-50 text-red-600 px-3 py-2 rounded-md text-sm border border-red-200 shadow-sm flex items-center justify-between">
                      <span>{validationError || error}</span>
                      <button
                        onClick={() => {
                          setError(null);
                          setValidationError(null);
                          if (validationErrorTimerRef.current) {
                            clearTimeout(validationErrorTimerRef.current);
                          }
                          setIsUploading(false);
                        }}
                        className="ml-2 text-red-800 font-bold"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={closeCamera}
                  disabled={isUploading}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-md ${cameraReady ? 'bg-brand-primary text-white hover:bg-brand-primary-hover' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                  onClick={capturePhoto}
                  disabled={!cameraReady || isUploading}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" className="border-white/30 border-t-white" />
                      {t("processing")}
                    </span>
                  ) : (
                    t("capture")
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}


