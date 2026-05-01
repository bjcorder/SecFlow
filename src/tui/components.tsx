import React from 'react';
import {Box, Text} from 'ink';
import type {AuditEvent, AuditRun, ContextPreview, NormalizedFinding, ToolRunResult} from '../core/types.js';
import type {PreflightData} from './preflight.js';

export function Section({title, children}: {title: string; children: React.ReactNode}): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      {children}
    </Box>
  );
}

export function StatusRow({label, value, color = 'white'}: {label: string; value: string | number; color?: string}): React.ReactElement {
  return (
    <Text>
      <Text color="gray">{label}: </Text>
      <Text color={color}>{String(value)}</Text>
    </Text>
  );
}

export function PreflightSummary({data}: {data: PreflightData}): React.ReactElement {
  return (
    <>
      <Section title="Preflight">
        <StatusRow label="Target" value={data.targetPath} />
        <StatusRow label="Config" value={data.configPath ?? 'built-in defaults'} />
        <StatusRow label="Default runtime" value={data.defaultRuntime ?? 'none'} color={data.defaultRuntime ? 'green' : 'yellow'} />
        <StatusRow label="Context approval" value={data.config.context.requireApproval ? 'required' : 'not required'} />
      </Section>
      <Section title="Tools and Runtimes">
        {data.tooling.map((row) => (
          <StatusRow key={row.name} label={row.name} value={`${row.available ? 'available' : 'missing'} / ${row.enabled ? 'enabled' : 'disabled'}`} color={row.available ? 'green' : 'yellow'} />
        ))}
        {data.runtimes.map((row) => (
          <StatusRow key={row.name} label={row.name} value={`${row.kind} / ${row.enabled ? 'enabled' : 'disabled'} / ${row.model ?? 'default'}`} color={row.enabled ? 'green' : 'gray'} />
        ))}
      </Section>
      {data.warnings.length > 0 && (
        <Section title="Warnings">
          {data.warnings.map((warning) => (
            <Text key={warning} color="yellow">
              {warning}
            </Text>
          ))}
        </Section>
      )}
    </>
  );
}

export function EventLog({events}: {events: AuditEvent[]}): React.ReactElement {
  const visible = events.slice(-12);
  return (
    <Section title="Run Progress">
      {visible.length === 0 ? (
        <Text color="gray">Waiting to start...</Text>
      ) : (
        visible.map((event, index) => <Text key={`${event.timestamp}-${index}`}>{renderEvent(event)}</Text>)
      )}
    </Section>
  );
}

export function ContextApprovalSummary({preview}: {preview: ContextPreview}): React.ReactElement {
  return (
    <Section title="LLM Context Approval">
      <StatusRow label="Runtime" value={preview.runtime} />
      <StatusRow label="Prompt" value={preview.promptId} />
      <StatusRow label="Context size" value={`${preview.sizeBytes} / ${preview.maxBytes} bytes`} color={preview.sizeBytes <= preview.maxBytes ? 'green' : 'red'} />
      <StatusRow label="Redaction rules" value={preview.redactionPatternCount} />
      <StatusRow label="Preview file" value={preview.contextPath} />
    </Section>
  );
}

export function ResultsSummary({run}: {run: AuditRun}): React.ReactElement {
  const scannerFindings = run.findings.filter((finding) => finding.source !== 'business-logic');
  const businessFindings = run.findings.filter((finding) => finding.source === 'business-logic');
  const skippedTools = run.toolResults.filter((result) => result.skipped);

  return (
    <>
      <Section title="Results">
        <StatusRow label="Run" value={run.runId} />
        <StatusRow label="Files profiled" value={run.profile.fileCount} />
        <StatusRow label="Business hypotheses" value={businessFindings.length} color={businessFindings.length > 0 ? 'yellow' : 'green'} />
        <StatusRow label="Scanner findings" value={scannerFindings.length} color={scannerFindings.length > 0 ? 'yellow' : 'green'} />
        <StatusRow label="LLM runtime" value={run.llmResponses.length > 0 ? 'invoked' : 'not invoked'} />
        <StatusRow label="Report" value={run.reportPath} />
        <StatusRow label="SARIF" value={run.sarifPath} />
      </Section>
      <FindingSummary title="Top Business Logic Items" findings={businessFindings} />
      <ToolOutcomeSummary results={run.toolResults} />
      {skippedTools.length > 0 && (
        <Section title="Skipped Tools">
          {skippedTools.map((result) => (
            <Text key={result.tool} color="yellow">
              {result.tool}: {result.message}
            </Text>
          ))}
        </Section>
      )}
    </>
  );
}

export function FindingSummary({title, findings}: {title: string; findings: NormalizedFinding[]}): React.ReactElement {
  return (
    <Section title={title}>
      {findings.length === 0 ? (
        <Text color="gray">No findings in this category.</Text>
      ) : (
        findings.slice(0, 5).map((finding) => (
          <Text key={finding.id}>
            <Text color={severityColor(finding.severity)}>{finding.severity}</Text> {finding.title}
          </Text>
        ))
      )}
    </Section>
  );
}

export function ToolOutcomeSummary({results}: {results: ToolRunResult[]}): React.ReactElement {
  return (
    <Section title="Tool Outcomes">
      {results.length === 0 ? (
        <Text color="gray">No tool results.</Text>
      ) : (
        results.map((result) => (
          <Text key={result.tool}>
            <Text color={result.available ? 'green' : 'yellow'}>{result.tool}</Text>: {result.skipped ? 'skipped' : 'ran'} / {result.findings.length} findings
          </Text>
        ))
      )}
    </Section>
  );
}

function renderEvent(event: AuditEvent): string {
  if (event.type === 'tool:complete') {
    return `${event.result.tool}: ${event.result.skipped ? 'skipped' : 'completed'} (${event.result.findings.length} findings)`;
  }
  if (event.type === 'context:preview') {
    return `Context preview ready for ${event.preview.runtime}: ${event.preview.sizeBytes} bytes`;
  }
  if (event.type === 'llm:skipped') {
    return `LLM skipped: ${event.reason}`;
  }
  if (event.type === 'run:complete') {
    return `Run complete: ${event.run.findings.length} findings`;
  }
  if (event.type === 'error') {
    return `Error: ${event.message}`;
  }
  return event.message;
}

function severityColor(severity: NormalizedFinding['severity']): string {
  if (severity === 'critical' || severity === 'high') return 'red';
  if (severity === 'medium') return 'yellow';
  if (severity === 'low') return 'blue';
  return 'gray';
}
