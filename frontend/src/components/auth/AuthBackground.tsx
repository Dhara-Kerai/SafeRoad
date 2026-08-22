import { useEffect, useRef } from 'react';

interface Pothole {
  id: number;
  xRatio: number; // -0.4 to 0.4 relative to center (0.0 = center lane)
  z: number; // 0 (horizon) to 1 (foreground)
  widthRatio: number;
  heightRatio: number;
  polygonOffsets: Array<{ x: number; y: number }>;
  isDetected: boolean; // Only ONE pothole has the AI detection bounding box
}

const CarSilhouette = () => (
  <svg
    viewBox="0 0 400 200"
    xmlns="http://www.w3.org/2000/svg"
    className="auth-car-svg"
    aria-hidden="true"
  >
    <defs>
      {/* Metallic Body Shell Gradient */}
      <linearGradient id="authBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="25%" stopColor="#1e293b" />
        <stop offset="60%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#060911" />
      </linearGradient>

      {/* Glass Cabin & Windshield Gradient */}
      <linearGradient id="authGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" stopOpacity="0.95" />
        <stop offset="60%" stopColor="#0f172a" stopOpacity="0.98" />
        <stop offset="100%" stopColor="#050810" />
      </linearGradient>

      {/* Roofline Sky Reflection Highlight */}
      <linearGradient id="authRoofHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
        <stop offset="30%" stopColor="#93c5fd" stopOpacity="0.5" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="70%" stopColor="#93c5fd" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
      </linearGradient>

      {/* Muscular Shoulder Contour Highlight */}
      <linearGradient id="authShoulderHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#64748b" stopOpacity="0.1" />
        <stop offset="20%" stopColor="#94a3b8" stopOpacity="0.7" />
        <stop offset="50%" stopColor="#cbd5e1" stopOpacity="0.9" />
        <stop offset="80%" stopColor="#94a3b8" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#64748b" stopOpacity="0.1" />
      </linearGradient>

      {/* Tail Light Bloom Glow */}
      <filter id="authTailGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* Asphalt Ground Contact Shadow */}
    <ellipse cx="200" cy="188" rx="185" ry="10" fill="#000000" fillOpacity="0.75" />

    {/* Tires & Wheels */}
    {/* Left Wide Performance Tire */}
    <rect x="22" y="142" width="48" height="42" rx="9" fill="#05080e" stroke="#1e293b" strokeWidth="2" />
    <rect x="30" y="150" width="12" height="28" rx="4" fill="#0f172a" />

    {/* Right Wide Performance Tire */}
    <rect x="330" y="142" width="48" height="42" rx="9" fill="#05080e" stroke="#1e293b" strokeWidth="2" />
    <rect x="358" y="150" width="12" height="28" rx="4" fill="#0f172a" />

    {/* Main Aerodynamic Body Shell */}
    <path
      d="
        M 28,148 
        C 24,118 42,94 82,88 
        C 114,44 154,28 200,28 
        C 246,28 286,44 318,88 
        C 358,94 376,118 372,148 
        C 368,168 348,178 322,178 
        L 78,178 
        C 52,178 32,168 28,148 Z"
      fill="url(#authBodyGrad)"
      stroke="#334155"
      strokeWidth="2"
    />

    {/* Roofline Highlight Arc */}
    <path d="M 120,44 C 158,30 242,30 280,44" fill="none" stroke="url(#authRoofHighlight)" strokeWidth="2.5" />

    {/* Curved Rear Glass Windshield */}
    <path
      d="
        M 90,90 
        C 116,48 152,36 200,36 
        C 248,36 284,48 310,90 
        C 260,86 140,86 90,90 Z"
      fill="url(#authGlassGrad)"
      stroke="#475569"
      strokeWidth="1.5"
    />

    {/* Interior Rear Headrests Silhouette in Glass */}
    <path d="M 148,82 C 148,72 166,72 166,82 Z" fill="#0f172a" />
    <path d="M 234,82 C 234,72 252,72 252,82 Z" fill="#0f172a" />

    {/* Shoulder Character / Beltline Contour Line */}
    <path d="M 38,116 C 115,108 285,108 362,116" fill="none" stroke="url(#authShoulderHighlight)" strokeWidth="2" />

    {/* Aerodynamic Side Mirrors */}
    {/* Left Mirror */}
    <path d="M 66,93 C 38,88 34,100 60,106 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
    <line x1="42" y1="96" x2="56" y2="99" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.8" />

    {/* Right Mirror */}
    <path d="M 334,93 C 362,88 366,100 340,106 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
    <line x1="358" y1="96" x2="344" y2="99" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.8" />

    {/* Full-Width Continuous Slim Modern LED Tail Light Strip */}
    <path d="M 44,120 C 110,116 290,116 356,120 L 354,126 C 290,122 110,122 46,126 Z" fill="#dc2626" filter="url(#authTailGlow)" />
    <path d="M 48,122 C 115,118 285,118 352,122" fill="none" stroke="#fca5a5" strokeWidth="2" />

    {/* High-Mount Center LED Stop Lamp */}
    <rect x="175" y="42" width="50" height="4" rx="2" fill="#ef4444" filter="url(#authTailGlow)" />

    {/* License Plate Recess Area */}
    <rect x="155" y="146" width="90" height="18" rx="4" fill="#05080e" stroke="#1e293b" strokeWidth="1" />
    <rect x="165" y="150" width="70" height="10" rx="2" fill="#e2e8f0" />
    <rect x="175" y="153" width="50" height="4" rx="1" fill="#475569" fillOpacity="0.5" />

    {/* Rear Bumper Diffuser Fins & Lower Accents */}
    <rect x="88" y="166" width="34" height="6" rx="2" fill="#030712" stroke="#1e293b" strokeWidth="1" />
    <rect x="278" y="166" width="34" height="6" rx="2" fill="#030712" stroke="#1e293b" strokeWidth="1" />
    <rect x="180" y="172" width="40" height="4" rx="1.5" fill="#030712" />
  </svg>
);

