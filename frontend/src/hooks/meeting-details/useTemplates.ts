import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { TemplateInfo, templateService } from '@/services/templateService';

export function useTemplates() {
  const [availableTemplates, setAvailableTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard_meeting');

  const refreshTemplates = useCallback(async () => {
    try {
      const templates = await templateService.listTemplates();
      console.log('Available templates:', templates);
      setAvailableTemplates(templates);
      setSelectedTemplate((current) =>
        templates.some((template) => template.id === current)
          ? current
          : 'standard_meeting'
      );
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, []);

  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  useEffect(() => {
    if (
      availableTemplates.length > 0 &&
      !availableTemplates.some((template) => template.id === selectedTemplate)
    ) {
      setSelectedTemplate('standard_meeting');
    }
  }, [availableTemplates, selectedTemplate]);

  const handleTemplatesChanged = useCallback(async () => {
    await refreshTemplates();
  }, [refreshTemplates]);

  const handleTemplateSelection = useCallback((templateId: string, templateName: string) => {
    setSelectedTemplate(templateId);
    toast.success('Template selected', {
      description: `Using "${templateName}" template for summary generation`,
    });
  }, []);

  return {
    availableTemplates,
    selectedTemplate,
    handleTemplateSelection,
    refreshTemplates: handleTemplatesChanged,
  };
}
