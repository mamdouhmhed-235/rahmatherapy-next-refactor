"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(MEDIA_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  // SSR renders the motion-allowed markup; the effect below stops the video on
  // the client if the visitor actually asked for reduced motion. Defaulting the
  // other way would show a still poster to everyone for one frame.
  return false;
}

/**
 * The homepage hero video, with the two things WCAG 2.2.2 (Pause, Stop, Hide)
 * requires of content that moves for more than five seconds: a way to stop it,
 * and respect for the visitor's own reduced-motion setting.
 *
 * ⛔ Before this existed the `<video>` was `autoPlay loop` with no controls, and
 * the whole PUBLIC site had no `prefers-reduced-motion` handling at all — every
 * such handler in the codebase lived under `src/app/admin/`. A visitor with
 * vertigo or vestibular sensitivity had no way to stop it.
 *
 * The video stays `muted` + `playsInline` because browsers refuse to autoplay
 * with sound, and it carries no information — the poster frame is the whole
 * meaning, so it is `aria-hidden` and the control is the only thing exposed.
 */
export function HomeHeroVideo() {
  const reduceMotion = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      // Rewind so the poster-equivalent first frame is what is left on screen,
      // rather than an arbitrary frame from wherever autoplay reached first.
      video.currentTime = 0;
      setPlaying(false);
      return;
    }

    // `play()` rejects if the browser blocks it (data saver, battery saver, a
    // background tab). That is not an error worth reporting — but the button
    // must not then claim the video is playing.
    void video.play().then(
      () => setPlaying(true),
      () => setPlaying(false)
    );
  }, [reduceMotion]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        // ⛔ No `autoPlay` attribute: playback is started by the effect above so
        // that a reduced-motion visitor never sees it move, not even briefly.
        loop
        muted
        playsInline
        preload="auto"
        poster="/images/home/homepage-hero-poster-v3.jpg"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/videos/homepage-hero-v3.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!playing}
        className="absolute bottom-5 right-5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {playing ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Play className="h-5 w-5" aria-hidden="true" />
        )}
        <span className="sr-only">
          {playing
            ? "Pause the background video"
            : "Play the background video"}
        </span>
      </button>
    </>
  );
}
