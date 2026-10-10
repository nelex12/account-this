// src/app/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';

import ThemeProvider from './providers/ThemeProvider';
import App from '../App';
import { AuthProvider } from './providers/AuthProvider';
import { router } from './router/routes';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  //   <QueryClientProvider client={queryClient}>
  //     <ThemeProvider>
  //       <CssBaseline />
  //       <AuthProvider>
  //         <RouterProvider router={router} />
  //       </AuthProvider>
  //     </ThemeProvider>
  //   </QueryClientProvider>
  // </StrictMode>,
  
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);