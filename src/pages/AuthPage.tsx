import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

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

function getAuthRedirectUrl(path = ''): string {
  const envSiteUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL
      ? String(import.meta.env.VITE_SITE_URL).replace(/\/+$/, '')
      : '';

  const baseUrl =
    envSiteUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) return '/';
  if (!path) return baseUrl;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
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
  if (
    lower.includes('redirect_to') ||
    lower.includes('redirect url') ||
    lower.includes('not allowed')
  ) {
    return 'Tautan pengalihan (redirect URL) belum diizinkan di pengaturan Supabase Auth. Pastikan URL aplikasi sudah terdaftar di Redirect URLs Supabase.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Email atau password belum sesuai. Silakan periksa kembali atau gunakan fitur Lupa password.';
  }
  if (lower.includes('email rate limit exceeded') || lower.includes('too many requests')) {
    return 'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu beberapa menit lalu coba lagi.';
  }
  return rawMessage;
}

export function AuthPage({ onNavigate }: AuthPageProps) {
  const { isDark } = useTheme();

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
            emailRedirectTo: getAuthRedirectUrl(),
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

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setEmailAlreadyRegistered(true);
          setErrorMsg('Email ini sudah terdaftar di HPP-Kilat.');
          return;
        }

        if (data.session) {
          onNavigate('/app');
          return;
        }

        setMessage(
          'Pendaftaran berhasil. Silakan cek kotak masuk email (atau folder Spam) untuk konfirmasi akun, lalu masuk.'
        );
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getAuthRedirectUrl(),
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

  const inputClass = isDark
    ? 'border-slate-700/80 bg-slate-950/80 text-white placeholder-slate-500 focus:border-emerald-400'
    : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white';

  return (
    <div
      className={`flex min-h-screen items-center justify-center px-4 py-8 transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div
        className={`w-full max-w-md rounded-3xl border p-6 transition-colors duration-300 sm:p-7 ${
          isDark
            ? 'border-slate-800/90 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 shadow-2xl shadow-black/60 ring-1 ring-white/5'
            : 'border-slate-200 bg-white shadow-xl shadow-slate-900/5'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`text-xs font-medium transition ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            &larr; Kembali ke Beranda
          </button>
          <span className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-2.5 py-1 text-xs font-bold text-slate-950">
            HPP-Kilat
          </span>
        </div>

        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {titleByMode[mode]}
        </h1>
        <p
          className={`mt-1.5 text-xs leading-relaxed sm:text-sm ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {subtitleByMode[mode]}
        </p>

        {(mode === 'login' || mode === 'signup') && (
          <div
            className={`mt-5 grid grid-cols-2 gap-1.5 rounded-2xl border p-1 text-xs font-semibold ${
              isDark ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-slate-100'
            }`}
          >
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`rounded-xl py-2.5 transition ${
                mode === 'login'
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
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
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs sm:text-sm">
          {mode !== 'recovery' && (
            <div>
              <label
                htmlFor="auth-email"
                className={`block font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
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
                className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 focus:outline-none ${inputClass}`}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-phone"
                className={`block font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
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
                className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 focus:outline-none ${inputClass}`}
              />
              <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Dipakai untuk info akun &amp; koordinasi promo/bantuan UMKM.
              </p>
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className={`block font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFeedback();
                      setMode('forgot');
                    }}
                    className={`text-xs font-medium hover:underline ${
                      isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
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
                  className={`w-full rounded-xl border py-2.5 pl-3.5 pr-20 focus:outline-none ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className={`absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    isDark
                      ? 'border-slate-700/80 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <EyeIcon open={showPassword} />
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'recovery' && (
            <div>
              <label
                htmlFor="new-password"
                className={`block font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
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
                  className={`w-full rounded-xl border py-2.5 pl-3.5 pr-20 focus:outline-none ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className={`absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    isDark
                      ? 'border-slate-700/80 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <EyeIcon open={showPassword} />
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              className={`rounded-2xl border p-3 text-xs leading-relaxed ${
                isDark
                  ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
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
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                      isDark
                        ? 'border-rose-300/30 bg-slate-950/60 text-rose-100 hover:bg-slate-900'
                        : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100/60'
                    }`}
                  >
                    Lupa password?
                  </button>
                </div>
              )}
            </div>
          )}

          {message && (
            <div
              className={`rounded-2xl border p-3 text-xs leading-relaxed ${
                isDark
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
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
              className={`w-full rounded-xl border py-2.5 text-xs font-medium transition ${
                isDark
                  ? 'border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              Kembali ke halaman Masuk
            </button>
          )}
        </form>

        <div
          className={`mt-6 border-t pt-4 text-center ${
            isDark ? 'border-slate-800/80' : 'border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => onNavigate('/app')}
            className={`text-xs font-medium underline-offset-4 hover:underline ${
              isDark ? 'text-slate-400 hover:text-emerald-300' : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            Lanjut coba kalkulator tanpa login
          </button>
        </div>
      </div>
    </div>
  );
}