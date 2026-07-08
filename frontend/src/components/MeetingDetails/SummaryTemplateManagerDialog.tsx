"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Copy,
  FilePenLine,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  CopyPlus,
} from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  TemplateDraft,
  TemplateInfo,
  templateService,
} from '@/services/templateService';

interface SummaryTemplateManagerDialogProps {
  templates: TemplateInfo[];
  selectedTemplate: string;
  onTemplateSelect: (templateId: string, templateName: string) => void;
  onTemplatesChanged: () => Promise<void> | void;
  trigger?: ReactNode;
}

type EditorMode = 'existing' | 'new';

const defaultTemplate: TemplateDraft = {
  name: 'Custom Template',
  description: 'Custom summary template',
  sections: [
    {
      title: 'Summary',
      instruction: 'Summarize the meeting clearly and concisely',
      format: 'paragraph',
    },
    {
      title: 'Action Items',
      instruction: 'List action items with owners and due dates when available',
      format: 'list',
      item_format: '- [ ] Action item - Owner - Due date',
    },
  ],
};

function templateToJson(template: TemplateDraft): string {
  return JSON.stringify(template, null, 2);
}

function sourceLabel(source: TemplateInfo['source']): string {
  if (source === 'builtin') return 'Built-in';
  if (source === 'bundled') return 'Bundled';
  return 'Custom';
}

function validateDraft(value: unknown): TemplateDraft {
  if (!value || typeof value !== 'object') {
    throw new Error('Template JSON must be an object');
  }

  const draft = value as TemplateDraft;
  if (!draft.name?.trim()) {
    throw new Error('Template name is required');
  }
  if (!draft.description?.trim()) {
    throw new Error('Template description is required');
  }
  if (!Array.isArray(draft.sections) || draft.sections.length === 0) {
    throw new Error('At least one section is required');
  }

  draft.sections.forEach((section, index) => {
    if (!section.title?.trim()) {
      throw new Error(`Section ${index + 1} title is required`);
    }
    if (!section.instruction?.trim()) {
      throw new Error(`Section ${index + 1} instruction is required`);
    }
    if (!['paragraph', 'list', 'string'].includes(section.format)) {
      throw new Error(`Section ${index + 1} format must be paragraph, list, or string`);
    }
  });

  return draft;
}

