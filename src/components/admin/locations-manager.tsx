"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createLocationAction,
  deleteLocationAction,
  updateLocationAction,
} from "@/actions/admin";
import type { Location } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";

export function LocationsManager({ initialLocations }: { initialLocations: Location[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: "", description: "", active: true });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", active: true });
    setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({
      name: loc.name,
      description: loc.description ?? "",
      active: loc.active,
    });
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        active: form.active,
      };
      const res = editing
        ? await updateLocationAction(editing.id, payload)
        : await createLocationAction(payload);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setLocations((prev) => {
        if (editing) return prev.map((l) => (l.id === res.data.id ? res.data : l));
        return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name));
      });
      setOpen(false);
      toast.success(editing ? "Location updated" : "Location created");
    });
  }

  function onDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteLocationAction(deleteTarget.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setLocations((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Location deleted");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage venue names used when scheduling events.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        {locations.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No locations yet.
          </li>
        ) : (
          locations.map((loc) => (
            <li key={loc.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{loc.name}</span>
                  <Badge variant={loc.active ? "success" : "secondary"}>
                    {loc.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {loc.description && (
                  <p className="text-xs text-[var(--muted-foreground)]">{loc.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(loc)} disabled={pending}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(loc)}
                  disabled={pending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit location" : "Add location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-name">Name</Label>
              <Input
                id="loc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-desc">Description</Label>
              <Textarea
                id="loc-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleteTarget?.name}? Existing events keep the location text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--destructive)] text-white"
              onClick={onDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
