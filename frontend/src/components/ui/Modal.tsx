import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* A caixa branca do modal. */}
      <div
        className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl"
        // Impede que um clique DENTRO do modal feche a janela.
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
