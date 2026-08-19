"use client";

import { useEffect, useState } from "react";
import FieldBuilder from "@/components/FieldBuilder";
import { useToast } from "@/components/Toast";
import { ApiError, createTemplate, deleteTemplate, listTemplates, updateTemplate } from "@/lib/api";
import { FieldSchema, Template } from "@/lib/types";

function emptyField(): FieldSchema {
  return { name: "", field_type: "alphanumeric", regex_pattern: "", required: false };
}

interface TemplateManagerProps {
  onTemplatesChanged: () => void;
}

export default function TemplateManager({ onTemplatesChanged }: TemplateManagerProps) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldSchema[]>([emptyField()]);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setTemplates(await listTemplates());
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to load templates.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setFields([emptyField()]);
  };

  const startEdit = (template: Template) => {
    setEditingId(template.id);
    setName(template.name);
    setFields(template.fields.map((f) => ({ ...f })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Template name is required.", "error");
      return;
    }
    const cleanFields = fields.filter((f) => f.name.trim());
    if (cleanFields.length === 0) {
      showToast("Add at least one field.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateTemplate(editingId, name.trim(), cleanFields);
        showToast("Template updated.", "success");
      } else {
        await createTemplate(name.trim(), cleanFields);
        showToast("Template created.", "success");
      }
      resetForm();
      await refresh();
      onTemplatesChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to save template.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      showToast("Template deleted.", "success");
      if (editingId === id) resetForm();
      await refresh();
      onTemplatesChanged();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to delete template.", "error");
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {editingId ? "Edit template" : "New template"}
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Prescription Form)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <FieldBuilder fields={fields} onChange={setFields} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Create template"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Saved templates</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-slate-500">No templates yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    {template.fields.length} field{template.fields.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-3 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => startEdit(template)}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