export function SummaryTemplateManagerDialog({
  templates,
  selectedTemplate,
  onTemplateSelect,
  onTemplatesChanged,
  trigger,
}: SummaryTemplateManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState(selectedTemplate);
  const [editorMode, setEditorMode] = useState<EditorMode>('existing');
  const [newTemplateId, setNewTemplateId] = useState('');
  const [jsonDraft, setJsonDraft] = useState(templateToJson(defaultTemplate));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) || null,
    [activeTemplateId, templates]
  );

  const loadTemplate = async (templateId: string) => {
    setLoading(true);
    try {
      const details = await templateService.getTemplateDetails(templateId);
      setEditorMode('existing');
      setActiveTemplateId(details.id);
      setNewTemplateId('');
      setJsonDraft(templateToJson({
        name: details.name,
        description: details.description,
        sections: details.sections,
      }));
    } catch (error) {
      toast.error('Template failed to load', {
        description: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplate(selectedTemplate);
    }
  }, [open, selectedTemplate]);

  const handleNew = () => {
    setEditorMode('new');
    setActiveTemplateId('');
    setNewTemplateId('custom_template');
    setJsonDraft(templateToJson(defaultTemplate));
  };

  const handleDuplicate = async () => {
    if (!activeTemplateId) return;

    try {
      const details = await templateService.getTemplateDetails(activeTemplateId);
      const duplicateId = `${details.id}_copy`;
      setEditorMode('new');
      setActiveTemplateId('');
      setNewTemplateId(duplicateId);
      setJsonDraft(templateToJson({
        name: `${details.name} Copy`,
        description: details.description,
        sections: details.sections,
      }));
    } catch (error) {
      toast.error('Template failed to duplicate', {
        description: String(error),
      });
    }
  };

  const refreshAndSelect = async (template: TemplateInfo) => {
    await onTemplatesChanged();
    onTemplateSelect(template.id, template.name);
    await loadTemplate(template.id);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsed = validateDraft(JSON.parse(jsonDraft));
      const serialized = templateToJson(parsed);
      await templateService.validateTemplate(serialized);

      if (editorMode === 'new') {
        const saved = await templateService.createCustomTemplate(newTemplateId, parsed);
        toast.success('Template saved');
        await refreshAndSelect(saved);
      } else if (activeTemplate?.editable) {
        const saved = await templateService.updateCustomTemplate(activeTemplate.id, parsed);
        toast.success('Template saved');
        await refreshAndSelect(saved);
      } else {
        toast.error('Duplicate read-only templates before editing');
      }
    } catch (error) {
      toast.error('Template not saved', {
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeTemplate?.deletable) return;
    if (!window.confirm(`Delete "${activeTemplate.name}"?`)) return;

    setSaving(true);
    try {
      await templateService.deleteCustomTemplate(activeTemplate.id);
      toast.success('Template deleted');
      await onTemplatesChanged();
      const fallback = templates.find((template) => template.id === 'standard_meeting');
      onTemplateSelect(fallback?.id || 'standard_meeting', fallback?.name || 'Standard Meeting');
      await loadTemplate(fallback?.id || 'standard_meeting');
    } catch (error) {
      toast.error('Template not deleted', {
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyJson = async () => {
    try {
      const json = activeTemplateId
        ? await templateService.exportTemplate(activeTemplateId)
        : jsonDraft;
      await navigator.clipboard.writeText(json);
      toast.success('Template JSON copied');
    } catch (error) {
      toast.error('Template JSON not copied', {
        description: String(error),
      });
    }
  };

  const handleImportOverwrite = async () => {
    if (!newTemplateId.trim()) {
      toast.error('Template ID is required');
      return;
    }

    setSaving(true);
    try {
      const saved = await templateService.importTemplate(newTemplateId, jsonDraft, true);
      toast.success('Template imported');
      await refreshAndSelect(saved);
    } catch (error) {
      toast.error('Template not imported', {
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" title="Manage summary templates">
            <FilePenLine />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-5xl gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Summary Templates</DialogTitle>
          <DialogDescription>Manage custom summary template JSON.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[520px] grid-cols-[260px_1fr]">
          <div className="border-r">
            <div className="flex gap-2 border-b p-3">
              <Button size="sm" variant="outline" onClick={handleNew} className="flex-1">
                <Plus />
                New
              </Button>
              <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={!activeTemplateId}>
                <CopyPlus />
              </Button>
            </div>

            <ScrollArea className="h-[464px]">
              <div className="space-y-1 p-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => loadTemplate(template.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      activeTemplateId === template.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <span className="block truncate font-medium">{template.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>{sourceLabel(template.source)}</span>
                      {template.overridesBuiltin && <span>Override</span>}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="grid grid-cols-[1fr_auto] gap-3 border-b p-4">
              <div className="space-y-2">
                <Label htmlFor="template-id">Template ID</Label>
                <Input
                  id="template-id"
                  value={editorMode === 'new' ? newTemplateId : activeTemplate?.id || ''}
                  onChange={(event) => setNewTemplateId(event.target.value)}
                  disabled={editorMode !== 'new'}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyJson}>
                  <Copy />
                  Copy JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportOverwrite}
                  disabled={saving || !newTemplateId.trim()}
                >
                  <Upload />
                  Import
                </Button>
              </div>
            </div>

            <div className="flex-1 p-4">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : (
                <Textarea
                  value={jsonDraft}
                  onChange={(event) => setJsonDraft(event.target.value)}
                  spellCheck={false}
                  className="h-[360px] resize-none font-mono text-xs"
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={saving || !activeTemplate?.deletable || editorMode === 'new'}
          >
            <Trash2 />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
