import { useCallback, RefObject } from 'react';
import { Transcript, Summary } from '@/types';
import { BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';
import { toast } from 'sonner';
import { invoke as invokeTauri } from '@tauri-apps/api/core';
import {
  buildDocumentExportFilename,
  formatFullMeetingMarkdown,
  formatSummaryMarkdown,
  formatTranscriptMarkdown,
  resolveSummaryMarkdown,
} from '@/lib/meeting-markdown-export';
import {
  BinaryDocumentExportFormat,
  DocumentExportFormat,
  generateDocxFromMarkdown,
  generatePdfFromMarkdown,
} from '@/lib/meeting-document-export';

interface UseCopyOperationsProps {
  meeting: any;
  transcripts: Transcript[];
  meetingTitle: string;
  aiSummary: Summary | null;
  blockNoteSummaryRef: RefObject<BlockNoteSummaryViewRef>;
}

export function useCopyOperations({
  meeting,
  transcripts,
  meetingTitle,
  aiSummary,
  blockNoteSummaryRef,
}: UseCopyOperationsProps) {

  // Helper function to fetch ALL transcripts for copying (not just paginated data)
  const fetchAllTranscripts = useCallback(async (meetingId: string): Promise<Transcript[]> => {
    try {
      console.log('📊 Fetching all transcripts for copying:', meetingId);

      // First, get total count by fetching first page
      const firstPage = await invokeTauri('api_get_meeting_transcripts', {
        meetingId,
        limit: 1,
        offset: 0,
      }) as { transcripts: Transcript[]; total_count: number; has_more: boolean };

      const totalCount = firstPage.total_count;
      console.log(`📊 Total transcripts in database: ${totalCount}`);

      if (totalCount === 0) {
        return [];
      }

      // Fetch all transcripts in one call
      const allData = await invokeTauri('api_get_meeting_transcripts', {
        meetingId,
        limit: totalCount,
        offset: 0,
      }) as { transcripts: Transcript[]; total_count: number; has_more: boolean };

      console.log(`✅ Fetched ${allData.transcripts.length} transcripts from database for copying`);
      return allData.transcripts;
    } catch (error) {
      console.error('❌ Error fetching all transcripts:', error);
      toast.error('Failed to fetch transcripts for copying');
      return [];
    }
  }, []);

  const exportMarkdownFile = useCallback(async (
    defaultFileName: string,
    content: string,
  ): Promise<string | null> => {
    return invokeTauri('export_markdown_file', {
      defaultFileName,
      content,
    }) as Promise<string | null>;
  }, []);

  const exportBinaryFile = useCallback(async (
    defaultFileName: string,
    content: Uint8Array,
    extension: BinaryDocumentExportFormat,
  ): Promise<{ path: string; bytesWritten: number } | null> => {
    return invokeTauri('export_binary_file', {
      defaultFileName,
      content: Array.from(content),
      extension,
      filterName: extension === 'pdf' ? 'PDF' : 'Word Document',
    }) as Promise<{ path: string; bytesWritten: number } | null>;
  }, []);

  const exportDocument = useCallback(async (
    defaultFileName: string,
    markdown: string,
    format: DocumentExportFormat,
  ): Promise<string | null> => {
    if (format === 'markdown') {
      return exportMarkdownFile(defaultFileName, markdown);
    }

    const bytes = format === 'pdf'
      ? generatePdfFromMarkdown(markdown)
      : generateDocxFromMarkdown(markdown);
    const result = await exportBinaryFile(defaultFileName, bytes, format);
    return result?.path || null;
  }, [exportBinaryFile, exportMarkdownFile]);

  // Copy transcript to clipboard
  const handleCopyTranscript = useCallback(async () => {
    // CHANGE: Fetch ALL transcripts from database, not from pagination state
    console.log('📊 Fetching all transcripts for copying...');
    const allTranscripts = await fetchAllTranscripts(meeting.id);

    if (!allTranscripts.length) {
      const error_msg = 'No transcripts available to copy';
      console.log(error_msg);
      toast.error(error_msg);
      return;
    }

    console.log(`✅ Copying ${allTranscripts.length} transcripts to clipboard`);

    await navigator.clipboard.writeText(formatTranscriptMarkdown(meeting, meetingTitle, allTranscripts));
    toast.success("Transcript copied to clipboard");

    const wordCount = allTranscripts
      .map(t => t.text.split(/\s+/).length)
      .reduce((a, b) => a + b, 0);

  }, [meeting, meetingTitle, fetchAllTranscripts]);

  const handleExportTranscript = useCallback(async (format: DocumentExportFormat = 'markdown') => {
    try {
      const allTranscripts = await fetchAllTranscripts(meeting.id);

      if (!allTranscripts.length) {
        toast.error('No transcripts available to export');
        return;
      }

      const filePath = await exportDocument(
        buildDocumentExportFilename(meeting, meetingTitle, 'Transcript', format),
        formatTranscriptMarkdown(meeting, meetingTitle, allTranscripts),
        format,
      );

      if (filePath) {
        toast.success(`Transcript exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('❌ Failed to export transcript:', error);
      toast.error('Failed to export transcript');
    }
  }, [exportDocument, fetchAllTranscripts, meeting, meetingTitle]);

  // Copy summary to clipboard
  const handleCopySummary = useCallback(async () => {
    try {
      console.log('🔍 Copy Summary - Starting...');
      const summaryMarkdown = await resolveSummaryMarkdown(aiSummary, blockNoteSummaryRef);

      // If still no summary content, show message
      if (!summaryMarkdown.trim()) {
        console.error('❌ No summary content available to copy');
        toast.error('No summary content available to copy');
        return;
      }

      await navigator.clipboard.writeText(formatSummaryMarkdown(meeting, meetingTitle, summaryMarkdown));

      console.log('✅ Successfully copied to clipboard!');
      toast.success("Summary copied to clipboard");

    } catch (error) {
      console.error('❌ Failed to copy summary:', error);
      toast.error("Failed to copy summary");
    }
  }, [aiSummary, meetingTitle, meeting, blockNoteSummaryRef]);

  const handleExportSummary = useCallback(async (format: DocumentExportFormat = 'markdown') => {
    try {
      const summaryMarkdown = await resolveSummaryMarkdown(aiSummary, blockNoteSummaryRef);

      if (!summaryMarkdown.trim()) {
        toast.error('No summary content available to export');
        return;
      }

      const filePath = await exportDocument(
        buildDocumentExportFilename(meeting, meetingTitle, 'Summary', format),
        formatSummaryMarkdown(meeting, meetingTitle, summaryMarkdown, { actionLabel: 'Exported on' }),
        format,
      );

      if (filePath) {
        toast.success(`Summary exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('❌ Failed to export summary:', error);
      toast.error('Failed to export summary');
    }
  }, [aiSummary, blockNoteSummaryRef, exportDocument, meeting, meetingTitle]);

  const handleExportFullMeeting = useCallback(async (format: BinaryDocumentExportFormat) => {
    try {
      const [summaryMarkdown, allTranscripts] = await Promise.all([
        resolveSummaryMarkdown(aiSummary, blockNoteSummaryRef),
        fetchAllTranscripts(meeting.id),
      ]);

      if (!summaryMarkdown.trim() && !allTranscripts.length) {
        toast.error('No meeting content available to export');
        return;
      }

      const filePath = await exportDocument(
        buildDocumentExportFilename(meeting, meetingTitle, 'Full', format),
        formatFullMeetingMarkdown(meeting, meetingTitle, summaryMarkdown, allTranscripts),
        format,
      );

      if (filePath) {
        toast.success(`Meeting exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('❌ Failed to export meeting:', error);
      toast.error('Failed to export meeting');
    }
  }, [aiSummary, blockNoteSummaryRef, exportDocument, fetchAllTranscripts, meeting, meetingTitle]);

  return {
    handleCopyTranscript,
    handleCopySummary,
    handleExportTranscript,
    handleExportSummary,
    handleExportFullMeeting,
  };
}
