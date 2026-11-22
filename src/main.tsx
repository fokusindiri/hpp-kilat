import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { AppShell } from './pages/AppShell';

function RootRouter() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (to === window.location.pathname) return;
    window.history.pushState({}, '', to);
    setPathname(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (pathname === '/masuk') {
    return <AuthPage onNavigate={navigate} />;
  }

  if (pathname.startsWith('/app')) {
    return <AppShell onNavigate={navigate} />;
  }

  return <LandingPage onNavigate={navigate} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>
);