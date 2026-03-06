"use client";

/**
 * SaveExperimentDialog — dialog to save or rename a backtest run.
 *
 * Accepts strategy name + tags, calls updateStrategy server action.
 */
import { useState, useCallback } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateStrategy } from "@/lib/actions/strategies";

interface SaveExperimentDialogProps {
  strategyId: string;
  currentName: string;
  currentTags: string[];
  onSaved?: (name: string, tags: string[]) => void;
}

export function SaveExperimentDialog({
  strategyId,
  currentName,
  currentTags,
  onSaved,
}: SaveExperimentDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateStrategy(strategyId, { name: name.trim(), tags });
      onSaved?.(name.trim(), tags);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save experiment"
      );
    } finally {
      setSaving(false);
    }
  }, [strategyId, name, tags, onSaved]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="save-experiment-trigger">
          <Save className="mr-2 h-4 w-4" />
          Save as Experiment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="save-experiment-dialog">
        <DialogHeader>
          <DialogTitle>Save as Experiment</DialogTitle>
          <DialogDescription>
            Name this backtest and add tags for easy organisation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="experiment-name">Experiment Name</Label>
            <Input
              id="experiment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Strategy"
              data-testid="experiment-name-input"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="experiment-tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="experiment-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag…"
                data-testid="experiment-tag-input"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                data-testid="add-tag-button"
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1" data-testid="tag-list">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    data-testid={`tag-${tag}`}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 rounded-full hover:text-destructive"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive" data-testid="save-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="save-experiment-button"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
