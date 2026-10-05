import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save, Plus, Trash2, Users, DollarSign, Cpu, BarChart3 } from "lucide-react";
import {
  useAdminGetDashboard,
  useAdminListPlans,
  useAdminUpdatePlan,
  useAdminListCreditPacks,
  useAdminCreateCreditPack,
  useAdminUpdateCreditPack,
  useAdminDeleteCreditPack,
  getAdminListPlansQueryKey,
  getAdminListCreditPacksQueryKey,
  type AdminPlan,
  type AdminCreditPack,
  type SubscriptionFeature,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SUBSCRIPTION_FEATURE_LABELS } from "@/lib/constants";
import { FEATURES } from "@/lib/constants";

function microsToDollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function DashboardTab() {
  const { data, isLoading } = useAdminGetDashboard();
  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total students" value={String(data.totalUsers)} />
        <StatCard icon={DollarSign} label="Est. monthly revenue" value={`$${(data.estimatedMonthlyRevenueCents / 100).toFixed(2)}`} />
        <StatCard icon={Cpu} label="AI cost (30 days)" value={microsToDollars(data.aiCostMicrosLast30Days)} />
        <StatCard icon={Cpu} label="AI cost (all time)" value={microsToDollars(data.aiCostMicrosAllTime)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Subscribers by plan</h3>
          <div className="space-y-2">
            {data.subscribersByPlan.length === 0 && <p className="text-sm text-muted-foreground">No active subscriptions yet.</p>}
            {data.subscribersByPlan.map((p) => (
              <div key={p.planId} className="flex items-center justify-between text-sm">
                <span>{p.planName}</span>
                <span className="font-medium">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Usage (30 days)</h3>
          <div className="space-y-2">
            {data.usageByFeatureLast30Days.length === 0 && <p className="text-sm text-muted-foreground">No usage yet.</p>}
            {data.usageByFeatureLast30Days.map((u) => (
              <div key={u.feature} className="flex items-center justify-between text-sm">
                <span>{SUBSCRIPTION_FEATURE_LABELS[u.feature] ?? u.feature}</span>
                <span className="font-medium">{u.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: AdminPlan }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlan = useAdminUpdatePlan();

  const [priceInput, setPriceInput] = useState(centsToDollarsInput(plan.priceCents));
  const [limits, setLimits] = useState<Record<string, number>>(
    Object.fromEntries(plan.limits.map((l) => [l.feature, l.limit])),
  );
  const [allowsTopups, setAllowsTopups] = useState(plan.allowsTopups);
  const [isActive, setIsActive] = useState(plan.isActive);

  function handleSave() {
    const priceCents = Math.round(parseFloat(priceInput || "0") * 100);
    updatePlan.mutate(
      { id: plan.id, data: { priceCents, limits, allowsTopups, isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListPlansQueryKey() });
          toast({ title: `${plan.name} plan updated` });
        },
        onError: () => toast({ title: "Couldn't update plan", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold font-serif">{plan.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Active</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Monthly price (USD)</label>
        <Input type="number" min="0" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {plan.limits.map((l) => (
          <div key={l.feature} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{SUBSCRIPTION_FEATURE_LABELS[l.feature] ?? l.feature}</label>
            <Input
              type="number"
              min="0"
              value={limits[l.feature] ?? 0}
              onChange={(e) => setLimits((prev) => ({ ...prev, [l.feature]: Number(e.target.value) }))}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Allow buying extra credits</label>
        <Switch checked={allowsTopups} onCheckedChange={setAllowsTopups} />
      </div>

      <Button size="sm" className="w-full" disabled={updatePlan.isPending} onClick={handleSave}>
        <Save className="w-3.5 h-3.5 mr-1.5" /> {updatePlan.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function PlansTab() {
  const { data: plans, isLoading } = useAdminListPlans();
  if (isLoading || !plans) return <div className="h-60 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function CreditPacksTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: packs, isLoading } = useAdminListCreditPacks();
  const createPack = useAdminCreateCreditPack();
  const updatePack = useAdminUpdateCreditPack();
  const deletePack = useAdminDeleteCreditPack();

  const [feature, setFeature] = useState<SubscriptionFeature>("tutorMessage");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("25");
  const [price, setPrice] = useState("2.99");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getAdminListCreditPacksQueryKey() });
  }

  function handleCreate() {
    if (!label.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    createPack.mutate(
      { data: { feature, label: label.trim(), amount: Number(amount), priceCents: Math.round(parseFloat(price || "0") * 100), isActive: true } },
      {
        onSuccess: () => {
          invalidate();
          setLabel("");
          toast({ title: "Credit pack created" });
        },
        onError: () => toast({ title: "Couldn't create pack", variant: "destructive" }),
      },
    );
  }

  function toggleActive(pack: AdminCreditPack) {
    updatePack.mutate(
      { id: pack.id, data: { isActive: !pack.isActive } },
      { onSuccess: invalidate, onError: () => toast({ title: "Couldn't update pack", variant: "destructive" }) },
    );
  }

  function handleDelete(id: number) {
    deletePack.mutate({ id }, { onSuccess: invalidate, onError: () => toast({ title: "Couldn't delete pack", variant: "destructive" }) });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">New credit pack</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Select value={feature} onValueChange={(v) => setFeature(v as SubscriptionFeature)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEATURES.map((f) => (
                <SelectItem key={f} value={f}>{SUBSCRIPTION_FEATURE_LABELS[f] ?? f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Label (e.g. +25 messages)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input type="number" min="1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input type="number" min="0" step="0.01" placeholder="Price USD" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Button size="sm" disabled={createPack.isPending} onClick={handleCreate}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add pack
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <div className="h-20 animate-pulse rounded-xl bg-muted" />}
        {packs?.map((pack) => (
          <div key={pack.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div>
              <p className="text-sm font-medium">{pack.label}</p>
              <p className="text-xs text-muted-foreground">
                +{pack.amount} {SUBSCRIPTION_FEATURE_LABELS[pack.feature] ?? pack.feature} · ${(pack.priceCents / 100).toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Active</span>
                <Switch checked={pack.isActive} onCheckedChange={() => toggleActive(pack)} />
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(pack.id)} aria-label={`Delete ${pack.label}`}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {packs && packs.length === 0 && <p className="text-sm text-muted-foreground">No credit packs yet.</p>}
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Admin</h1>
          <p className="text-muted-foreground">Business dashboard, plans, and credit packs.</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="credit-packs">Credit packs</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="pt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="plans" className="pt-4">
          <PlansTab />
        </TabsContent>
        <TabsContent value="credit-packs" className="pt-4">
          <CreditPacksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
