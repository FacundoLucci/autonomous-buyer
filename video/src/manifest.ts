/** All screen media must be genuine captures of the same recorded purchase. */
export const FPS = 30;
export const DURATION_SECONDS = 165;
export const DURATION_FRAMES = DURATION_SECONDS * FPS;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type CaptureName =
  | "overview"
  | "risk"
  | "sources"
  | "rfqs"
  | "followup1"
  | "email"
  | "followup2"
  | "comparison"
  | "approval"
  | "confirmation"
  | "order"
  | "recent"
  | "risk-detail"
  | "approval-detail"
  | "delivery";

export type Shot = {
  capture: CaptureName;
  start: number;
  duration: number;
  note: string;
  focus?: [number, number];
  scale?: [number, number];
  /** Real source pixel camera center and pixel scale, after a context hold. */
  camera?: { x: number; y: number; scale: number; context?: number; travel?: number };
};

export type Scene = {
  id: string;
  title: string;
  chapter: string;
  from: number;
  duration: number;
  caption: string;
  narration: string;
  shots: Shot[];
};

export const scenes: Scene[] = [
  {
    id: "question",
    title: "The $400 decision.",
    chapter: "A PURCHASE WITH A PLOT TWIST",
    from: 0,
    duration: 12,
    caption: "Why choose the more expensive quote?",
    narration:
      "Why would I pay four hundred dollars more for deli lids? This is the cheaper quote. This is the one BUY HARD recommended. The difference matters when you have customers waiting.",
    shots: [
      {
        capture: "comparison",
        start: 0,
        duration: 12,
        note: "The two quotes. One decision.",
        camera: { x: 1287, y: 303, scale: 3.8, context: 1, travel: 3.5 },
      },
    ],
  },
  {
    id: "owner",
    title: "Keep the line moving.",
    chapter: "THE BUSINESS BEHIND THE BUY",
    from: 12,
    duration: 15,
    caption: "Small supplies. A business depending on them.",
    narration:
      "I've run a deli. The food gets your attention. So do the customers. But ordinary things, like having enough containers and lids, have to keep working too.",
    shots: [
      {
        capture: "overview",
        start: 0,
        duration: 15,
        note: "The purchasing desk.",
        scale: [1.035, 1],
      },
    ],
  },
  {
    id: "shortage",
    title: "The clock starts here.",
    chapter: "01 / SPOT THE SHORTAGE",
    from: 27,
    duration: 19,
    caption: "3,240 lids. Average use: 612 a day.",
    narration:
      "Here's a recorded demo purchase. The starting stock was three thousand, two hundred forty lids, with average use of six hundred twelve a day. BUY HARD calculated the shortage and the deadline. Convex keeps the record and screens in sync.",
    shots: [
      {
        capture: "risk",
        start: 0,
        duration: 5,
        note: "The recorded-run guide.",
        camera: { x: 1365, y: 180, scale: 1.3, context: 0.5, travel: 2 },
      },
      {
        capture: "risk-detail",
        start: 5,
        duration: 14,
        note: "Original inventory and required date.",
        camera: { x: 1395, y: 692, scale: 1.65, context: 1, travel: 3 },
      },
    ],
  },
  {
    id: "sources",
    title: "Find the options.",
    chapter: "FROM SOURCE TO INBOX",
    from: 46,
    duration: 20,
    caption: "Real supplier research. Controlled demo replies.",
    narration:
      "Firecrawl found real supplier pages. OpenAI helped assess the evidence and draft requests for quotes. AgentMail sent the emails. For this demonstration, supplier replies came through controlled test inboxes.",
    shots: [
      {
        capture: "sources",
        start: 0,
        duration: 10,
        note: "Supplier pages and cited sources.",
        camera: { x: 1368, y: 390, scale: 1.2 },
      },
      {
        capture: "rfqs",
        start: 10,
        duration: 10,
        note: "Requests for quotes, delivered.",
        camera: { x: 1380, y: 425, scale: 1.2 },
      },
    ],
  },
  {
    id: "followups",
    title: "An incomplete answer.",
    chapter: "02 / CHASE THE MISSING DETAILS",
    from: 66,
    duration: 26,
    caption: "Missing terms → clarification → revision 3.",
    narration:
      "One quote was incomplete. Freight and arrival were missing. Here is the clarification the agent actually sent. The next reply still left information unresolved, so it followed up again. By revision three, the requested terms were present. You can inspect that whole exchange in the app.",
    shots: [
      {
        capture: "followup1",
        start: 0,
        duration: 8,
        note: "First clarification: missing terms.",
        camera: { x: 1394, y: 370, scale: 1.4, context: 0.8, travel: 2.5 },
      },
      {
        capture: "email",
        start: 8,
        duration: 9,
        note: "The actual sent email.",
        camera: { x: 1394, y: 495, scale: 1.85, context: 3.3, travel: 2.5 },
      },
      {
        capture: "followup2",
        start: 17,
        duration: 9,
        note: "Second clarification. Complete revision 3.",
        camera: { x: 1394, y: 350, scale: 1.35, context: 0.8, travel: 2.5 },
      },
    ],
  },
  {
    id: "answer",
    title: "Now the $400 makes sense.",
    chapter: "THE TRADE-OFF, REVEALED",
    from: 92,
    duration: 23,
    caption: "The cheaper option: six projected days without stock.",
    narration:
      "Now the cheaper quote makes sense. It arrives after the deadline: six projected days without stock. SupplyCo costs four hundred dollars more, but arrives in time. Stored purchase rules make that comparison. The trade-off is visible.",
    shots: [
      {
        capture: "comparison",
        start: 0,
        duration: 23,
        note: "Price only tells part of the story.",
        camera: { x: 1394, y: 440, scale: 1.55, context: 2, travel: 4 },
      },
    ],
  },
  {
    id: "approval",
    title: "The buyer keeps control.",
    chapter: "A HUMAN DECISION",
    from: 115,
    duration: 19,
    caption: "Approval stays attached to the exact purchase terms.",
    narration:
      "Then it's my decision. This is the approval I recorded against the exact purchase terms. From here, I can inspect the purchase order and the quote revision behind it.",
    shots: [
      {
        capture: "approval",
        start: 0,
        duration: 5,
        note: "The recorded buyer approval.",
        camera: { x: 1390, y: 330, scale: 1.3, context: 0.5, travel: 2 },
      },
      {
        capture: "approval-detail",
        start: 5,
        duration: 5,
        note: "Facundo approved these exact terms.",
        camera: { x: 1390, y: 350, scale: 1.25, context: 0, travel: 1.5 },
      },
      {
        capture: "order",
        start: 10,
        duration: 9,
        note: "The purchase order and approved revision.",
        camera: { x: 1390, y: 405, scale: 1.45 },
      },
    ],
  },
  {
    id: "confirmation",
    title: "Close the loop.",
    chapter: "03 / CONFIRM THE OUTCOME",
    from: 134,
    duration: 19,
    caption: "15,000 incoming units. Supplier terms match.",
    narration:
      "AgentMail delivered the order once. OpenAI extracted the supplier's confirmation. The terms matched, and fifteen thousand incoming units were confirmed. The evidence stays attached to the purchase.",
    shots: [
      {
        capture: "delivery",
        start: 0,
        duration: 4,
        note: "The provider receipt: delivered once.",
        camera: { x: 1390, y: 142, scale: 1.5, context: 0.5, travel: 1.8 },
      },
      {
        capture: "confirmation",
        start: 4,
        duration: 9,
        note: "Supplier confirmed. Terms match.",
        camera: { x: 1390, y: 330, scale: 1.35, context: 1.5, travel: 3 },
      },
      {
        capture: "order",
        start: 13,
        duration: 6,
        note: "The purchase order. Evidence retained.",
        camera: { x: 1390, y: 405, scale: 1.3, context: 0.5, travel: 2 },
      },
    ],
  },
  {
    id: "closing",
    title: "Keep the line moving.",
    chapter: "BUY HARD",
    from: 153,
    duration: 12,
    caption: "Less chasing. More time for the business.",
    narration:
      "That's why I built BUY HARD. Less time chasing a purchase. More attention for the business in front of you. Keep the line moving.",
    shots: [
      {
        capture: "recent",
        start: 0,
        duration: 12,
        note: "The confirmed purchase, on the record.",
        scale: [1, 1.025],
      },
    ],
  },
];

export type MotionClip = {
  src: string;
  trimBefore?: number;
  playbackRate?: number;
  durationInFrames?: number;
};
export type VoiceClip = {
  sceneId: string;
  src: string;
  trimBefore?: number;
  durationInFrames?: number;
};
export type FilmProps = {
  cues: boolean;
  judgeUrl: string;
  motion: Partial<Record<CaptureName, MotionClip>>;
  voiceover?: string;
  voiceClips: VoiceClip[];
  deliClip?: MotionClip;
};

export const defaultProps: FilmProps = {
  cues: false,
  judgeUrl: "festive-coyote-483.convex.site/?demo=true",
  motion: {},
  voiceClips: [],
};
