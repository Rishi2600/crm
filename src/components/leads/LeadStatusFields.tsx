"use client";

// The body of the "Change lead status" prompt, shared by the Leads list and a
// lead's own page. Both call the same endpoint, which refuses a change
// without a remark. State stays with each page.

import Select from "@/components/common/Select";
import FormField from "@/components/common/FormField";
import { Textarea } from "@/components/ui/textarea";
import { SUB_STATUS_BY_STATUS } from "@/lib/leads";
import { LeadStatusLabel, LeadSubStatusLabel } from "@/types/leads";

const ALL_STATUSES = Object.keys(SUB_STATUS_BY_STATUS) as LeadStatusLabel[];

interface LeadStatusFieldsProps {
  idPrefix: string;
  status: LeadStatusLabel;
  onStatusChange: (value: string) => void;
  subStatus: LeadSubStatusLabel;
  onSubStatusChange: (value: LeadSubStatusLabel) => void;
  remark: string;
  onRemarkChange: (value: string) => void;
  hint?: string;
}

export default function LeadStatusFields({
  idPrefix,
  status,
  onStatusChange,
  subStatus,
  onSubStatusChange,
  remark,
  onRemarkChange,
  hint,
}: LeadStatusFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Status" htmlFor={`${idPrefix}-status`}>
          <Select
            id={`${idPrefix}-status`}
            value={status}
            onChange={onStatusChange}
            options={ALL_STATUSES.map((s) => ({ label: s, value: s }))}
          />
        </FormField>
        <FormField label="Sub-status" htmlFor={`${idPrefix}-sub-status`}>
          <Select
            id={`${idPrefix}-sub-status`}
            value={subStatus}
            onChange={(v) => onSubStatusChange(v as LeadSubStatusLabel)}
            options={SUB_STATUS_BY_STATUS[status].map((s) => ({ label: s, value: s }))}
          />
        </FormField>
      </div>
      <FormField label="Remark" htmlFor={`${idPrefix}-remark`} hint={hint}>
        <Textarea
          id={`${idPrefix}-remark`}
          value={remark}
          onChange={(e) => onRemarkChange(e.target.value)}
          placeholder="Record what happened — why is this lead moving? *"
          rows={3}
          className="resize-none"
        />
      </FormField>
    </div>
  );
}
