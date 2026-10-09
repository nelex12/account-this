import { Routes, Route} from 'react-router-dom';
import { Button } from '@mui/material';
import SignUpPage from "./pages/auth/SignUpPage.tsx";
import LoginPage from './pages/auth/LoginPage.tsx';
import OwnerOverviewPage from './pages/overview/OwnerOverviewPage.tsx';
import ToolsPage from './pages/tools/ToolsPage.tsx';
import JournalPage from './pages/journal/JournalPage.tsx';
import UsersPage from './pages/users/UsersPage.tsx';
import Temp from './Temp.tsx';

import NavigationRail from './shared/ui/NavigationRail.tsx';
import NavigationBottom from './shared/ui/NavigationBottom.tsx';
import TopAppBar from './shared/ui/TopAppBar.tsx';
import DesktopLayout from './app/router/layouts/DesktopLayout.tsx';
import MobileLayout from './app/router/layouts/MobileLayout.tsx';
import SimpleLayout from './app/router/layouts/SimpleLayout.tsx';
import AppLayout from './AppLayout.tsx';
import { Stack } from '@mui/material';
import OverviewPage from './pages/overview/overviewtry.tsx';

function App() {
  return (
    <>
      <Routes>
        <Route index element ={<LoginPage />} />
        <Route path="signup" element ={<SignUpPage />} />
        <Route path="overview" element ={
          <AppLayout >
            <TopAppBar 
              title="Обзор" supportingText="1 Сентября, 2026 год" statusLabel="В сети"
            />
            <OwnerOverviewPage />
          </AppLayout>
        } />
        <Route path="tools" element ={
          <AppLayout >
            <TopAppBar 
              title="Инструменты" supportingText="24 инструмента в хранилище" secondaryAction={{label: "Печать/Загрузка наклеек"}} primaryAction={{label: "Добавить инструмент"}} statusLabel="В сети"
            />
            <ToolsPage />
          </AppLayout>
        } />
        <Route path="journal" element ={
          <AppLayout >
            <TopAppBar 
              title="Журнал операций" supportingText="Выдача, возврат и проверка инструмента" statusLabel="В сети"
            />
            <JournalPage />
          </AppLayout>
        } />
        <Route path="users" element ={
          <AppLayout >
            <TopAppBar 
              title="Пользователи" supportingText="48 сотрудников" statusLabel="В сети"
            />
            <UsersPage />
          </AppLayout>
        } />
        <Route path="dialog" element ={
          <AppLayout >
            <TopAppBar 
              title="Пользователи" supportingText="48 сотрудников" statusLabel="В сети"
            />
            <Temp />
          </AppLayout>
        } />
        
      </Routes>
    </>
  );
}

export default App;