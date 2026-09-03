'use client';

import { Check, Edit3, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type InlineStatField = 'average' | 'target';

export type InlineStatEditState = {
  userId: string;
  field: InlineStatField;
  value: string;
} | null;

export function InlineStatCell({
  usr,
  field,
  displayText,
  valueClassName,
  suffix,
  editState,
  savingKey,
  onStart,
  onChange,
  onCancel,
  onSave,
}: {
  usr: { id: string };
  field: InlineStatField;
  displayText: string;
  valueClassName: string;
  suffix?: string;
  editState: InlineStatEditState;
  savingKey: string | null;
  onStart: (usr: { id: string }, field: InlineStatField) => void;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: (usr: { id: string }) => void;
}) {
  const isEditing = editState?.userId === usr.id && editState?.field === field;
  const isSaving = savingKey === `${usr.id}-${field}`;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step={field === 'average' ? '0.01' : '1'}
          min="0"
          value={editState.value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(usr);
            if (e.key === 'Escape') onCancel();
          }}
          className={`h-7 w-20 text-xs font-mono font-black ${valueClassName} bg-background border-amber-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          autoFocus
        />
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onSave(usr)}
          disabled={isSaving}
          className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-500/20"
          title="Save"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
          className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted/40"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono text-xs font-black ${valueClassName}`}>{displayText}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onStart(usr, field)}
        className="h-6 w-6 p-0 text-amber-400 hover:bg-amber-500/10"
        title={`Edit ${field}`}
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  );
}
