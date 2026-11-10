import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ChatPanel from '../components/interview/ChatPanel';
import CodePanel from '../components/interview/CodePanel';
import EvaluationPanel from '../components/interview/EvaluationPanel';
import QuestionCard from '../components/interview/QuestionCard';
import RoomHeader from '../components/interview/RoomHeader';
import { USER_ID } from '../config';
import { useSession } from '../context/session';
import { useInterviewSocket } from '../hooks/useInterviewSocket';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useVoice } from '../hooks/useVoice';

export default function InterviewRoom() {
  const { session } = useSession();
  if (!session?.sessionId) return <Navigate to="/setup" replace />;
  // Remount per session so sockets, transcript and code reset cleanly.
  return <Room key={session.sessionId} session={session} />;
}

function Room({ session }) {
  const navigate = useNavigate();
  const { endSession } = useSession();
  const { interviewType, topic } = session;
  const isBehavioral = interviewType === 'BEHAVIORAL';

  const voice = useVoice();
  const socket = useInterviewSocket(session.sessionId, { onSpeak: voice.speak });
  const speech = useSpeechInput();
  const [code, setCode] = useState(session.code);
  const [sendError, setSendError] = useState(null);

  const error = sendError || speech.error;

  const stopMic = () => {
    if (speech.isRecording) speech.stop();
  };

  const toggleMic = () => {
    setSendError(null);
    speech.toggle();
  };

  const sendAnswer = () => {
    const trimmed = speech.transcript.trim();
    if (!trimmed && (isBehavioral || !code.trim())) return;
    stopMic();

    const err = socket.send({
      interview_type: interviewType,
      topic,
      transcript: trimmed,
      code: isBehavioral ? '' : code,
      user_id: USER_ID,
    });
    if (err) {
      setSendError(err);
      return;
    }
    setSendError(null);
    socket.addUserMessage(trimmed || '[Submitted updated code for review]', topic);
    speech.clear();
  };

  const finalize = () => {
    stopMic();
    const raw = speech.transcript;
    const err = socket.finalize({
      interview_type: interviewType,
      transcript: raw,
      code: isBehavioral ? '' : code,
      user_id: USER_ID,
    });
    if (err) {
      setSendError(err);
      return;
    }
    setSendError(null);
    if (raw.trim()) socket.addUserMessage(raw.trim(), topic);
    speech.clear();
  };

  const newInterview = () => {
    stopMic();
    socket.close();
    voice.cancel();
    endSession();
    navigate('/setup');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <RoomHeader
        session={session}
        wsStatus={socket.status}
        isRecording={speech.isRecording}
        onNewInterview={newInterview}
      />

      <div className={isBehavioral ? 'mx-auto max-w-3xl space-y-6' : 'space-y-6'}>
        <QuestionCard question={session.question} isBehavioral={isBehavioral} />

        <div className={isBehavioral ? '' : 'grid items-start gap-6 lg:grid-cols-2'}>
          <ChatPanel
            messages={socket.messages}
            isBehavioral={isBehavioral}
            transcript={speech.transcript}
            onTranscriptChange={speech.setTranscript}
            isRecording={speech.isRecording}
            onToggleMic={toggleMic}
            onSend={sendAnswer}
            onFinalize={finalize}
            isFinalizing={socket.isFinalizing}
            isAwaitingReply={socket.isAwaitingReply}
            error={error}
          />
          {!isBehavioral && (
            <CodePanel
              code={code}
              onChange={setCode}
              optimalCode={socket.optimalCode}
              onBackToEditor={socket.clearOptimalCode}
            />
          )}
        </div>

        {socket.evaluation && (
          <EvaluationPanel evaluation={socket.evaluation} isBehavioral={isBehavioral} topic={topic} />
        )}
      </div>
    </div>
  );
}
