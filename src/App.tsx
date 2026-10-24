import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "./utils/cn";
import bgImg from "./assets/bg.jpg?inline";
import mochiWave from "./assets/mochi-wave.png?inline";
import mochiThink from "./assets/mochi-think.png?inline";
import mochiHigh from "./assets/mochi-high.png?inline";
import mochiLow from "./assets/mochi-low.png?inline";
import mochiClose from "./assets/mochi-close.png?inline";
import mochiCelebrate from "./assets/mochi-celebrate.png?inline";

type Screen = "home" | "playing" | "won";
type Difficulty = "easy" | "medium" | "hard";
type Mood = "wave" | "think" | "high" | "low" | "close" | "celebrate";

type Guess = {
  value: number;
  result: "high" | "low" | "correct";
  close: boolean;
};

type BestMap = Record<Difficulty, number | null>;

const RANGES: Record<Difficulty, number> = {
  easy: 20,
  medium: 50,
  hard: 100,
};

const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; emoji: string; blurb: string; tint: string }
> = {
  easy: {
    label: "Easy",
    emoji: "🍓",
    blurb: "Numbers 1–20",
    tint: "from-pink-200 to-rose-100",
  },
  medium: {
    label: "Medium",
    emoji: "🌸",
    blurb: "Numbers 1–50",
    tint: "from-fuchsia-200 to-pink-100",
  },
  hard: {
    label: "Hard",
    emoji: "⭐",
    blurb: "Numbers 1–100",
    tint: "from-amber-200 to-yellow-100",
  },
};

const MOOD_IMG: Record<Mood, string> = {
  wave: mochiWave,
  think: mochiThink,
  high: mochiHigh,
  low: mochiLow,
  close: mochiClose,
  celebrate: mochiCelebrate,
};

const HIGH_MSGS = [
  "Nyaa~ that's too high! Try a smaller number!",
  "Whoa, that's way up there! Go lower~",
  "A little lower, please! Mochi believes in you!",
  "Too big, silly! Come back down a bit!",
];

const LOW_MSGS = [
  "Mmm, too low! Go a little bigger~",
  "Not quite! That number is hiding higher up!",
  "Tiny bit too small! Climb higher, friend!",
  "Pout~ that's under my secret! Try bigger!",
];

const CLOSE_HIGH = [
  "So close!! Just a tiny bit lower!",
  "Ahh almost!! Shave a little off~",
  "Warm warm WARM! A wee bit smaller!",
];

const CLOSE_LOW = [
  "Almost!! Just a teeny bit higher!",
  "You're right next to it!! Nudge it up~",
  "So close I can taste the strawberry!! Higher!",
];

const WIN_MSGS = [
  "You found it!! You're the best~",
  "Yay yay YAY!! That's my secret number!",
  "Hehe you did it! Mochi is so proud!",
];

const HELLO_MSGS = [
  "Hehe~ I picked a secret number! Can you find it?",
  "Psst... I've got a number hiding! Guess it for me?",
  "Ready? I'll keep a number in my hoodie pocket~",
];

const BEST_KEY = "mochi-best-scores";

function loadBest(): BestMap {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return { easy: null, medium: null, hard: null };
    const parsed = JSON.parse(raw) as Partial<BestMap>;
    return {
      easy: parsed.easy ?? null,
      medium: parsed.medium ?? null,
      hard: parsed.hard ?? null,
    };
  } catch {
    return { easy: null, medium: null, hard: null };
  }
}

function saveBest(next: BestMap) {
  localStorage.setItem(BEST_KEY, JSON.stringify(next));
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function starsFor(attempts: number, max: number) {
  const perfect = Math.max(3, Math.ceil(Math.log2(max)) + 1);
  if (attempts <= 1) return 5;
  if (attempts <= perfect) return 4;
  if (attempts <= perfect + 2) return 3;
  if (attempts <= perfect + 5) return 2;
  return 1;
}

function starTitle(stars: number) {
  if (stars === 5) return "Unbelievable!!";
  if (stars === 4) return "Super smart!!";
  if (stars === 3) return "You found it~";
  if (stars === 2) return "Nice guessing!";
  return "You did it!!";
}

type Sfx = {
  enabled: boolean;
  click: () => void;
  high: () => void;
  low: () => void;
  win: () => void;
  error: () => void;
  start: () => void;
};

function useSfx(muted: boolean): Sfx {
  const ctxRef = useRef<AudioContext | null>(null);

  const ctx = useCallback(() => {
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = "sine",
      delay = 0,
      vol = 0.07,
    ) => {
      if (muted) return;
      const audio = ctx();
      const t = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + duration);
    },
    [ctx, muted],
  );

  return {
    enabled: !muted,
    click: () => tone(720, 0.08, "triangle", 0, 0.05),
    high: () => {
      tone(620, 0.12, "sine");
      tone(420, 0.16, "sine", 0.1);
    },
    low: () => {
      tone(380, 0.12, "sine");
      tone(560, 0.16, "sine", 0.1);
    },
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, "triangle", i * 0.1, 0.06));
    },
    error: () => {
      tone(240, 0.18, "square", 0, 0.03);
    },
    start: () => {
      tone(523, 0.12, "triangle");
      tone(784, 0.16, "triangle", 0.1);
    },
  };
}

