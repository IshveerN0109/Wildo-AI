import { Link } from "wouter";
import { ArrowLeft, Check, Sparkles, CreditCard, Zap } from "lucide-react";
import {
  useListSubscriptionPlans,
  useGetSubscriptionUsage,
  useSelectSubscriptionPlan,
  useCreateSubscriptionCheckout,
  useGetSubscriptionPortal,
  useListCreditPacks,
  useCreateTopupCheckout,
  getGetSubscriptionUsageQueryKey,
  getGetSubscriptionPortalQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SUBSCRIPTION_FEATURE_LABELS } from "@/lib/constants";

function formatPrice(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

function paymentsUnavailableToast(toast: ReturnType<typeof useToast>["toast"]) {
  toast({
    title: "Payments aren't set up yet",
    description: "Billing isn't configured for Wildo yet — check back soon.",
    variant: "destructive",
  });
}

export default function Plans() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: plans, isLoading: plansLoading } = useListSubscriptionPlans();
  const { data: subscription, isLoading: subscriptionLoading } = useGetSubscriptionUsage();
  const { data: creditPacks } = useListCreditPacks();
  const selectPlan = useSelectSubscriptionPlan();
  const createCheckout = useCreateSubscriptionCheckout();
  const getPortal = useGetSubscriptionPortal({ query: { enabled: false, queryKey: getGetSubscriptionPortalQueryKey() } });
  const createTopupCheckout = useCreateTopupCheckout();

  function handleSelect(plan: NonNullable<typeof plans>[number]) {
    if (plan.priceCents > 0) {
      createCheckout.mutate(
        { data: { planId: plan.id } },
        {
          onSuccess: (data) => { window.location.href = data.url; },
          onError: (err: any) => {
            if (err?.status === 503) paymentsUnavailableToast(toast);
            else toast({ title: "Couldn't start checkout", description: "Something went wrong. Please try again.", variant: "destructive" });
          },
        },
      );
      return;
    }

    selectPlan.mutate(
      { data: { planId: plan.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSubscriptionUsageQueryKey() });
          toast({ title: `You're now on the ${plan.name} plan` });
        },
        onError: () => {
          toast({ title: "Couldn't switch plans", description: "Something went wrong. Please try again.", variant: "destructive" });
        },
      },
    );
  }

  async function handleManageBilling() {
    const result = await getPortal.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    } else {
      paymentsUnavailableToast(toast);
    }
  }

  function handleBuyPack(creditPackId: number) {
    createTopupCheckout.mutate(
      { data: { creditPackId } },
      {
        onSuccess: (data) => { window.location.href = data.url; },
        onError: (err: any) => {
          if (err?.status === 503) paymentsUnavailableToast(toast);
          else toast({ title: "Couldn't start checkout", description: "Something went wrong. Please try again.", variant: "destructive" });
        },
      },
    );
  }

  const isLoading = plansLoading || subscriptionLoading;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Plans</h1>
          <p className="text-muted-foreground">Choose the plan that fits how much you want to study with Wildo.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-3 max-w-4xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl border bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
          {plans?.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 shadow-sm ${
                  isCurrent ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-serif text-xl font-bold">{plan.name}</h2>
                  {plan.priceCents > 0 && <Sparkles className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1">
                  <span className="text-2xl font-bold">{formatPrice(plan.priceCents)}</span>
                  {plan.priceCents > 0 && <span className="text-sm text-muted-foreground"> /month</span>}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.limits.map((l) => (
                    <li key={l.feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>
                        <strong>{l.limit}</strong> {SUBSCRIPTION_FEATURE_LABELS[l.feature] ?? l.feature} / month
                      </span>
                    </li>
                  ))}
                  {plan.allowsTopups && (
                    <li className="flex items-start gap-2 text-sm text-primary">
                      <Zap className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Buy extra credits anytime</span>
                    </li>
                  )}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || selectPlan.isPending || createCheckout.isPending}
                  onClick={() => handleSelect(plan)}
                >
                  {isCurrent
                    ? "Current plan"
                    : selectPlan.isPending || createCheckout.isPending
                      ? "Redirecting…"
                      : `Choose ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {subscription && subscription.planId !== "free" && (
        <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={getPortal.isFetching}>
          <CreditCard className="w-4 h-4 mr-2" /> Manage billing & payment method
        </Button>
      )}

      {subscription?.allowsTopups && creditPacks && creditPacks.length > 0 && (
        <div className="max-w-4xl space-y-3 pt-2">
          <h2 className="text-lg font-bold font-serif">Need more this month?</h2>
          <p className="text-sm text-muted-foreground">Your plan lets you top up credits for any feature, on top of your monthly limit.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creditPacks.map((pack) => (
              <div key={pack.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{pack.label}</p>
                  <p className="text-xs text-muted-foreground">
                    +{pack.amount} {SUBSCRIPTION_FEATURE_LABELS[pack.feature] ?? pack.feature}
                  </p>
                </div>
                <Button size="sm" disabled={createTopupCheckout.isPending} onClick={() => handleBuyPack(pack.id)}>
                  {formatPrice(pack.priceCents)}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="max-w-3xl text-xs text-muted-foreground">
        Plan changes take effect immediately. Paid plans are billed monthly via Stripe — cancel anytime from "Manage billing".
      </p>
    </div>
  );
}
