// RouteErrorPage.tsx — понятный экран вместо стандартного «Unexpected Application Error!» React Router.
// Подключён как errorElement в routes.tsx: внутри оболочки роли (навигация остаётся рабочей) и на корне.
//
// Подсказывает частые причины простыми словами:
//   - перевод страницы браузером: переводчик подменяет текст своими узлами, и React падает
//     на insertBefore / removeChild (перевод запрещён в index.html, но расширения могут переводить всё равно);
//   - вышла новая версия: старые файлы приложения уже удалены с сервера;
//   - нет интернета при загрузке части приложения.
// Кнопки делают полную перезагрузку: после такой ошибки состояние React может быть испорчено.
import { useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type Cause = 'translation' | 'newVersion' | 'offline' | 'unknown';

const HINTS: Record<Exclude<Cause, 'unknown'>, string> = {
  translation:
    'Похоже, страницу перевёл браузер или расширение-переводчик, и приложение из-за этого сбилось. ' +
    'Отключите перевод для этого сайта (в меню браузера — «Показать оригинал» или «Не переводить этот сайт») ' +
    'и перезагрузите страницу.',
  newVersion: 'Похоже, вышла новая версия приложения. Перезагрузите страницу, чтобы её получить.',
  offline: 'Не удалось загрузить часть приложения: проверьте подключение к интернету и перезагрузите страницу.',
};

function describe(error: unknown): { text: string; cause: Cause } {
  if (isRouteErrorResponse(error)) {
    return { text: `${error.status} ${error.statusText}`.trim(), cause: 'unknown' };
  }
  const head = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // В Chrome stack уже начинается с «Имя: сообщение», в Safari и Firefox — только адреса строк
  const stack = error instanceof Error ? error.stack ?? '' : '';
  const text = stack.startsWith(head) ? stack : stack ? `${head}\n${stack}` : head;
  const message = error instanceof Error ? error.message : text;

  // Сообщение браузер может показать на языке системы, поэтому смотрим и на имя метода, и на тип ошибки
  if (/insertBefore|removeChild|appendChild|replaceChild/.test(message) || (error instanceof DOMException && error.name === 'NotFoundError')) {
    return { text, cause: 'translation' };
  }
  if (/dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|text\/html/i.test(message)) {
    return { text, cause: navigator.onLine ? 'newVersion' : 'offline' };
  }
  if (!navigator.onLine) return { text, cause: 'offline' };
  return { text, cause: 'unknown' };
}

export default function RouteErrorPage() {
  const error = useRouteError();
  const { text, cause } = describe(error);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n\nURL: ${window.location.href}\nUA: ${navigator.userAgent}`);
      setCopied(true);
    } catch {
      setShowDetails(true); // буфер обмена недоступен — пусть скопируют руками
    }
  };

  return (
    <Box
      role="alert"
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Stack spacing={2.5} sx={{ width: '100%', maxWidth: 520 }}>
        <Typography variant="h5" component="h1">
          Что-то пошло не так
        </Typography>
        <Typography color="text.secondary">
          В приложении произошла ошибка. Перезагрузите страницу — обычно этого достаточно.
        </Typography>

        {cause !== 'unknown' && <Alert severity="info">{HINTS[cause]}</Alert>}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" size="large" onClick={() => window.location.reload()}>
            Перезагрузить
          </Button>
          <Button size="large" onClick={() => window.location.assign('/overview')}>
            На главную
          </Button>
        </Stack>

        <Box>
          <Button size="small" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? 'Скрыть подробности' : 'Подробности для разработчика'}
          </Button>
          <Collapse in={showDetails}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  maxHeight: 240,
                  overflow: 'auto',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                }}
              >
                {text}
              </Box>
              <Box>
                <Button size="small" onClick={() => void copy()}>
                  {copied ? 'Скопировано' : 'Скопировать'}
                </Button>
              </Box>
            </Stack>
          </Collapse>
        </Box>
      </Stack>
    </Box>
  );
}
