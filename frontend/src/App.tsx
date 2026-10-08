import { useEffect, useState } from "react";
import SignUpPage from "./pages/auth/SignUpPage.tsx";
import LoginPage from './pages/auth/LoginPage.tsx';
import OwnerOverViewPage from './pages/overview/OwnerOverviewPage.tsx';
import ToolsPage from './pages/tools/ToolsPage.tsx';
import JournalPage from './pages/journal/JournalPage.tsx';
import UsersPage from './pages/users/UsersPage.tsx';

import NavigationRail from './components/NavigationRail.tsx';
import NavigationBottom from './components/NavigationBottom.tsx';
import TopAppBar from './components/TopAppBarDesktop.tsx';
import DesktopLayout from './layouts/DesktopLayout.tsx';
import AppLayout from './layouts/AppLayout.tsx';
import { Stack } from '@mui/material';

function App() {
  return (
    <>
      {/*
      <Stack>
        <DesktopLayout
          topBar={{ title: 'Обзор', supportingText: '1 октября 2026', statusLabel: 'В сети' }}
        >
          <UsersPage />
        </DesktopLayout>
      
        
        <NavigationBottom />
      </Stack>
      */}
      <AppLayout>
        <TopAppBar title="Журнал операций" supportingText="1 октября 2026" statusLabel="В сети" />
        <JournalPage />
      </AppLayout>
    </>
  );
}

export default App;