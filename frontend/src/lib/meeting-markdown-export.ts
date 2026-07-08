import type { RefObject } from 'react';
import type { BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';
import type { Summary, Transcript } from '@/types';
import type { DocumentExportFormat } from './meeting-document-export';

interface MeetingLike {
  id: string;
  title?: string | null;
  created_at: string;
}

interface SummaryMarkdownOptions {
  actionLabel?: 'Copied on' | 'Exported on';
}

function formatMeetingDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeDateStamp(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export function formatTranscriptTimestamp(
  seconds: number | undefined,
  fallbackTimestamp: string,
): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return fallbackTimestamp;
  }

  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
}

export function formatTranscriptMarkdown(
  meeting: MeetingLike,
  meetingTitle: string,
  transcripts: Transcript[],
): string {
  const title = meetingTitle || meeting.title || 'Untitled meeting';
  const header = `# Transcript of the Meeting: ${meeting.id} - ${title}\n\n`;
  const date = `## Date: ${new Date(meeting.created_at).toLocaleDateString()}\n\n`;
  const transcriptBody = transcripts
    .map((transcript) => `${formatTranscriptTimestamp(transcript.audio_start_time, transcript.timestamp)} ${transcript.text}  `)
    .join('\n');

  return header + date + transcriptBody;
}

export async function resolveSummaryMarkdown(
  aiSummary: Summary | null,
  blockNoteSummaryRef: RefObject<BlockNoteSummaryViewRef>,
): Promise<string> {
  let summaryMarkdown = '';

  if (blockNoteSummaryRef.current?.getMarkdown) {
    summaryMarkdown = await blockNoteSummaryRef.current.getMarkdown();
  }

  const summaryRecord = aiSummary as Record<string, any> | null;

  if (!summaryMarkdown && summaryRecord?.markdown) {
    summaryMarkdown = summaryRecord.markdown || '';
  }

  if (!summaryMarkdown && summaryRecord) {
    summaryMarkdown = Object.entries(summaryRecord)
      .filter(([key]) => (
        key !== 'markdown'
        && key !== 'summary_json'
        && key !== '_section_order'
        && key !== 'MeetingName'
      ))
      .map(([, section]) => {
        if (section && typeof section === 'object' && 'title' in section && 'blocks' in section) {
          const sectionTitle = `## ${section.title}\n\n`;
          const sectionContent = section.blocks
            .map((block: any) => `- ${block.content}`)
            .join('\n');
          return sectionTitle + sectionContent;
        }

        return '';
      })
      .filter((section) => section.trim())
      .join('\n\n');
  }

  return summaryMarkdown;
}

export function formatSummaryMarkdown(
  meeting: MeetingLike,
  meetingTitle: string,
  summaryMarkdown: string,
  options: SummaryMarkdownOptions = {},
): string {
  const title = meetingTitle || meeting.title || 'Untitled meeting';
  const actionLabel = options.actionLabel ?? 'Copied on';
  const header = `# Meeting Summary: ${title}\n\n`;
  const metadata = `**Meeting ID:** ${meeting.id}\n**Date:** ${formatMeetingDate(meeting.created_at)}\n**${actionLabel}:** ${formatMeetingDate(new Date().toISOString())}\n\n---\n\n`;

  return header + metadata + summaryMarkdown;
}

export function formatFullMeetingMarkdown(
  meeting: MeetingLike,
  meetingTitle: string,
  summaryMarkdown: string,
  transcripts: Transcript[],
): string {
  const title = meetingTitle || meeting.title || 'Untitled meeting';
  const transcriptBody = transcripts
    .map((transcript) => `${formatTranscriptTimestamp(transcript.audio_start_time, transcript.timestamp)} ${transcript.text}  `)
    .join('\n');

  const sections = [
    `# Meeting Export: ${title}`,
    '',
    `**Meeting ID:** ${meeting.id}`,
    `**Date:** ${new Date(meeting.created_at).toLocaleDateString()}`,
    `**Exported on:** ${new Date().toLocaleDateString()}`,
    '',
    '---',
    '',
  ];

  if (summaryMarkdown.trim()) {
    sections.push('## Summary', '', summaryMarkdown.trim(), '');
  }

  if (transcriptBody.trim()) {
    sections.push('## Transcript', '', transcriptBody);
  }

  return sections.join('\n');
}

export function sanitizeExportFilename(input: string): string {
  const sanitized = input
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[-\s]+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return sanitized || 'Meeting';
}

export function buildMarkdownExportFilename(
  meeting: MeetingLike,
  meetingTitle: string,
  exportType: 'Summary' | 'Transcript',
): string {
  const title = sanitizeExportFilename(meetingTitle || meeting.title || 'Meeting');
  return `${title}-${exportType}-${safeDateStamp(meeting.created_at)}.md`;
}

export function buildDocumentExportFilename(
  meeting: MeetingLike,
  meetingTitle: string,
  exportType: 'Full' | 'Summary' | 'Transcript',
  format: DocumentExportFormat,
): string {
  const extension = format === 'markdown' ? 'md' : format;
  const title = sanitizeExportFilename(meetingTitle || meeting.title || 'Meeting');
  return `${title}-${exportType}-${safeDateStamp(meeting.created_at)}.${extension}`;
}