const DECO = [
  { char: "♡", className: "top-[8%] left-[6%] text-3xl text-pink-400 animate-float" },
  { char: "✦", className: "top-[18%] right-[8%] text-2xl text-amber-400 animate-sparkle" },
  { char: "★", className: "bottom-[14%] left-[10%] text-2xl text-yellow-400 animate-sparkle" },
  { char: "♡", className: "bottom-[22%] right-[7%] text-3xl text-rose-300 animate-float" },
  { char: "✿", className: "top-[42%] left-[3%] text-2xl text-pink-300 animate-float" },
  { char: "✦", className: "top-[58%] right-[4%] text-xl text-fuchsia-300 animate-sparkle" },
  { char: "❀", className: "top-[6%] right-[28%] text-xl text-pink-300 animate-float" },
  { char: "★", className: "bottom-[8%] right-[22%] text-lg text-amber-300 animate-sparkle" },
];

function Confetti({ show }: { show: boolean }) {
  const bits = useMemo(() => {
    const glyphs = ["♡", "★", "✦", "🍓", "🌸", "✿", "✨"];
    const colors = ["#ff8fab", "#ffb7c5", "#ffd166", "#b6ead7", "#d4b5e8", "#ff9e7a"];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      glyph: glyphs[i % glyphs.length],
      color: colors[i % colors.length],
      left: `${(i * 37) % 100}%`,
      delay: `${(i % 10) * 0.18}s`,
      duration: `${3.6 + (i % 6) * 0.35}s`,
      size: 16 + (i % 5) * 4,
    }));
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-0 animate-fall"
          style={{
            left: b.left,
            animationDelay: b.delay,
            animationDuration: b.duration,
            color: b.color,
            fontSize: b.size,
          }}
        >
          {b.glyph}
        </span>
      ))}
    </div>
  );
}

