import { Link } from "wouter";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import {
  useListSubscriptionPlans,
  useGetSubscriptionUsage,
  useSelectSubscriptionPlan,
  getGetSubscriptionUsageQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SUBSCRIPTION_FEATURE_LABELS } from "@/lib/constants";

function formatPrice(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

export default function Plans() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: plans, isLoading: plansLoading } = useListSubscriptionPlans();
  const { data: subscription, isLoading: subscriptionLoading } = useGetSubscriptionUsage();
  const selectPlan = useSelectSubscriptionPlan();

  function handleSelect(planId: string, planName: string) {
    selectPlan.mutate(
      { data: { planId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSubscriptionUsageQueryKey() });
          toast({ title: `You're now on the ${planName} plan` });
        },
        onError: () => {
          toast({
            title: "Couldn't switch plans",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
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
        <div className="grid gap-5 sm:grid-cols-2 max-w-3xl">
          {[1, 2].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl border bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 max-w-3xl">
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
                {plan.priceCents > 0 ? (
                  <div className="mt-1">
                    <p className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">Free</span>
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(plan.priceCents)}/mo</span>
                    </p>
                    <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Free during beta — no card required
                    </span>
                  </div>
                ) : (
                  <p className="mt-1">
                    <span className="text-2xl font-bold">{formatPrice(plan.priceCents)}</span>
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.limits.map((l) => (
                    <li key={l.feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>
                        <strong>{l.limit}</strong> {SUBSCRIPTION_FEATURE_LABELS[l.feature] ?? l.feature} / month
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || selectPlan.isPending}
                  onClick={() => handleSelect(plan.id, plan.name)}
                >
                  {isCurrent ? "Current plan" : selectPlan.isPending ? "Switching…" : `Choose ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="max-w-3xl text-xs text-muted-foreground">
        No card required — plan changes take effect immediately and apply for the rest of your current billing period.
      </p>
    </div>
  );
}
