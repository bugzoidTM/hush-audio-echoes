
import React, { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { validateFileSize, validateMimeType, validateAudioDuration } from '@/utils/inputSanitization';
import { useSecurityLogger } from '@/hooks/useSecurityLogger';

interface SecureAudioUploadProps {
  onUpload: (file: File) => Promise<void>;
  maxSize?: number;
  allowedTypes?: string[];
}

const SecureAudioUpload: React.FC<SecureAudioUploadProps> = ({
  onUpload,
  maxSize = 52428800, // 50MB
  allowedTypes = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
}) => {
  const [uploading, setUploading] = useState(false);
  const { logSuspiciousActivity } = useSecurityLogger();

  const validateAudioFile = async (file: File): Promise<boolean> => {
    // Check file size
    if (!validateFileSize(file.size)) {
      toast({
        title: "File too large",
        description: "Audio file must be under 50MB",
        variant: "destructive"
      });
      logSuspiciousActivity('file_size_violation', {
        filename: file.name,
        size: file.size,
        maxSize
      });
      return false;
    }

    // Check MIME type
    if (!validateMimeType(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only audio files are allowed",
        variant: "destructive"
      });
      logSuspiciousActivity('invalid_mime_type', {
        filename: file.name,
        type: file.type,
        allowedTypes
      });
      return false;
    }

    // Additional security: Check file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeTypeMap: Record<string, string[]> = {
      'audio/mp3': ['mp3'],
      'audio/mpeg': ['mp3', 'mpeg'],
      'audio/wav': ['wav'],
      'audio/ogg': ['ogg'],
      'audio/webm': ['webm'],
      'audio/mp4': ['mp4', 'm4a']
    };

    const expectedExtensions = mimeTypeMap[file.type] || [];
    if (extension && !expectedExtensions.includes(extension)) {
      toast({
        title: "File type mismatch",
        description: "File extension doesn't match the file type",
        variant: "destructive"
      });
      logSuspiciousActivity('file_extension_mismatch', {
        filename: file.name,
        extension,
        mimeType: file.type
      });
      return false;
    }

    // Check audio duration using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      if (!validateAudioDuration(audioBuffer.duration)) {
        toast({
          title: "Audio too long",
          description: "Audio must be under 10 minutes",
          variant: "destructive"
        });
        logSuspiciousActivity('audio_duration_violation', {
          filename: file.name,
          duration: audioBuffer.duration
        });
        return false;
      }
      
      audioContext.close();
    } catch (error) {
      console.error('Audio validation error:', error);
      toast({
        title: "Invalid audio file",
        description: "Unable to process the audio file",
        variant: "destructive"
      });
      logSuspiciousActivity('audio_processing_error', {
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const isValid = await validateAudioFile(file);
      if (isValid) {
        await onUpload(file);
        toast({
          title: "Upload successful",
          description: "Your audio file has been uploaded securely"
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file",
        variant: "destructive"
      });
      logSuspiciousActivity('upload_error', {
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept={allowedTypes.join(',')}
        onChange={handleFileUpload}
        disabled={uploading}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      
      {uploading && (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Validating and uploading...</span>
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        <p>• Maximum file size: 50MB</p>
        <p>• Maximum duration: 10 minutes</p>
        <p>• Allowed formats: MP3, WAV, OGG, WebM, MP4</p>
      </div>
    </div>
  );
};

export default SecureAudioUpload;
