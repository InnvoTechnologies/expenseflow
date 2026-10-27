"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { useOrganizationScope } from "@/hooks/use-organization-scope";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type Action = {
  position: number;
  toolName: string;
  arguments: Record<string, any>;
  preview: any;
};
type Batch = {
  batchId: string;
  previewHash: string;
  status: string;
  expiresAt: string;
  actions: Action[];
};
const labels: Record<string, string> = {
  accountId: "Account",
  toAccountId: "Destination account",
  categoryId: "Category",
  payeeId: "Payee",
  subscriptionId: "Subscription",
  tagIds: "Tags",
  feeAmount: "Fee",
  currentBalance: "Balance",
  billingCycle: "Billing cycle",
  startDate: "Starts",
  endDate: "Ends",
  dueDate: "Due",
  isArchived: "Archived",
  isDefault: "Default account",
  reminderEnabled: "Reminders",
  notifyDaysBefore: "Days before renewal",
  baseCurrency: "Base currency",
  numberFormat: "Decimal places",
  destinationAmount: "Destination amount",
  exchangeRate: "Exchange rate",
};
const label = (key: string) =>
  labels[key] ||
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const enums: Record<string, string[]> = {
  type: ["INCOME", "EXPENSE", "TRANSFER"],
  status: ["pending", "completed", "failed"],
  billingCycle: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
};
function summary(action: Action) {
  const p = action.preview;
  const record = p?.after?.deleted ? p.before : p?.after || {};
  const display = p?.display || {};
  return (
    [
      record.description || record.title || record.name,
      record.amount
        ? `${display.currency || record.currency || ""} ${record.amount}`
        : null,
      display.account,
      display.destination,
      display.category,
      display.payee,
      record.date ? new Date(record.date).toLocaleDateString() : null,
    ]
      .filter(Boolean)
      .join(" · ") || action.toolName.replaceAll("_", " ")
  );
}

