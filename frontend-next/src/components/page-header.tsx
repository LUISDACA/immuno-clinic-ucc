export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--divider)] bg-card px-4 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[color:var(--surface-variant)] text-[color:var(--brand-gray)]">
        {icon}
      </div>
      <p className="mt-3 text-base font-bold">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-[color:var(--divider)] bg-card py-14 text-sm text-muted-foreground shadow-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)]" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[color:var(--divider)] bg-card px-4 py-12 text-center shadow-sm">
      <p className="max-w-md text-sm text-[color:var(--destructive)]">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-bold text-[color:var(--primary)] hover:underline"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
