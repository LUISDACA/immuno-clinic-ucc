import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StubPageProps {
  title: string;
  description?: string;
  endpoints?: string[];
  notes?: string;
}

export function StubPage({ title, description, endpoints, notes }: StubPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pantalla pendiente de implementar</CardTitle>
          <CardDescription>
            Esta vista existe en el frontend Flutter y aún no se replicó aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {endpoints && endpoints.length > 0 && (
            <div>
              <p className="font-medium">Endpoints esperados:</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {endpoints.map((e) => (
                  <li key={e}>
                    <code className="font-mono text-xs">{e}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notes && <p className="text-muted-foreground">{notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
