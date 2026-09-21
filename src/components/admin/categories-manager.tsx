"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/actions/admin";
import type { EventCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: EventCategory[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventCategory | null>(null);
  const [form, setForm] = useState({ name: "", color: "#1e5a8a", active: true });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", color: "#1e5a8a", active: true });
    setOpen(true);
  }

  function openEdit(cat: EventCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      color: cat.color ?? "#1e5a8a",
      active: cat.active,
    });
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        name: form.name,
        color: form.color || null,
        active: form.active,
      };
      const res = editing
        ? await updateCategoryAction(editing.id, payload)
        : await createCategoryAction(payload);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCategories((prev) => {
        if (editing) return prev.map((c) => (c.id === res.data.id ? res.data : c));
        return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name));
      });
      setOpen(false);
      toast.success(editing ? "Category updated" : "Category created");
    });
  }

  function onDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteCategoryAction(deleteTarget.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Category deleted");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          Labels for grouping events (Academic, Internship, etc.).
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        {categories.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
            No categories yet.
          </li>
        ) : (
          categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                />
                <span className="font-medium">{cat.name}</span>
                <Badge variant={cat.active ? "success" : "secondary"}>
                  {cat.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(cat)} disabled={pending}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(cat)}
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
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="cat-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 p-1"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="font-mono"
                />
              </div>
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
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {deleteTarget?.name}? Events keep their data; category link is cleared.
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
