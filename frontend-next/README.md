# frontend-next

VersiÃ³n web del frontend de **UCC ImmunoClinic** en **Next.js 16 (App Router) + TypeScript + Tailwind v4**.
Replica la estructura del frontend Flutter (`/frontend`) y consume el mismo backend FastAPI (`/backend`).

## Stack

- Next.js 16 App Router + React 19
- TypeScript estricto
- Tailwind CSS v4
- TanStack Query 5 (data fetching/cache)
- Zustand 5 + persist (estado de auth)
- Axios (cliente HTTP con interceptor de refresh)
- React Hook Form + Zod (formularios y validaciÃ³n)
- Sonner (toasts)

## Setup

```bash
cd frontend-next
cp .env.local.example .env.local      # ajusta NEXT_PUBLIC_API_BASE_URL si hace falta
npm install                            # ya ejecutado durante el scaffold
npm run dev                            # levanta http://localhost:3000
```

El backend debe estar corriendo en `http://localhost:8000` (ver `/backend/README` y la secciÃ³n "Backend" del README raÃ­z).

### Scripts

| Comando | AcciÃ³n |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producciÃ³n |
| `npm start` | Sirve el build |
| `npm run lint` | ESLint |

## Estructura

```
src/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ (auth)/                # rutas pÃºblicas: /login, /forgot-password, /reset-password
â”‚   â”œâ”€â”€ student/               # rutas protegidas con rol estudiante
â”‚   â”œâ”€â”€ admin/                 # rutas protegidas con rol admin
â”‚   â”œâ”€â”€ layout.tsx             # root + AppProviders
â”‚   â”œâ”€â”€ globals.css            # tema UCC (CSS vars + Tailwind v4)
â”‚   â””â”€â”€ page.tsx               # splash + redirect segÃºn sesiÃ³n
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ ui/                    # primitives: Button, Input, Label, Card
â”‚   â”œâ”€â”€ app-shell.tsx          # layout autenticado con sidebar + topbar
â”‚   â”œâ”€â”€ auth-gate.tsx          # guard cliente (redirige segÃºn rol/sesiÃ³n)
â”‚   â”œâ”€â”€ change-password-form.tsx
â”‚   â”œâ”€â”€ providers.tsx          # QueryClientProvider + Toaster
â”‚   â””â”€â”€ stub-page.tsx          # placeholder con endpoints esperados
â””â”€â”€ lib/
    â”œâ”€â”€ api/
    â”‚   â”œâ”€â”€ client.ts          # axios + interceptor JWT con refresh-queue
    â”‚   â””â”€â”€ types.ts           # tipos compartidos (User, Vaccine, ...)
    â”œâ”€â”€ auth/
    â”‚   â”œâ”€â”€ api.ts             # endpoints /auth/*
    â”‚   â””â”€â”€ store.ts           # Zustand store con persist
    â”œâ”€â”€ query/provider.tsx     # cliente TanStack Query
    â”œâ”€â”€ config.ts              # API_BASE_URL, claves de storage, helper isAdminRole
    â””â”€â”€ utils.ts               # cn()
```

## Estado de implementaciÃ³n

Las 26 rutas del frontend Flutter estÃ¡n funcionales contra el backend FastAPI:

### Auth
- `/login`, `/forgot-password`, `/reset-password` (token vÃ­a query param), `/student/change-password`, `/admin/change-password`.
- Cliente Axios con interceptor + refresh-queue (paridad con `frontend/lib/core/network/api_client.dart`).
- Auth store Zustand con persist; gate cliente que redirige segÃºn rol y `must_change_password`.

### Estudiante
- `/student` â€” dashboard con tarjetas.
- `/student/scheme` â€” `GET /scheme/`, ediciÃ³n de fecha aplicada y titulaciÃ³n por dosis (`PUT /scheme/doses/{id}`), badges de estado, vencimientos.
- `/student/evidence` â€” listado + carga multipart (`POST /evidence/upload`), descarga autenticada de archivos, eliminaciÃ³n de batches pendientes.
- `/student/profile` â€” `GET /users/me` + `PUT /users/me/profile` (campos editables vs. inmutables).
- `/student/certificate` â€” `GET /certificates/scheme` (descarga PDF) gated por estado del esquema.
- `/student/history` â€” `GET /audit/me`.
- `/student/notifications` â€” `GET /notifications/`, `PUT /notifications/{id}/read`, deep-link a `action_path`.
- `/student/communications` + `/student/communications/[id]` â€” listar, crear hilo (`POST /communications/threads`), responder mensajes.

### Admin
- `/admin` â€” `GET /admin/statistics` con filtro por semestre, distribuciones por sexo/sede/programa.
- `/admin/students` â€” listado paginado con filtros (search, is_active, esquema, semestre, sexo), exportar CSV.
- `/admin/students/create` â€” alta manual con todos los campos.
- `/admin/students/[id]` â€” tabs Datos / Esquema / Evidencias; revisiÃ³n de dosis (`PUT /admin/doses/{id}/review`), descarga de certificado, activar/desactivar/eliminar.
- `/admin/admins` â€” solo `app_admin`: listar/crear/eliminar admins por programa+sede.
- `/admin/vaccines` â€” solo `app_admin`: catÃ¡logo, crear, activar/desactivar.
- `/admin/communications` + `/admin/communications/[id]` â€” buscar estudiantes (`GET /communications/recipients`), crear hilo, responder. Soporta `?studentId=&studentName=` para iniciar pre-poblado.
- `/admin/notifications` â€” `GET /notifications/`.
- `/admin/profile` â€” perfil propio.
- `/admin/history` â€” `GET /audit/admin`.

### Capa `src/lib/api/`
Servicios por dominio: `auth`, `users`, `scheme`, `evidence`, `notifications`, `communications`, `certificates`, `audit`, `admin`. Tipos compartidos en `types.ts`.

## Diferencias con el frontend Flutter

- **Tokens**: en Flutter se guardan con `flutter_secure_storage`; en web se usa `localStorage` (los JWT del backend ya tienen TTL corto + refresh). Si quieres `httpOnly`, hay que mover el flujo a Server Actions + cookies (ver `node_modules/next/dist/docs/01-app/02-guides/authentication.md`).
- **Push**: no se implementa Firebase Cloud Messaging web por ahora.
- **PDF viewer**: usar `<iframe>` o `react-pdf` cuando se implemente la pantalla de certificado.
- **Deep link** `immunoclinic://auth/reset-password`: en web equivale a `/reset-password?token=...` (el backend solo necesita cambiar la URL del email).

## PrÃ³ximos pasos sugeridos

1. ImportaciÃ³n masiva de estudiantes (`POST /admin/students/import` y `/preview`) â€” falta UI de drop-zone y vista previa.
2. Editar perfil/programa/sede de un estudiante desde `/admin/students/[id]` (endpoint `PUT /admin/students/{id}/profile` ya disponible en `lib/api/admin.ts`).
3. Editar configuraciÃ³n de dosis al actualizar vacuna (`updateVaccine` ya existe en API; falta UI).
4. Reemplazar primitives `ui/*` por `shadcn/ui` real (`npx shadcn@latest init`) si se necesitan Dialog, Tabs accesibles, Combobox, etc.
5. FCM web push para notificaciones en background (`POST /notifications/device-token`).
