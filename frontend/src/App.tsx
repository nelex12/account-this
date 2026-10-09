import SignUpPage from "./pages/auth/SignUpPage.tsx";
import LoginPage from './pages/auth/LoginPage.tsx';
import OwnerOverviewPage from './pages/overview/OwnerOverviewPage.tsx';
import ToolsPage from './pages/tools/ToolsPage.tsx';
import JournalPage from './pages/journal/JournalPage.tsx';
import UsersPage from './pages/users/UsersPage.tsx';

import NavigationRail from './shared/ui/NavigationRail.tsx';
import NavigationBottom from './shared/ui/NavigationBottom.tsx';
import TopAppBar from './shared/ui/TopAppBar.tsx';
import DesktopLayout from './app/router/layouts/DesktopLayout.tsx';
import AppLayout from './app/router/layouts/AppLayout.tsx';
import { Stack } from '@mui/material';

function App() {
  return (
    <>
      
      <Stack>
        <DesktopLayout
          topBar={{ title: 'Обзор', supportingText: '1 октября 2026', statusLabel: 'В сети' }}
        >
          <OwnerOverviewPage />
        </DesktopLayout>
      </Stack>
      
      {/*}
      <AppLayout>
        <TopAppBar title="Журнал операций" supportingText="1 октября 2026" statusLabel="В сети" />
        <JournalPage />
      </AppLayout>
      */}
    </>
  );
}

export default App;