interface NeuToastProps {
  message: string;
  visible: boolean;
}

export function NeuToast({ message, visible }: NeuToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`neu-raised fixed bottom-24 left-1/2 z-50 -translate-x-1/2 px-6 py-3 text-sm font-semibold text-neu-accent transition-opacity duration-200 md:bottom-8 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
