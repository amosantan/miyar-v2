import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Webhook, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";

const EVENT_OPTIONS = [
  "project.scored",
  "project.created",
  "report.generated",
  "scenario.created",
  "benchmark.updated",
];

export default function Webhooks() {
  const { data: webhooks, isLoading } = trpc.admin.webhooks.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["project.scored"]);

  const utils = trpc.useUtils();

  const createMutation = trpc.admin.webhooks.create.useMutation({
    onSuccess: () => {
      toast.success("Webhook created");
      utils.admin.webhooks.list.invalidate();
      setShowCreate(false);
      setNewName("");
      setNewUrl("");
      setNewSecret("");
      setNewEvents(["project.scored"]);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.admin.webhooks.update.useMutation({
    onSuccess: () => {
      toast.success("Webhook updated");
      utils.admin.webhooks.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.webhooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook deleted");
      utils.admin.webhooks.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleEvent = (event: string) => {
    setNewEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Webhook Integrations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure CRM webhooks to push MIYAR events to external systems
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-1" />
            New Webhook
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">New Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                  <Input placeholder="e.g. Salesforce CRM" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Endpoint URL</label>
                  <Input placeholder="https://..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Secret (optional, for HMAC signing)</label>
                <Input placeholder="Optional webhook secret" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Events</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map(event => (
                    <button
                      key={event}
                      onClick={() => toggleEvent(event)}
                      className={`px-3 py-1 rounded-full text-xs border transition-all ${
                        newEvents.includes(event)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate({
                    name: newName,
                    url: newUrl,
                    secret: newSecret || undefined,
                    events: newEvents,
                  })}
                  disabled={!newName || !newUrl || newEvents.length === 0 || createMutation.isPending}
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Webhook"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Webhook List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !webhooks || webhooks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No webhooks configured. Create one to push MIYAR events to your CRM.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <Card key={wh.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Webhook className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{wh.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{wh.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={wh.isActive ? "default" : "secondary"}>
                        {wh.isActive ? "Active" : "Paused"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: wh.id, isActive: !wh.isActive })}
                      >
                        {wh.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this webhook?")) {
                            deleteMutation.mutate({ id: wh.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(wh.events as string[]).map((event) => (
                      <Badge key={event} variant="outline" className="text-[10px]">{event}</Badge>
                    ))}
                  </div>
                  {wh.lastTriggeredAt && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Last triggered: {new Date(wh.lastTriggeredAt).toLocaleString()} •
                      Status: {wh.lastStatus || "—"}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