function PreviewDetails({ action }: { action: Action }) {
  const preview = action.preview || {};
  if (Array.isArray(preview.after))
    return (
      <ul className="text-sm list-disc pl-5">
        {preview.after.map((item: any, i: number) => (
          <li key={i}>
            {item.resource?.name} · {item.resource?.type?.toLowerCase()}
          </li>
        ))}
      </ul>
    );
  const after = preview.after?.deleted ? preview.before : preview.after || {};
  const values = action.arguments.patch || action.arguments;
  let keys = Object.keys(values).filter((k) => k !== "id");
  if (!keys.length)
    keys = Object.keys(after).filter((k) =>
      [
        "name",
        "title",
        "description",
        "amount",
        "feeAmount",
        "type",
        "date",
        "currency",
        "currentBalance",
        "status",
        "isArchived",
        "billingCycle",
        "startDate",
        "endDate",
        "dueDate",
      ].includes(k),
    );
  const references: Record<string, string> = {
    accountId: "account",
    toAccountId: "destination",
    categoryId: "category",
    parentId: "parent",
    payeeId: "payee",
    subscriptionId: "subscription",
    tagIds: "tags",
  };
  const render = (key: string, value: any) => {
    if (references[key])
      return value === null || value === undefined
        ? "None"
        : Array.isArray(preview.display?.[references[key]])
          ? preview.display[references[key]].join(", ")
          : preview.display?.[references[key]] || "Selected record";
    if (value === null || value === undefined) return "None";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (["date", "startDate", "endDate", "dueDate"].includes(key))
      return new Date(value).toLocaleString();
    return String(value);
  };
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {keys.map((key) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{label(key)}</dt>
          <dd className="break-words">
            {preview.before &&
            Object.prototype.hasOwnProperty.call(values, key) &&
            !references[key] &&
            JSON.stringify(preview.before[key]) !==
              JSON.stringify(after[key]) ? (
              <>
                <span className="text-muted-foreground">
                  {render(key, preview.before[key])} →{" "}
                </span>
                {render(key, after[key])}
              </>
            ) : (
              render(key, after[key])
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function AIAssistantPage() {
  const { organizationId, isInitialized } = useOrganizationScope();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null),
    [conversations, setConversations] = useState<any[]>([]),
    [messages, setMessages] = useState<Message[]>([]),
    [batches, setBatches] = useState<Batch[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [live, setLive] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState<Record<number, Record<string, any>>>({}),
    [lookups, setLookups] = useState<Record<string, any[]>>({});
  const generation = useRef(0),
    runRef = useRef<string | null>(null),
    requestRef = useRef<{ id: string; text: string } | null>(null),
    keys = useRef<Record<string, string>>({});
  const context = () => ({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  });
  const config = () => ({
    headers: { "X-Organization-Id": organizationId || "" },
  });
  async function reload(id: string, g = generation.current) {
    const { data } = await apiClient.get(
      `/copilot/conversations/${id}/messages`,
    );
    if (g !== generation.current) return;
    setMessages(
      data.data
        .filter((m: any) => m.content.text)
        .map((m: any) => ({ role: m.role, content: m.content.text })),
    );
    setBatches(
      data.batches.filter(
        (b: Batch) =>
          b.status === "pending" && new Date(b.expiresAt) > new Date(),
      ),
    );
  }
  useEffect(() => {
    if (!isInitialized) return;
    const g = ++generation.current;
    setBusy(false);
    setEditing(null);
    runRef.current = null;
    setConversationId(null);
    setMessages([]);
    setBatches([]);
    setLive("");
    requestRef.current = null;
    apiClient
      .get("/copilot/conversations", {
        params: organizationId ? { organizationId } : {},
      })
      .then(async ({ data }) => {
        if (g !== generation.current) return;
        setConversations(data.data);
        const saved = data.data.find((c: any) => c.status === "active");
        if (saved) {
          setConversationId(saved.id);
          await reload(saved.id, g);
        }
      })
      .catch(() => toast.error("Unable to load conversations."));
  }, [organizationId, isInitialized]);
  async function fresh() {
    const g = generation.current;
    const { data } = await apiClient.post("/copilot/conversations", {
      organizationId,
      ...context(),
    });
    if (g !== generation.current) throw new Error("Workspace changed.");
    setConversationId(data.id);
    setConversations((v) => [data, ...v]);
    setMessages([]);
    setBatches([]);
    requestRef.current = null;
    return data.id;
  }
  async function recover(runId: string, id: string, g: number) {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (g !== generation.current) return;
      const { data } = await apiClient.get(`/copilot/runs/${runId}`);
      if (!["queued", "running"].includes(data.status)) {
        await reload(id!, g);
        if (data.status !== "completed")
          toast.error(
            "The response could not finish. Please send a new message.",
          );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    toast.info(
      "The response is still processing. Reopen this conversation shortly.",
    );
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    const g = generation.current;
    setBusy(true);
    runRef.current = null;
    setInput("");
    setLive("");
    let id = conversationId;
    try {
      id = id || (await fresh());
      const request =
        requestRef.current?.text === text
          ? requestRef.current
          : { id: crypto.randomUUID(), text };
      requestRef.current = request;
      setMessages((v) => [...v, { role: "user", content: text }]);
      const response = await fetch("/api/copilot", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: id,
          clientRequestId: request.id,
          message: text,
          ...context(),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || error.error || "Unable to send message.",
        );
      }
      if (response.headers.get("content-type")?.includes("application/json")) {
        const data = await response.json();
        await recover(data.runId, id!, g);
        requestRef.current = null;
        return;
      }
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        doneEvent = false;
      runRef.current = null;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.split("\n").find((s) => s.startsWith("data: "));
          if (!line) continue;
          const item = JSON.parse(line.slice(6));
          if (g !== generation.current) continue;
          runRef.current = item.runId;
          if (item.event === "assistant.delta")
            setLive((v) => v + item.data.text);
          if (item.event === "error") throw new Error(item.data.error);
          if (item.event === "run.completed") doneEvent = true;
        }
        if (done) break;
      }
      if (!doneEvent && runRef.current) await recover(runRef.current, id!, g);
      else await reload(id!, g);
      requestRef.current = null;
    } catch (error) {
      if (g === generation.current) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to finish the response.",
        );
        if (runRef.current && id) {
          try {
            await recover(runRef.current, id!, g);
            requestRef.current = null;
          } catch {
            setInput(text);
          }
        } else setInput(text);
      }
    } finally {
      if (g === generation.current) {
        setLive("");
        setBusy(false);
      }
    }
  }
  async function approve(batch: Batch) {
    setBusy(true);
    try {
      keys.current[batch.batchId] ||= crypto.randomUUID();
      await apiClient.post(`/copilot/actions/${batch.batchId}/approve`, {
        previewHash: batch.previewHash,
        executionKey: keys.current[batch.batchId],
      });
      await queryClient.invalidateQueries();
      await reload(conversationId!);
      toast.success("Saved successfully.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Unable to save.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reject(batch: Batch) {
    setBusy(true);
    try {
      await apiClient.post(`/copilot/actions/${batch.batchId}/reject`);
      await reload(conversationId!);
    } catch {
      toast.error("Unable to reject this preview.");
    } finally {
      setBusy(false);
    }
  }
  async function edit(batch: Batch) {
    setDraft(
      Object.fromEntries(
        batch.actions.map((a) => [a.position, structuredClone(a.arguments)]),
      ),
    );
    setEditing(batch.batchId);
    try {
      const entries = await Promise.all(
        ["accounts", "categories", "payees", "tags", "subscriptions"].map(
          async (name) => {
            const { data } = await apiClient.get("/" + name, config());
            return [name, Array.isArray(data) ? data : data.data || []];
          },
        ),
      );
      setLookups(Object.fromEntries(entries));
    } catch {
      toast.error("Some selection lists could not load.");
    }
  }
  async function saveEdit(batch: Batch) {
    setBusy(true);
    try {
      await apiClient.patch(`/copilot/actions/${batch.batchId}`, {
        previewHash: batch.previewHash,
        edits: Object.entries(draft).map(([position, args]) => ({
          position: Number(position),
          arguments: args,
        })),
      });
      setEditing(null);
      await reload(conversationId!);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Check the edited details.");
    } finally {
      setBusy(false);
    }
  }
  function fields(
    values: Record<string, any>,
    change: (v: Record<string, any>) => void,
    prefix = "",
  ): React.ReactNode {
    return Object.entries(values)
      .filter(([key]) => key !== "id")
      .map(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value))
          return (
            <fieldset key={key} className="space-y-3">
              {fields(value, (v) => change({ ...values, [key]: v }), key)}
            </fieldset>
          );
        if (key === "categories")
          return (
            <p key={key} className="text-sm">
              To change a category batch, reject this preview and describe the
              revised categories.
            </p>
          );
        const lookupKey = (
          {
            accountId: "accounts",
            toAccountId: "accounts",
            categoryId: "categories",
            parentId: "categories",
            payeeId: "payees",
            subscriptionId: "subscriptions",
            tagIds: "tags",
          } as Record<string, string>
        )[key];
        const set = (v: any) => change({ ...values, [key]: v });
        return (
          <label key={prefix + key} className="block text-sm space-y-1">
            <span>{label(key)}</span>
            {lookupKey ? (
              <select
                className="w-full border rounded p-2 bg-background"
                multiple={key === "tagIds"}
                value={value ?? (key === "tagIds" ? [] : "")}
                onChange={(e) =>
                  set(
                    key === "tagIds"
                      ? Array.from(e.target.selectedOptions).map((o) => o.value)
                      : e.target.value || null,
                  )
                }
              >
                {key !== "tagIds" && <option value="">None</option>}
                {(lookups[lookupKey] || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.title}
                  </option>
                ))}
              </select>
            ) : typeof value === "boolean" ? (
              <input
                className="ml-2"
                type="checkbox"
                checked={value}
                onChange={(e) => set(e.target.checked)}
              />
            ) : enums[key] ? (
              <select
                className="w-full border rounded p-2 bg-background"
                value={value}
                onChange={(e) => set(e.target.value)}
              >
                {Array.from(new Set([value, ...enums[key]])).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={value ?? ""}
                onChange={(e) =>
                  set(
                    typeof value === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}
          </label>
        );
      });
  }
  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col min-h-[75vh] gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Finance copilot</h1>
        <div className="flex gap-2">
          <select
            aria-label="Conversation"
            className="border rounded bg-background p-2 max-w-48"
            disabled={busy}
            value={conversationId || ""}
            onChange={async (e) => {
              setConversationId(e.target.value);
              setLive("");
              await reload(e.target.value);
            }}
          >
            <option value="" disabled>
              Conversation history
            </option>
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title === "New conversation"
                  ? new Date(c.created_at).toLocaleString()
                  : c.title}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={busy || !isInitialized}
            onClick={() =>
              fresh().catch(() =>
                toast.error("Unable to start a conversation."),
              )
            }
          >
            New chat
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Ask spending questions or prepare changes. Review each preview, then
        Save to apply it.
      </p>
      <div className="flex-1 space-y-4">
        {messages.map((m, i) => (
          <ChatMessage key={i} message={m} />
        ))}
        {live && <ChatMessage message={{ role: "assistant", content: live }} />}
        {busy && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Working…
          </div>
        )}
      </div>
      {batches.map((batch) => (
        <section
          key={batch.batchId}
          className="border rounded-xl p-4 space-y-4"
        >
          <h2 className="font-medium">
            Review{" "}
            {batch.actions.length === 1
              ? "change"
              : `${batch.actions.length} changes`}
          </h2>
          {batch.actions.map((action) => (
            <div key={action.position} className="space-y-2">
              <p className="text-sm font-medium capitalize">
                {action.toolName.replaceAll("_", " ")}
              </p>
              <p className="text-sm text-muted-foreground">{summary(action)}</p>
              <PreviewDetails action={action} />
              {editing === batch.batchId &&
                fields(draft[action.position] || {}, (args) =>
                  setDraft((v) => ({ ...v, [action.position]: args })),
                )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Expires {new Date(batch.expiresAt).toLocaleTimeString()}. All listed
            changes save together.
          </p>
          <div className="flex gap-2">
            {editing === batch.batchId ? (
              <>
                <Button disabled={busy} onClick={() => saveEdit(batch)}>
                  Update preview
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel edit
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={() => approve(batch)}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => edit(batch)}
                >
                  Adjust
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => reject(batch)}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </section>
      ))}
      <form
        onSubmit={send}
        className="flex gap-2 sticky bottom-0 bg-background py-4"
      >
        <Input
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Spent 1,200 on lunch yesterday from NayaPay…"
          maxLength={8000}
          disabled={busy || !isInitialized}
        />
        <Button
          type="submit"
          disabled={busy || !input.trim() || !isInitialized}
        >
          <Send className="w-4 h-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
