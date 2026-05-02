"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createService,
  updateService,
  type ServiceFormState,
} from "./actions";

export interface ServiceRecord {
  id: string;
  slug: string;
  name: string;
  group_category: string | null;
  short_description: string | null;
  full_description: string | null;
  suitable_for_notes: string | null;
  gender_restrictions: "any" | "male_only" | "female_only";
  price: number | string;
  duration_mins: number;
  is_active: boolean;
  is_visible_on_frontend: boolean;
  display_order: number;
}

interface ServiceFormDialogProps {
  service?: ServiceRecord;
}

function getPriceValue(value: number | string | undefined) {
  if (value === undefined) return "";
  return String(value);
}

export function ServiceFormDialog({ service }: ServiceFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ServiceFormState>({});

  const title = service ? "Edit service" : "Create service";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = service
        ? await updateService(service.id, {}, formData)
        : await createService({}, formData);

      if (result.error || result.fieldErrors) {
        setState(result);
        if (result.error) toast.error(result.error);
        return;
      }

      setState({});
      toast.success(service ? "Service updated" : "Service created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
        {service ? <Pencil className="size-4" /> : <Plus className="size-4" />}
        {service ? "Edit" : "New Service"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Keep duration and price current because future bookings will store
              service snapshots from this catalog.
            </DialogDescription>
          </DialogHeader>

          {state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={state.fieldErrors?.name}>
              <Input
                name="name"
                defaultValue={service?.name ?? ""}
                disabled={isPending}
                required
              />
            </Field>

            <Field label="Slug" error={state.fieldErrors?.slug}>
              <Input
                name="slug"
                defaultValue={service?.slug ?? ""}
                placeholder="auto-generated from name"
                disabled={isPending}
              />
            </Field>

            <Field label="Group">
              <Input
                name="group_category"
                defaultValue={service?.group_category ?? ""}
                placeholder="cupping or massage"
                disabled={isPending}
              />
            </Field>

            <Field
              label="Gender restriction"
              error={state.fieldErrors?.gender_restrictions}
            >
              <select
                name="gender_restrictions"
                defaultValue={service?.gender_restrictions ?? "any"}
                disabled={isPending}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
              >
                <option value="any">Any</option>
                <option value="male_only">Male only</option>
                <option value="female_only">Female only</option>
              </select>
            </Field>

            <Field label="Price" error={state.fieldErrors?.price}>
              <Input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={getPriceValue(service?.price)}
                disabled={isPending}
                required
              />
            </Field>

            <Field label="Duration minutes" error={state.fieldErrors?.duration_mins}>
              <Input
                name="duration_mins"
                type="number"
                min="1"
                step="1"
                defaultValue={service?.duration_mins ?? 60}
                disabled={isPending}
                required
              />
            </Field>

            <Field label="Display order" error={state.fieldErrors?.display_order}>
              <Input
                name="display_order"
                type="number"
                step="1"
                defaultValue={service?.display_order ?? 0}
                disabled={isPending}
                required
              />
            </Field>

            <div className="flex items-end gap-5 pb-2">
              <label className="flex items-center gap-2 text-sm text-[var(--rahma-charcoal)]">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={service?.is_active ?? true}
                  disabled={isPending}
                  className="size-4 accent-[var(--rahma-green)]"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--rahma-charcoal)]">
                <input
                  name="is_visible_on_frontend"
                  type="checkbox"
                  defaultChecked={service?.is_visible_on_frontend ?? true}
                  disabled={isPending}
                  className="size-4 accent-[var(--rahma-green)]"
                />
                Public
              </label>
            </div>
          </div>

          <Field label="Short description">
            <Textarea
              name="short_description"
              rows={3}
              defaultValue={service?.short_description ?? ""}
              disabled={isPending}
            />
          </Field>

          <Field label="Full description">
            <Textarea
              name="full_description"
              rows={4}
              defaultValue={service?.full_description ?? ""}
              disabled={isPending}
            />
          </Field>

          <Field label="Suitable for notes">
            <Textarea
              name="suitable_for_notes"
              rows={3}
              defaultValue={service?.suitable_for_notes ?? ""}
              disabled={isPending}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--rahma-charcoal)]">
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
