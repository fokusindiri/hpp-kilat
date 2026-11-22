import React from 'react';
import { PRO_PRICE_LABEL } from '../lib/pricing';

interface UpgradeModalProps {
  open: boolean;
  reason: string;
  userEmail?: string;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  reason,
  userEmail,
  onClose,
}) => {
  if (!open) return null;

  const waNumber = (import.meta.env.VITE_UPGRADE_WHATSAPP as string) || '';
  const message = encodeURIComponent(
    `Halo Sacademy.id, saya ingin upgrade akun HPP-Kilat ke paket Pro. Email akun: ${
      userEmail || '-'
    }`
  );
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${message}` : '#';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div className="w-full max-w-md border border-[rgba(20,33,61,0.2)] bg-[var(--bg-receipt)] p-6 text-[var(--ink-primary)]">
        <h2 id="upgrade-dialog-title" className="text-xl font-bold">
          {reason}
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Paket Gratis dibatasi 3 resep, 15 bahan dan kemasan, serta 4 kanal penjualan.
          Paket Pro membuka penyimpanan tanpa batas.
        </p>
        <p className="mt-2 text-sm font-medium">{PRO_PRICE_LABEL}</p>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 border border-[rgba(20,33,61,0.25)] px-4 text-sm font-medium hover:bg-black/5"
          >
            Hapus atau gabungkan resep lama
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] flex-1 items-center justify-center bg-[var(--accent-cobalt)] px-4 text-sm font-medium text-white hover:opacity-95"
          >
            Upgrade ke Pro
          </a>
        </div>
      </div>
    </div>
  );
};