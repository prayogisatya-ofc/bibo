interface Window {
  __spoken?: Array<{ text: string; at: number }>;
  __ttsCancelled?: number;
  __stt?: {
    interim: (text: string) => void;
    final: (transcript: string, alternatives?: string[]) => void;
    error: (code: string, message: string) => void;
  };
}
