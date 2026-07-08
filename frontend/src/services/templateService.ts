import { invoke } from '@tauri-apps/api/core';

export type TemplateSource = 'builtin' | 'bundled' | 'custom';
export type TemplateSectionFormat = 'paragraph' | 'list' | 'string';

export interface TemplateSection {
  title: string;
  instruction: string;
  format: TemplateSectionFormat;
  item_format?: string | null;
  example_item_format?: string | null;
}

export interface TemplateDraft {
  name: string;
  description: string;
  sections: TemplateSection[];
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  source: TemplateSource;
  editable: boolean;
  deletable: boolean;
  overridesBuiltin: boolean;
}

export interface TemplateDetails extends TemplateInfo {
  sections: TemplateSection[];
}

class TemplateService {
  listTemplates(): Promise<TemplateInfo[]> {
    return invoke<TemplateInfo[]>('api_list_templates');
  }

  getTemplateDetails(templateId: string): Promise<TemplateDetails> {
    return invoke<TemplateDetails>('api_get_template_details', { templateId });
  }

  validateTemplate(templateJson: string): Promise<string> {
    return invoke<string>('api_validate_template', { templateJson });
  }

  createCustomTemplate(templateId: string, template: TemplateDraft): Promise<TemplateInfo> {
    return invoke<TemplateInfo>('api_create_custom_template', { templateId, template });
  }

  updateCustomTemplate(templateId: string, template: TemplateDraft): Promise<TemplateInfo> {
    return invoke<TemplateInfo>('api_update_custom_template', { templateId, template });
  }

  deleteCustomTemplate(templateId: string): Promise<void> {
    return invoke<void>('api_delete_custom_template', { templateId });
  }

  duplicateTemplate(sourceTemplateId: string, newTemplateId: string, newName?: string): Promise<TemplateInfo> {
    return invoke<TemplateInfo>('api_duplicate_template', {
      sourceTemplateId,
      newTemplateId,
      newName: newName || null,
    });
  }

  exportTemplate(templateId: string): Promise<string> {
    return invoke<string>('api_export_template', { templateId });
  }

  importTemplate(templateId: string, templateJson: string, overwrite: boolean): Promise<TemplateInfo> {
    return invoke<TemplateInfo>('api_import_template', { templateId, templateJson, overwrite });
  }
}

export const templateService = new TemplateService();
