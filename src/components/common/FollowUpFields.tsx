"use client";

// The date, time and (optionally) notes fields of every follow-up form:
// scheduling from Leads, a lead's page and Contacts, creating one on the
// Follow-up page, and rescheduling. State stays with each page.

import DatePicker from "@/components/common/DatePicker";
import FormField from "@/components/common/FormField";
import { Input } from "@/components/ui/input";

interface FollowUpFieldsProps {
  /** Makes the field ids unique on the page. */
  idPrefix: string;
  date: string;
  onDateChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  /** Leave out both to hide the notes field (Reschedule has none). */
  notes?: string;
  onNotesChange?: (value: string) => void;
  dateLabel?: string;
  datePlaceholder?: string;
}

export default function FollowUpFields({
  idPrefix,
  date,
  onDateChange,
  time,
  onTimeChange,
  notes,
  onNotesChange,
  dateLabel = "Date",
  datePlaceholder = "Follow-up date",
}: FollowUpFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={dateLabel} htmlFor={`${idPrefix}-date`}>
          <DatePicker id={`${idPrefix}-date`} value={date} onChange={onDateChange} placeholder={datePlaceholder} />
        </FormField>
        <FormField label="Time" htmlFor={`${idPrefix}-time`}>
          <Input id={`${idPrefix}-time`} type="time" value={time} onChange={(e) => onTimeChange(e.target.value)} />
        </FormField>
      </div>
      {onNotesChange && (
        <FormField label="Notes" htmlFor={`${idPrefix}-notes`}>
          <Input
            id={`${idPrefix}-notes`}
            value={notes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Notes (optional)"
          />
        </FormField>
      )}
    </div>
  );
}
