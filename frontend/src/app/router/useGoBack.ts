// src/app/router/useGoBack.ts
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const HOME_PATH = '/overview';

/**
 * Back navigation for the top bar. idx > 0 means this tab has an earlier
 * entry inside the app; otherwise (deep link / reload) go to the overview
 * instead of leaving the app.
 */
export function useGoBack() {
  const navigate = useNavigate();

  return useCallback(() => {
    const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
    if (canGoBack) navigate(-1);
    else navigate(HOME_PATH, { replace: true });
  }, [navigate]);
}