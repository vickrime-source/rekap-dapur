import { useState, useCallback } from 'react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title?: string;
  message: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function useConfirmDialog() {
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);

  const openConfirm = useCallback((config: {
    title?: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmState({
      isOpen: true,
      title: config.title,
      message: config.message,
      isLoading: false,
      onConfirm: config.onConfirm,
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => (prev?.isLoading ? prev : null));
  }, []);

  return {
    confirmState,
    setConfirmState,
    openConfirm,
    closeConfirm,
  };
}
