/** Soft illustrated scheduler character — Stitch-inspired, local SVG (no CDN dependency). */
export function SchedulerIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 460"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Friendly scheduler character with a calendar board"
    >
      <defs>
        <linearGradient id="blob" x1="40" y1="40" x2="380" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D7E6F8" />
          <stop offset="1" stopColor="#F0D9D4" />
        </linearGradient>
        <linearGradient id="skin" x1="180" y1="70" x2="250" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F6D3B5" />
          <stop offset="1" stopColor="#E8B992" />
        </linearGradient>
      </defs>

      {/* Soft atmosphere blob */}
      <ellipse cx="210" cy="240" rx="175" ry="190" fill="url(#blob)" opacity="0.9" />

      {/* Calendar board */}
      <g className="animate-neu-float-delayed origin-center" style={{ transformBox: "fill-box" }}>
        <rect x="230" y="120" width="150" height="180" rx="18" fill="#F8FBFF" stroke="#C5D4E6" strokeWidth="3" />
        <rect x="230" y="120" width="150" height="36" rx="18" fill="#1E2F4D" />
        <circle cx="255" cy="138" r="5" fill="#FF6B6B" />
        <circle cx="275" cy="138" r="5" fill="#FBBF24" />
        <circle cx="295" cy="138" r="5" fill="#34D399" />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={248 + col * 30}
              y={172 + row * 28}
              width="22"
              height="18"
              rx="4"
              fill={row === 1 && col === 2 ? "#FF6B6B" : "#E8EEF5"}
            />
          ))
        )}
      </g>

      {/* Character body */}
      <g className="animate-neu-float origin-center" style={{ transformBox: "fill-box" }}>
        {/* Torso */}
        <path
          d="M120 250c0-28 28-48 70-48s70 20 70 48v90c0 18-16 32-40 32h-60c-24 0-40-14-40-32v-90z"
          fill="#3B82F6"
        />
        <path d="M140 250h100v20c0 10-12 18-30 18h-40c-18 0-30-8-30-18v-20z" fill="#1E40AF" opacity="0.35" />

        {/* Arm holding board */}
        <path d="M250 270c28 8 48 30 55 55" stroke="#E8B992" strokeWidth="18" strokeLinecap="round" />

        {/* Head */}
        <circle cx="190" cy="160" r="48" fill="url(#skin)" />
        {/* Hair */}
        <path
          d="M145 150c8-42 40-58 70-52 18 4 34 20 38 42-18-8-34-6-48 2-16 8-34 12-60 8z"
          fill="#1E2F4D"
        />
        {/* Face */}
        <circle cx="174" cy="158" r="4" fill="#1E2F4D" />
        <circle cx="206" cy="158" r="4" fill="#1E2F4D" />
        <path d="M178 178c8 10 24 10 32 0" stroke="#C47A5A" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Cheeks */}
        <circle cx="162" cy="170" r="6" fill="#F5A89A" opacity="0.55" />
        <circle cx="218" cy="170" r="6" fill="#F5A89A" opacity="0.55" />

        {/* Clipboard in other hand */}
        <rect x="95" y="280" width="48" height="60" rx="8" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="3" />
        <rect x="103" y="292" width="32" height="4" rx="2" fill="#FDBA74" />
        <rect x="103" y="304" width="28" height="4" rx="2" fill="#FED7AA" />
        <rect x="103" y="316" width="30" height="4" rx="2" fill="#FED7AA" />
      </g>

      {/* Soft ground shadow */}
      <ellipse cx="210" cy="420" rx="110" ry="16" fill="#C4D0DF" opacity="0.55" />
    </svg>
  );
}
