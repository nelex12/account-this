# Wiring (copy into frontend/src/app/router/routes.tsx)

```tsx
import ScanPage from '../../pages/scan/ScanPage';
import OperationPage from '../../pages/operation/OperationPage';

// inside the RoleGuard -> LayoutByRole children:
{
  element: <RoleGuard roles={['Worker']} />,
  children: [
    { path: '/scan',      element: <ScanPage />,      handle: { topBar: { title: 'Камера' } }   satisfies RouteHandle },
    { path: '/operation', element: <OperationPage />, handle: { topBar: { title: 'Операция' } } satisfies RouteHandle },
  ],
},
```

In `WorkerOverviewPage`, pass `onScan={() => navigate('/scan')}` (or default it inside).
Add `FlashOnIcon` to `shared/Icons.ts` and drop `pages/scan/flashIcon.ts`.
Camera: render the stream as children of `<CameraSlot>` in `ScanPage`, call `handleDetected(text)`.