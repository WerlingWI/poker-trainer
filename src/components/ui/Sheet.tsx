import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Overlay, das auf dem Handy von unten hereinfährt und auf dem Desktop
 * als zentriertes Fenster erscheint.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Hintergrund nicht mitscrollen lassen, solange das Sheet offen ist.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-[var(--shadow-lift)] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="flex size-11 items-center justify-center rounded-xl text-2xl text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
