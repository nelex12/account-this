import { Routes, Route, Navigate} from 'react-router-dom';

import SignUpPage from "./pages/auth/SignUpPage.tsx";
import LoginPage from './pages/auth/LoginPage.tsx';
import OwnerOverviewPage from './pages/overview/OwnerOverviewPage.tsx';
import ToolsPage from './pages/tools/ToolsPage.tsx';
import JournalPage from './pages/journal/JournalPage.tsx';
import UsersPage from './pages/users/UsersPage.tsx';
import ProfilePage from './pages/profile/ProfilePage.tsx';
import Temp from './Temp.tsx';
import TopAppBar from './shared/ui/TopAppBar.tsx';

import DesktopLayout from './app/router/layouts/DesktopLayout.tsx';
import MobileLayout from './app/router/layouts/MobileLayout.tsx';
import SimpleLayout from './app/router/layouts/SimpleLayout.tsx';
import AppLayout from './AppLayout.tsx';

import { AddIcon } from './shared/Icons.ts';

function App() {


  return (
    <Routes>
      <Route index element={<LoginPage />} />
      <Route path="signup" element={<SignUpPage />} />

      <Route element={<AppLayout />}>
        <Route path="overview" element={
          <>
            <TopAppBar 
            title="Обзор" 
            supportingText="1 Сентября, 2026 год" 
            statusLabel="В сети" />
            <OwnerOverviewPage />
          </>
        } />
        <Route path="tools" element={
          <>
            <TopAppBar title="Инструменты" supportingText="24 инструмента в хранилище"
              secondaryAction={{ label: 'Печать/Загрузка наклеек' }}
              primaryAction={{ label: 'Добавить инструмент' }} statusLabel="В сети" />
            <ToolsPage />
          </>
        } />
        <Route path="journal" element={
          <>
            <TopAppBar 
              title="Журнал операций" 
              supportingText="Выдача, возврат и проверка инструмента" 
              statusLabel="В сети" />
            <JournalPage />
          </>
        } />
        <Route path="users" element={
          <>
            <TopAppBar 
              title="Пользователи" 
              supportingText="48 сотрудников в компании, 3 новых заявки"
              statusLabel="В сети" />
            <UsersPage />
          </>
        } />
        <Route path="profile" element={
          <>
            <TopAppBar 
              title="Пользователи" 
              supportingText="48 сотрудников в компании, 3 новых заявки"
              statusLabel="В сети" />
            <ProfilePage />
          </>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;