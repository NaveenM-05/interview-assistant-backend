import { RotateCcw } from 'lucide-react';
import Button from '../ui/Button';
import StatusPill from '../ui/StatusPill';

const wsTone = { Connected: 'good', Connecting: 'warn' };

export default function RoomHeader({ session, wsStatus, isRecording, onNewInterview }) {
  const isBehavioral = session.interviewType === 'BEHAVIORAL';
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {isBehavioral ? 'Behavioral interview' : 'DSA interview'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-electric/15 px-2 py-1 font-semibold text-cyan">{session.topic}</span>
          <span className="rounded-md bg-violet/15 px-2 py-1 font-semibold text-orchid">
            {isBehavioral ? 'STAR rubric' : session.difficulty}
          </span>
          <span className="font-mono text-mute" title="Session ID">
            {session.sessionId}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isRecording && (
          <StatusPill tone="live" pulse className="border-rose-500/40 text-rose-200">
            Recording
          </StatusPill>
        )}
        <StatusPill tone={wsTone[wsStatus] ?? 'bad'} pulse={wsStatus === 'Connecting'}>
          {wsStatus === 'Connecting' ? 'Connecting…' : wsStatus}
        </StatusPill>
        <Button variant="glass" size="sm" onClick={onNewInterview}>
          <RotateCcw size={14} aria-hidden="true" />
          New interview
        </Button>
      </div>
    </div>
  );
}
