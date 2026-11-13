import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import { SPEEDS, type Speed } from "../../lib/player";
import type { Card } from "../../types";
import Button from "../ui/Button";

export interface SignPlayerHandle {
  toggle: () => void;
  replay: () => void;
  cycleSpeed: () => void;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The sign video is the centre of every learning screen. Nothing is drawn
 * over it: Play/Pause, Replay and the 0.5×, 0.75×, 1× speeds sit below.
 *
 * If the video can't play (offline and not downloaded, or no recording yet)
 * the poster image and the written description are the fallback.
 */
export default function SignPlayer({
  card,
  speed,
  onSpeedChange,
  label,
  ref,
}: {
  card: Card;
  speed: Speed;
  onSpeedChange: (s: Speed) => void;
  /** Accessible name for the video. In a lesson check it must not give away
   *  the answer, so the caller passes a neutral label there. */
  label: string;
  ref?: Ref<SignPlayerHandle>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !card.video_url || failedUrl === card.video_url;

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, card.id]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, []);

  const replay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  }, []);

  const cycleSpeed = useCallback(() => {
    onSpeedChange(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
  }, [onSpeedChange, speed]);

  useImperativeHandle(ref, () => ({ toggle, replay, cycleSpeed }), [toggle, replay, cycleSpeed]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="overflow-hidden bg-video md:rounded-card">
        {!failed ? (
          <video
            key={card.video_url}
            ref={videoRef}
            className="block aspect-[4/3] max-h-[440px] w-full cursor-pointer bg-video object-contain"
            src={card.video_url}
            poster={card.poster_url || undefined}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-label={label}
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              e.currentTarget.playbackRate = speed;
              setDuration(e.currentTarget.duration);
              setTime(0);
            }}
            onError={() => setFailedUrl(card.video_url)}
          />
        ) : (
          <div className="grid aspect-[4/3] max-h-[440px] w-full place-items-center p-6 text-center text-white">
            {card.poster_url ? (
              <img src={card.poster_url} alt={label.replace("Sign video", "Still image of the sign")} className="max-h-full max-w-full" />
            ) : (
              <p className="text-body">The video for this sign isn't available on this device right now.</p>
            )}
          </div>
        )}
      </div>

      {failed ? (
        <p className="px-4 text-label text-muted md:px-0">
          {card.video_url
            ? "This video isn't saved on this device. Download the module while you are connected to watch it offline."
            : "There is no video for this sign yet. Use the written description below."}
        </p>
      ) : (
        <>
          <p className="px-4 text-right text-cap text-muted md:px-0" aria-hidden="true">
            {clock(time)} / {clock(duration)}
          </p>
          <div
            role="group"
            aria-label="Video controls"
            className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-0"
          >
            <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
              <Button variant="brand" icon={playing ? "pause" : "play"} onClick={toggle}>
                {playing ? "Pause" : "Play"}
              </Button>
              <Button variant="secondary" icon="replay" onClick={replay}>
                Replay
              </Button>
            </div>
            <div
              role="group"
              aria-label="Playback speed"
              className="grid w-full grid-cols-3 overflow-hidden rounded-ctl border border-control bg-white sm:w-auto"
            >
              {SPEEDS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  aria-label={`Speed ${s} times`}
                  onClick={() => onSpeedChange(s)}
                  className={`min-h-11 min-w-14 cursor-pointer text-nav font-semibold ${i > 0 ? "border-l border-control" : ""} ${
                    speed === s ? "bg-forest text-white" : "text-forest"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
