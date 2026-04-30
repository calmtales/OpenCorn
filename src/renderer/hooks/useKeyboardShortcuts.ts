import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onSubmit?: () => void;
  onCancel?: () => void;
  onSettings?: () => void;
  onHistory?: () => void;
  onPromptCraft?: () => void;
  onComfyUI?: () => void;
  onLocalModels?: () => void;
  onPresets?: () => void;
  onBatch?: () => void;
  onShortcuts?: () => void;
  onFullscreen?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + Enter = submit
      if (mod && e.key === "Enter") {
        e.preventDefault();
        handlers.onSubmit?.();
        return;
      }

      // Escape = cancel / close panels
      if (e.key === "Escape") {
        e.preventDefault();
        handlers.onEscape?.();
        return;
      }

      // Cmd/Ctrl + , = settings
      if (mod && e.key === ",") {
        e.preventDefault();
        handlers.onSettings?.();
        return;
      }

      // Cmd/Ctrl + h = history
      if (mod && e.key === "h") {
        e.preventDefault();
        handlers.onHistory?.();
        return;
      }

      // Cmd/Ctrl + p = prompt craft
      if (mod && e.key === "p") {
        e.preventDefault();
        handlers.onPromptCraft?.();
        return;
      }

      // Cmd/Ctrl + k = comfyui
      if (mod && e.key === "k") {
        e.preventDefault();
        handlers.onComfyUI?.();
        return;
      }

      // Cmd/Ctrl + l = local models
      if (mod && e.key === "l") {
        e.preventDefault();
        handlers.onLocalModels?.();
        return;
      }

      // Cmd/Ctrl + Shift + p = presets
      if (mod && e.shiftKey && e.key === "P") {
        e.preventDefault();
        handlers.onPresets?.();
        return;
      }

      // Cmd/Ctrl + b = batch mode
      if (mod && e.key === "b") {
        e.preventDefault();
        handlers.onBatch?.();
        return;
      }

      // Cmd/Ctrl + / = shortcuts modal
      if (mod && e.key === "/") {
        e.preventDefault();
        handlers.onShortcuts?.();
        return;
      }

      // Cmd/Ctrl + f = fullscreen player
      if (mod && e.key === "f") {
        e.preventDefault();
        handlers.onFullscreen?.();
        return;
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