export const AuthBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const carRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Animation state
    let speed = 0.0026;
    let distanceTraveled = 0;
    let scanLinePhase = 0;

    // Primary Pothole #1 is positioned directly in the car's central driving path (xRatio = 0.0)
    const potholes: Pothole[] = [
      {
        id: 1,
        xRatio: 0.0, // Directly in center driving path of the car
        z: 0.22,
        widthRatio: 0.13,
        heightRatio: 0.055,
        isDetected: true, // Only ONE AI detection overlay
        polygonOffsets: [
          { x: -0.48, y: -0.38 },
          { x: -0.12, y: -0.52 },
          { x: 0.38, y: -0.42 },
          { x: 0.52, y: -0.08 },
          { x: 0.44, y: 0.42 },
          { x: 0.08, y: 0.52 },
          { x: -0.4, y: 0.44 },
          { x: -0.52, y: 0.08 },
        ],
      },
      {
        id: 2,
        xRatio: -0.24, // Secondary background pothole on shoulder lane (no AI box)
        z: 0.72,
        widthRatio: 0.10,
        heightRatio: 0.04,
        isDetected: false,
        polygonOffsets: [
          { x: -0.42, y: -0.32 },
          { x: 0.08, y: -0.48 },
          { x: 0.46, y: -0.28 },
          { x: 0.36, y: 0.38 },
          { x: -0.18, y: 0.48 },
          { x: -0.48, y: 0.18 },
        ],
      },
    ];

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      speed = 0;
    }

    const render = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      distanceTraveled += speed;
      scanLinePhase = (scanLinePhase + 0.026) % (Math.PI * 2);

      // Clear canvas with deep night charcoal atmosphere
      ctx.fillStyle = '#080d16';
      ctx.fillRect(0, 0, width, height);

      // Grounded Vanishing Point sitting ~28% from the top of viewport (25-30% range)
      const vanishingX = width * 0.5;
      const vanishingY = height * 0.28;

      // 1. SKY & HORIZON ATMOSPHERE
      const skyGradient = ctx.createLinearGradient(0, 0, 0, vanishingY + 45);
      skyGradient.addColorStop(0, '#05080f');
      skyGradient.addColorStop(0.6, '#0c121e');
      skyGradient.addColorStop(1, '#151d2d');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, vanishingY + 45);

      // Horizon Ambient Illumination Glow
      const horizonGlow = ctx.createLinearGradient(0, vanishingY - 20, 0, vanishingY + 35);
      horizonGlow.addColorStop(0, 'rgba(56, 189, 248, 0)');
      horizonGlow.addColorStop(0.5, 'rgba(251, 191, 36, 0.18)');
      horizonGlow.addColorStop(1, 'rgba(56, 189, 248, 0.08)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, vanishingY - 20, width, 55);

      // Distant Horizon Mountain / Skyline Outline
      ctx.beginPath();
      ctx.moveTo(0, vanishingY + 10);
      ctx.lineTo(width * 0.18, vanishingY - 8);
      ctx.lineTo(width * 0.36, vanishingY + 6);
      ctx.lineTo(width * 0.52, vanishingY - 5);
      ctx.lineTo(width * 0.72, vanishingY + 10);
      ctx.lineTo(width * 0.88, vanishingY - 3);
      ctx.lineTo(width, vanishingY + 8);
      ctx.lineTo(width, vanishingY + 45);
      ctx.lineTo(0, vanishingY + 45);
      ctx.closePath();
      ctx.fillStyle = '#090e17';
      ctx.fill();

      // 2. ROAD GEOMETRY & ILLUMINATED ASPHALT (Reduced spread for realistic perspective)
      const roadTopWidth = Math.max(width * 0.06, 36);
      const roadBottomWidth = Math.min(Math.max(width * 0.75, 480), 880);

      const roadLeftTop = vanishingX - roadTopWidth * 0.5;
      const roadRightTop = vanishingX + roadTopWidth * 0.5;
      const roadLeftBottom = vanishingX - roadBottomWidth * 0.5;
      const roadRightBottom = vanishingX + roadBottomWidth * 0.5;

      // Road Surface Base
      const roadGradient = ctx.createLinearGradient(0, vanishingY, 0, height);
      roadGradient.addColorStop(0, '#131a27');
      roadGradient.addColorStop(0.45, '#1e283b');
      roadGradient.addColorStop(1, '#111723');

      ctx.beginPath();
      ctx.moveTo(roadLeftTop, vanishingY);
      ctx.lineTo(roadRightTop, vanishingY);
      ctx.lineTo(roadRightBottom, height);
      ctx.lineTo(roadLeftBottom, height);
      ctx.closePath();
      ctx.fillStyle = roadGradient;
      ctx.fill();

      // Roadside Shoulder / Grass
      const shoulderLeftGradient = ctx.createLinearGradient(0, 0, roadLeftBottom, 0);
      shoulderLeftGradient.addColorStop(0, '#060910');
      shoulderLeftGradient.addColorStop(1, '#0e1420');
      ctx.beginPath();
      ctx.moveTo(0, vanishingY);
      ctx.lineTo(roadLeftTop, vanishingY);
      ctx.lineTo(roadLeftBottom, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = shoulderLeftGradient;
      ctx.fill();

      const shoulderRightGradient = ctx.createLinearGradient(roadRightBottom, 0, width, 0);
      shoulderRightGradient.addColorStop(0, '#0e1420');
      shoulderRightGradient.addColorStop(1, '#060910');
      ctx.beginPath();
      ctx.moveTo(roadRightTop, vanishingY);
      ctx.lineTo(width, vanishingY);
      ctx.lineTo(width, height);
      ctx.lineTo(roadRightBottom, height);
      ctx.closePath();
      ctx.fillStyle = shoulderRightGradient;
      ctx.fill();

      // Reflective Curb Lines (Solid White)
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(roadLeftTop, vanishingY);
      ctx.lineTo(roadLeftBottom, height);
      ctx.moveTo(roadRightTop, vanishingY);
      ctx.lineTo(roadRightBottom, height);
      ctx.stroke();

      // 3. PERSPECTIVE DASHED LANE MARKINGS & STREETLIGHTS
      const numDashSegments = 12;
      ctx.fillStyle = '#fbbf24'; // Vivid Safety Amber Center Lines

      for (let i = 0; i < numDashSegments; i++) {
        const zPos = (i / numDashSegments + distanceTraveled) % 1;
        const pz = Math.pow(zPos, 2.1);
        const nextPz = Math.pow((zPos + 0.04) % 1, 2.1);

        if (pz > nextPz) continue;

        const currentY = vanishingY + pz * (height - vanishingY);
        const nextY = vanishingY + nextPz * (height - vanishingY);
        const currentRoadW = roadTopWidth + pz * (roadBottomWidth - roadTopWidth);
        const nextRoadW = roadTopWidth + nextPz * (roadBottomWidth - roadTopWidth);

        const lineWidth = Math.max(1.8, pz * 6);

        // Center Double Dashed Lines
        const offsetLeftCur = vanishingX - currentRoadW * 0.015;
        const offsetLeftNext = vanishingX - nextRoadW * 0.015;
        ctx.beginPath();
        ctx.moveTo(offsetLeftCur - lineWidth * 0.5, currentY);
        ctx.lineTo(offsetLeftCur + lineWidth * 0.5, currentY);
        ctx.lineTo(offsetLeftNext + lineWidth * 0.5, nextY);
        ctx.lineTo(offsetLeftNext - lineWidth * 0.5, nextY);
        ctx.closePath();
        ctx.fill();

        const offsetRightCur = vanishingX + currentRoadW * 0.015;
        const offsetRightNext = vanishingX + nextRoadW * 0.015;
        ctx.beginPath();
        ctx.moveTo(offsetRightCur - lineWidth * 0.5, currentY);
        ctx.lineTo(offsetRightCur + lineWidth * 0.5, currentY);
        ctx.lineTo(offsetRightNext + lineWidth * 0.5, nextY);
        ctx.lineTo(offsetRightNext - lineWidth * 0.5, nextY);
        ctx.closePath();
        ctx.fill();
      }

      // Streetlight Poles (Left & Right)
      const numPoles = 5;
      for (let i = 0; i < numPoles; i++) {
        const poleZ = (i / numPoles + distanceTraveled * 0.6) % 1;
        const pz = Math.pow(poleZ, 2);
        const poleY = vanishingY + pz * (height - vanishingY);
        const roadW = roadTopWidth + pz * (roadBottomWidth - roadTopWidth);
        const scale = pz * 1.25;

        if (scale > 0.08) {
          const leftPoleX = vanishingX - roadW * 0.56;
          const leftGlow = ctx.createRadialGradient(leftPoleX, poleY - 35 * scale, 0, leftPoleX, poleY - 35 * scale, 35 * scale);
          leftGlow.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
          leftGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = leftGlow;
          ctx.beginPath();
          ctx.arc(leftPoleX, poleY - 35 * scale, 35 * scale, 0, Math.PI * 2);
          ctx.fill();

          const rightPoleX = vanishingX + roadW * 0.56;
          const rightGlow = ctx.createRadialGradient(rightPoleX, poleY - 35 * scale, 0, rightPoleX, poleY - 35 * scale, 35 * scale);
          rightGlow.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
          rightGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = rightGlow;
          ctx.beginPath();
          ctx.arc(rightPoleX, poleY - 35 * scale, 35 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. POTHOLES & SINGLE AI DETECTION OVERLAY
      let primaryPotholeZ = 0;

      potholes.forEach((pothole) => {
        pothole.z = (pothole.z + speed * 1.05) % 1;
        const pz = Math.pow(pothole.z, 2.1);

        if (pothole.isDetected) {
          primaryPotholeZ = pz;
        }

        if (pz < 0.08 || pz > 0.95) return;

        const py = vanishingY + pz * (height - vanishingY);
        const pRoadW = roadTopWidth + pz * (roadBottomWidth - roadTopWidth);
        const px = vanishingX + pothole.xRatio * pRoadW;

        const pw = Math.max(34, width * pothole.widthRatio * pz * 1.5);
        const ph = Math.max(14, height * pothole.heightRatio * pz * 1.5);

        // Realistic Damaged Asphalt Pothole Polygon
        ctx.save();
        ctx.translate(px, py);

        // Dark Pit Surface
        ctx.fillStyle = '#05080f';
        ctx.beginPath();
        pothole.polygonOffsets.forEach((pt, idx) => {
          const vx = pt.x * pw;
          const vy = pt.y * ph;
          if (idx === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        });
        ctx.closePath();
        ctx.fill();

        // Inner Depth Crack Lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-pw * 0.25, -ph * 0.1);
        ctx.lineTo(pw * 0.25, ph * 0.12);
        ctx.lineTo(pw * 0.42, -ph * 0.15);
        ctx.stroke();

        // Damaged Asphalt Edge Highlight
        const isIlluminated = pz > 0.28 && pz < 0.85;
        const edgeOpacity = isIlluminated ? 0.8 : 0.35;
        ctx.strokeStyle = `rgba(251, 191, 36, ${edgeOpacity})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.restore();

        // 5. SINGLE SUBTLE COMPUTER-VISION AI DETECTION (Only on Pothole #1 as car approaches)
        if (pothole.isDetected && pz > 0.22 && pz < 0.84) {
          const boxPadding = Math.max(8, 14 * pz);
          const boxX = px - pw * 0.5 - boxPadding;
          const boxY = py - ph * 0.5 - boxPadding;
          const boxW = pw + boxPadding * 2;
          const boxH = ph + boxPadding * 2;

          const colorMain = '#fbbf24';
          const bracketLen = Math.min(14, boxW * 0.24);

          // Subtle Amber Bounding Box Corners
          ctx.strokeStyle = colorMain;
          ctx.lineWidth = 1.6;

          // Top-Left
          ctx.beginPath();
          ctx.moveTo(boxX, boxY + bracketLen);
          ctx.lineTo(boxX, boxY);
          ctx.lineTo(boxX + bracketLen, boxY);
          ctx.stroke();

          // Top-Right
          ctx.beginPath();
          ctx.moveTo(boxX + boxW - bracketLen, boxY);
          ctx.lineTo(boxX + boxW, boxY);
          ctx.lineTo(boxX + boxW, boxY + bracketLen);
          ctx.stroke();

          // Bottom-Left
          ctx.beginPath();
          ctx.moveTo(boxX, boxY + boxH - bracketLen);
          ctx.lineTo(boxX, boxY + boxH);
          ctx.lineTo(boxX + bracketLen, boxY + boxH);
          ctx.stroke();

          // Bottom-Right
          ctx.beginPath();
          ctx.moveTo(boxX + boxW - bracketLen, boxY + boxH);
          ctx.lineTo(boxX + boxW, boxY + boxH);
          ctx.lineTo(boxX + boxW, boxY + boxH - bracketLen);
          ctx.stroke();

          // Subtle Inner Fill
          ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
          ctx.fillRect(boxX, boxY, boxW, boxH);

          // Animated Laser Scan Line
          const scanY = boxY + ((Math.sin(scanLinePhase * 2) + 1) * 0.5) * boxH;
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(boxX - 2, scanY);
          ctx.lineTo(boxX + boxW + 2, scanY);
          ctx.stroke();

          // Single Clean Label Tag: [AI DETECTED] POTHOLE
          if (pz > 0.28) {
            const fontSize = 11;
            ctx.font = `700 ${fontSize}px Inter, sans-serif`;
            const tagText = '[AI DETECTED] POTHOLE';
            const textWidth = ctx.measureText(tagText).width;

            const badgePadding = 5;
            const badgeX = boxX;
            const badgeY = boxY - (fontSize + badgePadding * 2 + 5);
            const badgeW = textWidth + badgePadding * 2 + 12;
            const badgeH = fontSize + badgePadding * 2;

            ctx.fillStyle = 'rgba(10, 15, 26, 0.92)';
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
            ctx.fill();
            ctx.stroke();

            // Status Indicator Dot
            ctx.fillStyle = colorMain;
            ctx.beginPath();
            ctx.arc(badgeX + badgePadding + 4, badgeY + badgeH * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(tagText, badgeX + badgePadding + 12, badgeY + badgePadding + fontSize * 0.85);
          }
        }
      });

      // 6. CAR POSITION COMPUTATION & SUSPENSION REACTION PHYSICS
      const carBottomOffset = Math.max(12, Math.min(height * 0.025, 32));
      const carWidth = Math.max(200, Math.min(width * 0.26, 400));
      const carHeight = carWidth * 0.5;
      const carBaseY = height - carBottomOffset;
      const carX = vanishingX;

      let suspensionDipY = 0;
      let suspensionPitchAngle = 0;

      if (primaryPotholeZ > 0.65 && primaryPotholeZ < 0.86) {
        const reactionProgress = (primaryPotholeZ - 0.65) / 0.21;
        suspensionDipY = Math.sin(reactionProgress * Math.PI) * 7.0;
        suspensionPitchAngle = Math.sin(reactionProgress * Math.PI * 2) * 0.018;
      } else {
        suspensionDipY = Math.cos(scanLinePhase * 1.2) * 1.2;
        suspensionPitchAngle = Math.sin(scanLinePhase * 0.6) * 0.002;
      }

      const currentCarY = carBaseY + suspensionDipY;

      // Update the Car DOM Element transform directly for smooth 60fps hardware-accelerated animation
      if (carRef.current) {
        carRef.current.style.transform = `translate3d(-50%, ${suspensionDipY.toFixed(2)}px, 0) rotate(${suspensionPitchAngle.toFixed(4)}rad)`;
      }

      // 7. REALISTIC DUAL HEADLIGHT BEAMS (Natural road illumination, bounded along road path)
      const headlightLeftX = carX - carWidth * 0.32;
      const headlightRightX = carX + carWidth * 0.32;
      const headlightY = currentCarY - carHeight * 0.35;

      // Beam target reaches forward onto road (stopping naturally before horizon, NOT top of screen!)
      const beamTargetY = currentCarY - (currentCarY - vanishingY) * 0.45;
      const beamSpreadTopLeft = vanishingX - (roadTopWidth + (roadBottomWidth - roadTopWidth) * 0.35) * 0.4;
      const beamSpreadTopRight = vanishingX + (roadTopWidth + (roadBottomWidth - roadTopWidth) * 0.35) * 0.4;

      // Left Headlight Illumination Cone
      const beamGradientLeft = ctx.createRadialGradient(
        headlightLeftX,
        headlightY,
        4,
        headlightLeftX - carWidth * 0.15,
        beamTargetY,
        carHeight * 2.2
      );
      beamGradientLeft.addColorStop(0, 'rgba(255, 255, 245, 0.42)');
      beamGradientLeft.addColorStop(0.3, 'rgba(254, 243, 199, 0.18)');
      beamGradientLeft.addColorStop(0.7, 'rgba(251, 191, 36, 0.05)');
      beamGradientLeft.addColorStop(1, 'rgba(251, 191, 36, 0)');

      ctx.beginPath();
      ctx.moveTo(headlightLeftX, headlightY);
      ctx.lineTo(beamSpreadTopLeft, beamTargetY);
      ctx.lineTo(vanishingX - roadTopWidth * 0.1, beamTargetY);
      ctx.closePath();
      ctx.fillStyle = beamGradientLeft;
      ctx.fill();

      // Right Headlight Illumination Cone
      const beamGradientRight = ctx.createRadialGradient(
        headlightRightX,
        headlightY,
        4,
        headlightRightX + carWidth * 0.15,
        beamTargetY,
        carHeight * 2.2
      );
      beamGradientRight.addColorStop(0, 'rgba(255, 255, 245, 0.42)');
      beamGradientRight.addColorStop(0.3, 'rgba(254, 243, 199, 0.18)');
      beamGradientRight.addColorStop(0.7, 'rgba(251, 191, 36, 0.05)');
      beamGradientRight.addColorStop(1, 'rgba(251, 191, 36, 0)');

      ctx.beginPath();
      ctx.moveTo(headlightRightX, headlightY);
      ctx.lineTo(vanishingX + roadTopWidth * 0.1, beamTargetY);
      ctx.lineTo(beamSpreadTopRight, beamTargetY);
      ctx.closePath();
      ctx.fillStyle = beamGradientRight;
      ctx.fill();

      // Road Surface Illumination Pool (Grounded on asphalt in front of car)
      const roadPoolY = currentCarY - (currentCarY - vanishingY) * 0.22;
      const roadPoolGrad = ctx.createRadialGradient(
        vanishingX,
        roadPoolY,
        6,
        vanishingX,
        roadPoolY,
        carWidth * 0.85
      );
      roadPoolGrad.addColorStop(0, 'rgba(254, 243, 199, 0.13)');
      roadPoolGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.04)');
      roadPoolGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.beginPath();
      ctx.ellipse(vanishingX, roadPoolY, carWidth * 0.8, (currentCarY - vanishingY) * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = roadPoolGrad;
      ctx.fill();

      // 8. SUBTLE ATMOSPHERIC VIGNETTE
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.42,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.82
      );
      vignette.addColorStop(0, 'rgba(8, 13, 22, 0)');
      vignette.addColorStop(0.7, 'rgba(8, 13, 22, 0.28)');
      vignette.addColorStop(1, 'rgba(4, 7, 12, 0.58)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="auth-background">
      <canvas ref={canvasRef} className="auth-background__canvas" />
      <div className="auth-vehicle-layer">
        <div ref={carRef} className="auth-vehicle">
          <CarSilhouette />
        </div>
      </div>
    </div>
  );
};
