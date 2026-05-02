"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createStaffProfile } from "./actions";

interface Role {
  id: string;
  name: string;
}

interface NewStaffFormProps {
  roles: Role[];
}

export function NewStaffForm({ roles }: NewStaffFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [gender, setGender] = useState<"male" | "female">("female");

  function resetForm() {
    setName("");
    setEmail("");
    setRoleId(roles[0]?.id ?? "");
    setGender("female");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createStaffProfile({
        name,
        email,
        role_id: roleId,
        gender,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Staff profile created");
      resetForm();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={roles.length === 0}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--rahma-green)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--rahma-green)]/90 disabled:pointer-events-none disabled:opacity-50"
      >
        <UserPlus className="size-4" />
        New Staff
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Create Staff Profile</DialogTitle>
            <DialogDescription>
              Add the staff profile now. Supabase Auth access can be linked
              separately through the user account field.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label
                htmlFor="staff-name"
                className="text-sm font-medium text-[var(--rahma-charcoal)]"
              >
                Name
              </label>
              <Input
                id="staff-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="staff-email"
                className="text-sm font-medium text-[var(--rahma-charcoal)]"
              >
                Email
              </label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="staff-role"
                className="text-sm font-medium text-[var(--rahma-charcoal)]"
              >
                Role
              </label>
              <select
                id="staff-role"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                disabled={isPending}
                required
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label
                htmlFor="staff-gender"
                className="text-sm font-medium text-[var(--rahma-charcoal)]"
              >
                Therapist gender
              </label>
              <select
                id="staff-gender"
                value={gender}
                onChange={(event) =>
                  setGender(event.target.value as "male" | "female")
                }
                disabled={isPending}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || roles.length === 0}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
