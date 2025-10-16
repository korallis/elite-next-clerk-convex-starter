"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type SqlConnectionConfig = {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
};

type SelectionMode = "all" | "include" | "exclude";

type SchemaTable = {
  schema: string;
  name: string;
  approximate_row_count: number | null;
};

type SchemaResponse = {
  metadata: {
    tables: SchemaTable[];
  };
};

export type WizardDraft = {
  id: string;
  name: string;
  step: number;
  selectionMode: SelectionMode;
  selectedTables: string[];
  config: SqlConnectionConfig | null;
  updatedAt: number;
};

type ConnectionFormState = {
  name: string;
  server: string;
  database: string;
  user: string;
  password: string;
  port: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

type SyncStatus = "idle" | "running" | "completed" | "failed";

export function ConnectionWizardClient({ initialDraft }: { initialDraft: WizardDraft | null }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialDraft?.step ?? 1);
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [formState, setFormState] = useState<ConnectionFormState>(() => {
    const config = initialDraft?.config ?? null;
    return {
      name: initialDraft?.name ?? "",
      server: config?.server ?? "",
      database: config?.database ?? "",
      user: config?.user ?? "",
      password: config?.password ?? "",
      port: config?.port ? String(config.port) : "1433",
      encrypt: config?.options?.encrypt ?? true,
      trustServerCertificate: config?.options?.trustServerCertificate ?? false,
    };
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaTables, setSchemaTables] = useState<SchemaTable[]>([]);
  const [tableSearch, setTableSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(initialDraft?.selectionMode ?? "all");
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set(initialDraft?.selectedTables ?? []));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep >= 2 && schemaTables.length === 0 && !schemaLoading) {
      void loadSchema();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const tablesForDisplay = useMemo(() => {
    if (!tableSearch) return schemaTables;
    const lower = tableSearch.toLowerCase();
    return schemaTables.filter((table) =>
      `${table.schema}.${table.name}`.toLowerCase().includes(lower)
    );
  }, [schemaTables, tableSearch]);

  const formConfig = useMemo<SqlConnectionConfig>(() => {
    const port = Number.parseInt(formState.port || "1433", 10);
    return {
      server: formState.server,
      database: formState.database,
      user: formState.user,
      password: formState.password,
      port: Number.isNaN(port) ? 1433 : port,
      options: {
        encrypt: formState.encrypt,
        trustServerCertificate: formState.trustServerCertificate,
      },
    };
  }, [formState]);

  const handleFormChange = useCallback(
    (field: keyof ConnectionFormState, value: string | boolean) => {
      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const validateStepOne = useCallback(() => {
    if (!formState.name.trim()) {
      toast.error("Connection name is required");
      return false;
    }
    if (!formState.server.trim() || !formState.database.trim()) {
      toast.error("Server and database are required");
      return false;
    }
    if (!formState.user.trim() || !formState.password.trim()) {
      toast.error("Username and password are required");
      return false;
    }
    return true;
  }, [formState.database, formState.name, formState.password, formState.server, formState.user]);

  const saveDraft = useCallback(
    async (payload: {
      step: number;
      config?: SqlConnectionConfig;
      selectionMode?: SelectionMode;
      selectedTables?: string[];
    }) => {
      const response = await fetch("/api/data-sources/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          name: formState.name,
          step: payload.step,
          config: payload.config,
          selectionMode: payload.selectionMode,
          selectedTables: payload.selectedTables,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.details ?? result.error ?? "Failed to save draft");
      }
      const result = await response.json();
      setDraftId(result.draftId ?? draftId);
      return result.draftId ?? draftId;
    },
    [draftId, formState.name]
  );

  const handleTestConnection = useCallback(async () => {
    if (!validateStepOne()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/data-sources/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formConfig }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Connection failed");
      }
      setTestResult("Connection succeeded");
      toast.success("Connection verified");
      await saveDraft({ step: 1, config: formConfig });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setTestResult(message);
      toast.error("Connection test failed", { description: message });
    } finally {
      setIsTesting(false);
    }
  }, [formConfig, saveDraft, validateStepOne]);

  const loadSchema = useCallback(async () => {
    if (!validateStepOne()) return;
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const response = await fetch("/api/data-sources/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formConfig }),
      });
      const payload: SchemaResponse = await response.json();
      if (!response.ok) {
        const errorMessage = (payload as any)?.details ?? (payload as any)?.error ?? "Failed to load schema";
        throw new Error(errorMessage);
      }
      setSchemaTables(payload.metadata.tables ?? []);
      await saveDraft({ step: 2, config: formConfig, selectionMode, selectedTables: Array.from(selectedTables) });
      setCurrentStep((prev) => (prev < 2 ? 2 : prev));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSchemaError(message);
      toast.error("Unable to load schema", { description: message });
    } finally {
      setSchemaLoading(false);
    }
  }, [formConfig, saveDraft, selectedTables, selectionMode, validateStepOne]);

  const handleSelectionChange = useCallback(
    (tableKey: string, checked: boolean) => {
      setSelectedTables((prev) => {
        const copy = new Set(prev);
        if (checked) {
          copy.add(tableKey);
        } else {
          copy.delete(tableKey);
        }
        return copy;
      });
    },
    []
  );

  const persistSelection = useCallback(async () => {
    await saveDraft({
      step: 3,
      config: formConfig,
      selectionMode,
      selectedTables: Array.from(selectedTables),
    });
    setCurrentStep(3);
  }, [formConfig, saveDraft, selectedTables, selectionMode]);

  const startSync = useCallback(
    async (connectionId: string) => {
      setSyncStatus("running");
      setSyncMessage("Semantic sync running…");

      const poll = async () => {
        try {
          const response = await fetch(`/api/data-sources/${connectionId}/runs`, {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`Status ${response.status}`);
          }
          const payload = await response.json();
          const latest = Array.isArray(payload.runs) && payload.runs.length ? payload.runs[0] : null;
          if (!latest) return;
          if (latest.status === "running") {
            setSyncMessage("Semantic sync in progress…");
            return;
          }
          if (latest.status === "failed") {
            setSyncStatus("failed");
            setSyncMessage(latest.error ?? "Semantic sync failed");
            if (syncIntervalRef.current) {
              clearInterval(syncIntervalRef.current);
              syncIntervalRef.current = null;
            }
            return;
          }
          if (latest.status === "completed") {
            setSyncStatus("completed");
            setSyncMessage("Semantic sync completed successfully");
            if (syncIntervalRef.current) {
              clearInterval(syncIntervalRef.current);
              syncIntervalRef.current = null;
            }
            setTimeout(() => {
              router.replace("/dashboard/connections");
            }, 1500);
          }
        } catch (error) {
          console.error("Failed to poll sync status", error);
        }
      };

      await poll();
      if (!syncIntervalRef.current) {
        syncIntervalRef.current = setInterval(poll, 5000);
      }
    },
    [router]
  );

  const completeWizard = useCallback(async () => {
    try {
      setSyncStatus("running");
      setSyncMessage("Creating connection…");
      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          config: formConfig,
          draftId,
          selectionMode,
          selectedTables: selectionMode === "include" ? Array.from(selectedTables) : undefined,
          excludedTables: selectionMode === "exclude" ? Array.from(selectedTables) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Failed to create connection");
      }
      const connectionId = payload.connectionId as string;

      setSyncMessage("Triggering semantic sync…");
      const syncResponse = await fetch("/api/semantic-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (!syncResponse.ok) {
        const syncPayload = await syncResponse.json().catch(() => ({}));
        throw new Error(syncPayload.details ?? syncPayload.error ?? "Semantic sync failed to start");
      }
      toast.success("Connection created", { description: "Semantic sync has started." });
      await startSync(connectionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSyncStatus("failed");
      setSyncMessage(message);
      toast.error("Unable to complete wizard", { description: message });
    }
  }, [draftId, formConfig, formState.name, selectedTables, selectionMode, startSync]);

  const renderStepOne = () => (
    <Card>
      <CardHeader>
        <CardTitle>Connection details</CardTitle>
        <CardDescription>
          Provide the MSSQL credentials for your read-only replica. The connection will be stored encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Connection name</Label>
          <Input
            id="name"
            value={formState.name}
            onChange={(event) => handleFormChange("name", event.target.value)}
            placeholder="Northwind Read Replica"
          />
        </div>
        <div>
          <Label htmlFor="server">Server</Label>
          <Input
            id="server"
            value={formState.server}
            onChange={(event) => handleFormChange("server", event.target.value)}
            placeholder="sql.example.com"
          />
        </div>
        <div>
          <Label htmlFor="database">Database</Label>
          <Input
            id="database"
            value={formState.database}
            onChange={(event) => handleFormChange("database", event.target.value)}
            placeholder="Northwind"
          />
        </div>
        <div>
          <Label htmlFor="user">Username</Label>
          <Input
            id="user"
            value={formState.user}
            onChange={(event) => handleFormChange("user", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formState.password}
            onChange={(event) => handleFormChange("password", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            value={formState.port}
            onChange={(event) => handleFormChange("port", event.target.value)}
            placeholder="1433"
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
          <div>
            <Label className="text-sm font-medium">Encrypt connection</Label>
            <p className="text-xs text-muted-foreground">Recommended for production workloads.</p>
          </div>
          <Switch
            checked={formState.encrypt}
            onCheckedChange={(checked) => handleFormChange("encrypt", checked)}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
          <div>
            <Label className="text-sm font-medium">Trust server certificate</Label>
            <p className="text-xs text-muted-foreground">Enable when using self-signed certificates.</p>
          </div>
          <Switch
            checked={formState.trustServerCertificate}
            onCheckedChange={(checked) => handleFormChange("trustServerCertificate", checked)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          Allowlist host: <code className="rounded bg-muted px-1 py-0.5 text-xs">31.97.58.72</code>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
          <Button onClick={loadSchema} disabled={schemaLoading}>
            {schemaLoading ? "Loading…" : "Continue"}
          </Button>
        </div>
      </CardFooter>
      {testResult && (
        <div className="border-t border-border/60 bg-muted/40 px-6 py-3 text-sm text-muted-foreground">
          {testResult}
        </div>
      )}
    </Card>
  );

  const renderStepTwo = () => (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Table selection</CardTitle>
          <CardDescription>
            Choose which tables to include in the semantic layer. Row counts help prioritise high-value tables.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={selectionMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectionMode("all")}
          >
            Include all
          </Button>
          <Button
            variant={selectionMode === "include" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectionMode("include")}
          >
            Include list
          </Button>
          <Button
            variant={selectionMode === "exclude" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectionMode("exclude")}
          >
            Exclude list
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search tables…"
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
          />
          <Badge variant="outline">{schemaTables.length} tables</Badge>
        </div>
        {schemaError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {schemaError}
          </div>
        ) : tablesForDisplay.length === 0 ? (
          <div className="rounded-md border border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
            No tables match your filters.
          </div>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
            {tablesForDisplay.map((table) => {
              const key = `${table.schema}.${table.name}`;
              const checked = selectedTables.has(key);
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-md px-3 py-2 hover:bg-muted/60"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{key}</span>
                    <span className="text-xs text-muted-foreground">
                      ~{formatRowCount(table.approximate_row_count)} rows
                    </span>
                  </div>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      handleSelectionChange(key, Boolean(value))
                    }
                    disabled={selectionMode === "all"}
                  />
                </label>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button onClick={persistSelection}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );

  const renderStepThree = () => (
    <Card>
      <CardHeader>
        <CardTitle>Review & launch</CardTitle>
        <CardDescription>
          Confirm connection details and start the first semantic sync. You can resume later if you close this window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Connection name</span>
            <span className="font-medium">{formState.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Server</span>
            <span className="font-medium">{formState.server}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Database</span>
            <span className="font-medium">{formState.database}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Selection mode</span>
            <span className="font-medium capitalize">{selectionMode}</span>
          </div>
          {selectionMode !== "all" && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {selectionMode === "include" ? "Tables included" : "Tables excluded"}
              </span>
              <span className="font-medium">{selectedTables.size}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="rounded-md border border-border/60 bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">What happens next?</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• Connection is saved securely with encrypted credentials.</li>
            <li>• Semantic sync profiles tables and columns, generating summaries.</li>
            <li>• You can monitor progress on the connections overview page.</li>
          </ul>
        </div>
        {syncStatus !== "idle" && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              syncStatus === "failed"
                ? "border-destructive text-destructive"
                : syncStatus === "completed"
                ? "border-emerald-500/60 text-emerald-500"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            {syncMessage}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep(2)} disabled={syncStatus === "running"}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.replace("/dashboard/connections")}>
            Cancel
          </Button>
          <Button onClick={completeWizard} disabled={syncStatus === "running"}>
            Launch semantic sync
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">New MSSQL connection</h1>
        <p className="text-sm text-muted-foreground">
          Securely onboard your data source, pick the tables to model, and kick off the semantic sync pipeline.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <StepIndicator active={currentStep >= 1} label="Credentials" />
        <StepIndicator active={currentStep >= 2} label="Tables" />
        <StepIndicator active={currentStep >= 3} label="Launch" />
      </div>
      {currentStep === 1 && renderStepOne()}
      {currentStep === 2 && renderStepTwo()}
      {currentStep === 3 && renderStepThree()}
    </div>
  );
}

function StepIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex size-6 items-center justify-center rounded-full border text-[10px] ${
          active ? "border-primary bg-primary text-primary-foreground" : "border-border"
        }`}
      >
        {label.charAt(0)}
      </span>
      <span>{label}</span>
    </div>
  );
}

function formatRowCount(count: number | null) {
  if (count == null) return "unknown";
  if (count < 1_000) return count.toString();
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  if (count < 1_000_000_000) return `${Math.round(count / 1_000_000)}m`;
  return `${Math.round(count / 1_000_000_000)}b`;
}
