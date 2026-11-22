import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  onNavigate: (to: string) => void;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'recovery';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function formatAuthError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('invalid path') || lower.includes('redirect_to') || lower.includes('redirect')) {
    return 'Tautan pengalihan (redirect URL) belum diizinkan di pengaturan Supabase Auth. Pastikan URL aplikasi sudah terdaftar di Redirect URLs Supabase.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Email atau password belum sesuai. Silakan periksa kembali atau gunakan fitur Lupa password.';
  }
  return rawMessage;
}

export function AuthPage({ onNavigate }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
        setMessage('Tautan pemulihan terverifikasi. Silakan masukkan password baru kamu.');
        setErrorMsg(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const resetFeedback = () => {
    setMessage(null);
    setErrorMsg(null);
    setEmailAlreadyRegistered(false);
  };

  const switchTab = (next: 'login' | 'signup') => {
    setMode(next);
    resetFeedback();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetFeedback();

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onNavigate('/app');
      } else if (mode === 'signup') {
        const cleanPhone = normalizePhone(phone);
        if (cleanPhone.length < 9) {
          setErrorMsg('Masukkan nomor HP / WhatsApp yang valid (minimal 9 digit).');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: {
              phone: cleanPhone,
            },
          },
        });
        if (error) {
          const lower = error.message.toLowerCase();
          if (lower.includes('already registered') || lower.includes('already exists')) {
            setEmailAlreadyRegistered(true);
            setErrorMsg('Email ini sudah terdaftar di HPP-Kilat.');
            return;
          }
          throw error;
        }

        // Pada beberapa konfigurasi Supabase, email terdaftar mengembalikan user dengan identities kosong
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setEmailAlreadyRegistered(true);
          setErrorMsg('Email ini sudah terdaftar di HPP-Kilat.');
          return;
        }

        setMessage(
          'Pendaftaran berhasil. Silakan cek kotak masuk email jika diminta konfirmasi, atau langsung masuk.'
        );
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/masuk`,
        });
        if (error) throw error;
        setMessage(
          'Link reset password sudah dikirim ke email kamu. Cek folder Inbox atau Spam, lalu klik tautannya.'
        );
      } else if (mode === 'recovery') {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
        setNewPassword('');
        setMessage('Password baru berhasil disimpan. Silakan masuk dengan password barumu.');
        setMode('login');
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Terjadi kesalahan saat autentikasi.';
      setErrorMsg(formatAuthError(raw));
    } finally {
      setLoading(false);
    }
  };

  const titleByMode: Record<AuthMode, string> = {
    login: 'Masuk ke Akun',
    signup: 'Buat Akun Baru',
    forgot: 'Lupa Password',
    recovery: 'Atur Password Baru',
  };

  const subtitleByMode: Record<AuthMode, string> = {
    login: 'Akses resep, bahan baku, dan simulasi margin usahamu dari mana saja.',
    signup: 'Simpan resep dan kalkulasi HPP usaha kamu agar bisa diakses kembali.',
    forgot: 'Masukkan email yang terdaftar untuk menerima tautan reset password.',
    recovery: 'Buat password baru minimal 6 karakter untuk mengamankan akunmu.',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800/90 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 shadow-2xl shadow-black/60 ring-1 ring-white/5 sm:p-7">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-medium text-slate-400 transition hover:text-white"
          >
            &larr; Kembali ke Beranda
          </button>
          <span className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-2.5 py-1 text-xs font-bold text-slate-950">
            HPP-Kilat
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white">{titleByMode[mode]}</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
          {subtitleByMode[mode]}
        </p>

        {/* Tab Masuk / Daftar */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`rounded-xl py-2.5 transition ${
                mode === 'login'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => switchTab('signup')}
              className={`rounded-xl py-2.5 transition ${
                mode === 'signup'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Daftar
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs sm:text-sm">
          {mode !== 'recovery' && (
            <div>
              <label htmlFor="auth-email" className="block font-medium text-slate-300">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailAlreadyRegistered) setEmailAlreadyRegistered(false);
                }}
                placeholder="nama@usaha.com"
                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-phone" className="block font-medium text-slate-300">
                Nomor HP / WhatsApp
              </label>
              <input
                id="auth-phone"
                type="tel"
                required
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="mt-1.5 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Dipakai untuk info akun &amp; koordinasi promo/bantuan UMKM.
              </p>
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="block font-medium text-slate-300">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFeedback();
                      setMode('forgot');
                    }}
                    className="text-xs font-medium text-emerald-400 hover:underline"
                  >
                    Lupa password?
                  </button>
                )}
              </div>

              <div className="relative mt-1.5">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 py-2.5 pl-3.5 pr-20 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  <EyeIcon open={showPassword} />
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'recovery' && (
            <div>
              <label htmlFor="new-password" className="block font-medium text-slate-300">
                Password Baru
              </label>
              <div className="relative mt-1.5">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru (min. 6 karakter)"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 py-2.5 pl-3.5 pr-20 text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  <EyeIcon open={showPassword} />
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200">
              <p>{errorMsg}</p>
              {emailAlreadyRegistered && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition hover:brightness-105"
                  >
                    Masuk pakai email ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetFeedback();
                      setMode('forgot');
                    }}
                    className="rounded-lg border border-rose-300/30 bg-slate-950/60 px-3 py-1.5 text-[11px] font-medium text-rose-100 transition hover:bg-slate-900"
                  >
                    Lupa password?
                  </button>
                </div>
              )}
            </div>
          )}

          {message && (
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? 'Memproses...'
              : mode === 'login'
              ? 'Masuk'
              : mode === 'signup'
              ? 'Daftar Akun'
              : mode === 'forgot'
              ? 'Kirim Link Reset Password'
              : 'Simpan Password Baru'}
          </button>

          {(mode === 'forgot' || mode === 'recovery') && (
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 py-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Kembali ke halaman Masuk
            </button>
          )}
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <button
            type="button"
            onClick={() => onNavigate('/app')}
            className="text-xs font-medium text-slate-400 underline-offset-4 hover:text-emerald-300 hover:underline"
          >
            Lanjut coba kalkulator tanpa login
          </button>
        </div>
      </div>
    </div>
  );
}