function HeartMeter({ closeness }: { closeness: number | null }) {
  const filled = closeness == null ? 0 : Math.round(closeness * 5);
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "text-lg transition-all duration-300",
            i < filled ? "scale-110 text-rose-400" : "scale-90 text-rose-200",
          )}
        >
          {i < filled ? "♥" : "♡"}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [secret, setSecret] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<Mood>("wave");
  const [message, setMessage] = useState(HELLO_MSGS[0]);
  const [shake, setShake] = useState(false);
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState<BestMap>(() => loadBest());
  const [bubbleKey, setBubbleKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const sfx = useSfx(muted);

  const max = RANGES[difficulty];

  const bounds = useMemo(() => {
    let lo = 1;
    let hi = max;
    for (const g of guesses) {
      if (g.result === "low") lo = Math.max(lo, g.value + 1);
      if (g.result === "high") hi = Math.min(hi, g.value - 1);
    }
    return { lo, hi };
  }, [guesses, max]);

  const lastCloseness = useMemo(() => {
    const last = guesses[guesses.length - 1];
    if (!last) return null;
    const dist = Math.abs(last.value - secret);
    return Math.max(0, 1 - dist / max);
  }, [guesses, secret, max]);

  const startGame = (diff: Difficulty) => {
    sfx.start();
    setDifficulty(diff);
    setSecret(randInt(1, RANGES[diff]));
    setGuesses([]);
    setDraft("");
    setMood("think");
    setMessage(pick(HELLO_MSGS));
    setBubbleKey((k) => k + 1);
    setScreen("playing");
  };

  const bumpShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };

  const speak = (moodNext: Mood, text: string) => {
    setMood(moodNext);
    setMessage(text);
    setBubbleKey((k) => k + 1);
  };

  const submitGuess = useCallback(() => {
    const value = Number(draft);
    if (!draft || Number.isNaN(value) || !Number.isInteger(value)) {
      sfx.error();
      bumpShake();
      speak("think", "Ehehe, type a whole number for me~");
      return;
    }
    if (value < 1 || value > max) {
      sfx.error();
      bumpShake();
      speak("think", `Pick a number between 1 and ${max}, please!`);
      return;
    }
    if (guesses.some((g) => g.value === value)) {
      sfx.error();
      bumpShake();
      speak("think", "You already tried that one, silly~");
      return;
    }
    if (value < bounds.lo) {
      sfx.error();
      bumpShake();
      speak("low", `I already said it's at least ${bounds.lo}!`);
      return;
    }
    if (value > bounds.hi) {
      sfx.error();
      bumpShake();
      speak("high", `I already said it's at most ${bounds.hi}!`);
      return;
    }

    const dist = Math.abs(value - secret);
    const close = dist <= Math.max(2, Math.round(max * 0.08));

    if (value === secret) {
      const nextGuesses: Guess[] = [
        ...guesses,
        { value, result: "correct", close: true },
      ];
      setGuesses(nextGuesses);
      setDraft("");
      sfx.win();
      speak("celebrate", pick(WIN_MSGS));
      const attempts = nextGuesses.length;
      setBest((prev) => {
        const current = prev[difficulty];
        if (current == null || attempts < current) {
          const updated = { ...prev, [difficulty]: attempts };
          saveBest(updated);
          return updated;
        }
        return prev;
      });
      setScreen("won");
      return;
    }

    if (value > secret) {
      sfx.high();
      setGuesses((g) => [...g, { value, result: "high", close }]);
      speak(close ? "close" : "high", pick(close ? CLOSE_HIGH : HIGH_MSGS));
    } else {
      sfx.low();
      setGuesses((g) => [...g, { value, result: "low", close }]);
      speak(close ? "close" : "low", pick(close ? CLOSE_LOW : LOW_MSGS));
    }
    setDraft("");
  }, [draft, max, guesses, bounds.lo, bounds.hi, secret, sfx, difficulty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "playing") return;
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, submitGuess]);

  const pressDigit = (d: string) => {
    sfx.click();
    setDraft((prev) => {
      const next = (prev + d).replace(/^0+(?=\d)/, "");
      if (next.length > String(max).length) return prev;
      const n = Number(next);
      if (n > max * 10) return prev;
      return next;
    });
  };

  const backspace = () => {
    sfx.click();
    setDraft((p) => p.slice(0, -1));
  };

  const clearDraft = () => {
    sfx.click();
    setDraft("");
  };

  const goHome = () => {
    sfx.click();
    setScreen("home");
    setMood("wave");
    setMessage(pick(HELLO_MSGS));
    setDraft("");
    setGuesses([]);
  };

  const attempts = guesses.length;
  const winStars = starsFor(attempts, max);
  const isNewBest =
    screen === "won" &&
    best[difficulty] != null &&
    best[difficulty] === attempts;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-rose-100/55 via-peach/40 to-pink-200/70" />

      {DECO.map((d, i) => (
        <span
          key={i}
          className={cn("pointer-events-none absolute z-10 drop-shadow-sm", d.className)}
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          {d.char}
        </span>
      ))}

      <Confetti show={screen === "won"} />

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute top-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-lg shadow-md ring-2 ring-pink-200 backdrop-blur-sm transition hover:scale-105"
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <main className="relative z-20 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div
          className={cn(
            "game-card w-full max-w-[440px] rounded-[2.2rem] p-5 shadow-[0_18px_0_#f4a4b8,0_28px_50px_rgba(244,120,150,0.28)] ring-4 ring-white/80 sm:p-7",
            shake && "animate-shake",
          )}
        >
          <header className="mb-3 text-center">
            <p className="font-display text-[11px] font-semibold tracking-[0.22em] text-rose-400 uppercase">
              kawaii guessing
            </p>
            <h1 className="font-display text-[1.7rem] leading-tight font-semibold text-cocoa sm:text-3xl">
              Mochi's Secret Number
            </h1>
          </header>

          {screen === "home" && (
            <HomeScreen best={best} onPick={startGame} />
          )}

          {screen === "playing" && (
            <PlayScreen
              mood={mood}
              message={message}
              bubbleKey={bubbleKey}
              max={max}
              difficulty={difficulty}
              bounds={bounds}
              guesses={guesses}
              draft={draft}
              closeness={lastCloseness}
              inputRef={inputRef}
              setDraft={setDraft}
              pressDigit={pressDigit}
              backspace={backspace}
              clearDraft={clearDraft}
              submitGuess={submitGuess}
              goHome={goHome}
            />
          )}

          {screen === "won" && (
            <WinScreen
              secret={secret}
              attempts={attempts}
              stars={winStars}
              isNewBest={isNewBest}
              best={best[difficulty]}
              difficulty={difficulty}
              onAgain={() => startGame(difficulty)}
              onHome={goHome}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function MochiPortrait({ mood, size = "md" }: { mood: Mood; size?: "md" | "lg" }) {
  return (
    <div className="relative mx-auto w-fit">
      <span className="absolute -top-2 -left-1 animate-sparkle text-lg text-amber-400">✦</span>
      <span className="absolute -top-1 -right-2 animate-sparkle text-pink-400" style={{ animationDelay: "0.5s" }}>
        ♡
      </span>
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-[#f6ead8] shadow-inner ring-4 ring-white",
          size === "lg" ? "h-44 w-44 sm:h-52 sm:w-52" : "h-36 w-36 sm:h-40 sm:w-40",
        )}
      >
        <img
          src={MOOD_IMG[mood]}
          alt="Mochi the chibi cat girl"
          className="animate-bob h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

function Speech({ text, k }: { text: string; k: number }) {
  return (
    <div
      key={k}
      className="speech-bubble relative mx-auto mt-4 mb-5 max-w-[92%] rounded-3xl border-2 border-rose-200 bg-white px-4 py-3 text-center shadow-sm"
    >
      <p className="font-display text-[15px] leading-snug font-medium text-cocoa">{text}</p>
    </div>
  );
}

function HomeScreen({
  best,
  onPick,
}: {
  best: BestMap;
  onPick: (d: Difficulty) => void;
}) {
  return (
    <div className="animate-pop">
      <MochiPortrait mood="wave" size="lg" />
      <Speech text="Hehe~ I picked a secret number! Pick a difficulty and come find it!" k={0} />

      <div className="mt-1 flex flex-col gap-3">
        {(Object.keys(DIFFICULTY_META) as Difficulty[]).map((d) => {
          const meta = DIFFICULTY_META[d];
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={cn(
                "squish flex items-center gap-3 rounded-2xl bg-gradient-to-r p-3 text-left shadow-[0_6px_0_#f4a4b8] ring-2 ring-white",
                meta.tint,
              )}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                {meta.emoji}
              </span>
              <span className="flex-1">
                <span className="font-display block text-lg font-semibold text-cocoa">
                  {meta.label}
                </span>
                <span className="text-sm text-mocha">{meta.blurb}</span>
              </span>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-rose-400">
                {best[d] ? `Best ${best[d]}` : "New!"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlayScreen({
  mood,
  message,
  bubbleKey,
  max,
  difficulty,
  bounds,
  guesses,
  draft,
  closeness,
  inputRef,
  setDraft,
  pressDigit,
  backspace,
  clearDraft,
  submitGuess,
  goHome,
}: {
  mood: Mood;
  message: string;
  bubbleKey: number;
  max: number;
  difficulty: Difficulty;
  bounds: { lo: number; hi: number };
  guesses: Guess[];
  draft: string;
  closeness: number | null;
  inputRef: RefObject<HTMLInputElement | null>;
  setDraft: (v: string) => void;
  pressDigit: (d: string) => void;
  backspace: () => void;
  clearDraft: () => void;
  submitGuess: () => void;
  goHome: () => void;
}) {
  const span = bounds.hi - bounds.lo + 1;
  const leftPct = ((bounds.lo - 1) / max) * 100;
  const widthPct = (span / max) * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-mocha">
        <button
          type="button"
          onClick={goHome}
          className="rounded-full bg-white/80 px-3 py-1 text-rose-400 ring-1 ring-rose-200 transition hover:bg-white"
        >
          ← home
        </button>
        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-500">
          {DIFFICULTY_META[difficulty].emoji} 1–{max}
        </span>
        <span className="rounded-full bg-white/80 px-3 py-1">
          tries {guesses.length}
        </span>
      </div>

      <MochiPortrait mood={mood} />
      <Speech text={message} k={bubbleKey} />

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-wide text-mocha uppercase">
          <span>hiding zone</span>
          <span>
            {bounds.lo} – {bounds.hi}
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-rose-100 ring-2 ring-white">
          <div
            className="range-track absolute top-0 h-full rounded-full transition-all duration-500"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          />
        </div>
        <div className="mt-2">
          <HeartMeter closeness={closeness} />
        </div>
      </div>

      {guesses.length > 0 && (
        <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {guesses.map((g) => (
            <span
              key={g.value}
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-bold",
                g.result === "high" && "bg-rose-100 text-rose-500",
                g.result === "low" && "bg-sky-100 text-sky-500",
                g.close && g.result !== "correct" && "ring-2 ring-amber-300",
              )}
            >
              {g.value}
              {g.result === "high" ? " ↑" : " ↓"}
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-center">
        <input
          ref={inputRef}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="??"
          aria-label="Your guess"
          className="font-display h-14 w-40 rounded-2xl bg-white text-center text-3xl font-semibold text-cocoa outline-none ring-4 ring-rose-200 placeholder:text-rose-200 focus:ring-rose-300"
        />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pressDigit(d)}
            className="pad-key font-display h-12 rounded-2xl bg-white text-xl font-semibold text-cocoa shadow-[0_4px_0_#f4c6d2] ring-1 ring-rose-100"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={clearDraft}
          className="pad-key h-12 rounded-2xl bg-lilac/50 font-display text-sm font-bold text-cocoa shadow-[0_4px_0_#c9a3dc] ring-1 ring-purple-100"
        >
          clear
        </button>
        <button
          type="button"
          onClick={() => pressDigit("0")}
          className="pad-key font-display h-12 rounded-2xl bg-white text-xl font-semibold text-cocoa shadow-[0_4px_0_#f4c6d2] ring-1 ring-rose-100"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          className="pad-key h-12 rounded-2xl bg-peach font-display text-lg font-bold text-cocoa shadow-[0_4px_0_#f0b59a] ring-1 ring-orange-100"
        >
          ⌫
        </button>
      </div>

      <button
        type="button"
        onClick={submitGuess}
        className="squish animate-pulse-soft font-display w-full rounded-2xl bg-gradient-to-r from-rose-400 to-pink-400 py-3.5 text-lg font-semibold text-white shadow-[0_8px_0_#f48fb1]"
      >
        Guess! ✨
      </button>
    </div>
  );
}

function WinScreen({
  secret,
  attempts,
  stars,
  isNewBest,
  best,
  difficulty,
  onAgain,
  onHome,
}: {
  secret: number;
  attempts: number;
  stars: number;
  isNewBest: boolean;
  best: number | null;
  difficulty: Difficulty;
  onAgain: () => void;
  onHome: () => void;
}) {
  return (
    <div className="animate-pop text-center">
      <MochiPortrait mood="celebrate" size="lg" />
      <Speech
        text={
          isNewBest
            ? `A new best!! My number was ${secret}!`
            : `You found it!! My number was ${secret}!`
        }
        k={1}
      />

      <div className="mb-4 flex justify-center gap-1 text-2xl">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < stars ? "text-amber-400" : "text-amber-200"}>
            ★
          </span>
        ))}
      </div>

      <p className="font-display text-xl font-semibold text-cocoa">{starTitle(stars)}</p>
      <p className="mt-1 text-sm text-mocha">
        {attempts} {attempts === 1 ? "try" : "tries"} on {DIFFICULTY_META[difficulty].label}
        {best ? ` · best ${best}` : ""}
      </p>

      {isNewBest && (
        <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-600">
          🎉 New personal best!
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onAgain}
          className="squish font-display w-full rounded-2xl bg-gradient-to-r from-rose-400 to-pink-400 py-3.5 text-lg font-semibold text-white shadow-[0_8px_0_#f48fb1]"
        >
          Play again ✨
        </button>
        <button
          type="button"
          onClick={onHome}
          className="squish font-display w-full rounded-2xl bg-white py-3 text-base font-semibold text-cocoa shadow-[0_6px_0_#f4c6d2] ring-2 ring-rose-100"
        >
          Change difficulty
        </button>
      </div>
    </div>
  );
}
