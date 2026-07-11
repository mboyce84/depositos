
export const PILLARS = ["Body", "Faith", "Family", "Business", "Self"] as const;
export type Pillar = (typeof PILLARS)[number];
export type MeasurementType = "check" | "number";

export type DepositDefinition = {
  id: string;
  name: string;
  description: string;
  pillar: Pillar;
  measurementType: MeasurementType;
  unit: string;
  target: number | null;
  scheduleDays: number[];
  position: number;
  active: boolean;
  activeFrom: string;
  archivedAt: string | null;
};

export type DailyEntry = {
  depositId: string;
  entryDate: string;
  completed: boolean;
  value: number | null;
  note: string;
  updatedAt: string;
};

export type Reflection = {
  id: string;
  createdAt: string;
  pressure: string;
  oldLoop: string;
  reward: string;
  cost: string;
  replacement: string;
  friction: string;
  commitment: string;
};

export type WeeklyReview = {
  id: string;
  weekStart: string;
  win: string;
  lesson: string;
  nextDeposit: string;
  updatedAt: string;
};

export const DEFAULT_DEPOSITS: Omit<DepositDefinition, "position" | "active" | "activeFrom" | "archivedAt">[] = [
  { id: "walk", name: "Fasted walk", description: "30 minutes before the noise", pillar: "Body", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "protein", name: "Protein target", description: "Build every meal around it", pillar: "Body", measurementType: "number", unit: "g", target: 190, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "calories", name: "Calories & macros", description: "Fuel the mission with intention", pillar: "Body", measurementType: "number", unit: "kcal", target: 2400, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "water", name: "Water", description: "Steady energy, clearer decisions", pillar: "Body", measurementType: "number", unit: "oz", target: 120, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "workout", name: "Strength session", description: "45 intentional minutes", pillar: "Body", measurementType: "check", unit: "", target: null, scheduleDays: [1,3,5] },
  { id: "blood-pressure", name: "Blood pressure", description: "Know the number, protect the future", pillar: "Body", measurementType: "check", unit: "", target: null, scheduleDays: [1,3,5] },
  { id: "weight", name: "Weight check-in", description: "Observe the trend without judgment", pillar: "Body", measurementType: "number", unit: "lb", target: null, scheduleDays: [1] },
  { id: "alcohol", name: "Alcohol-free", description: "Protect tomorrow morning", pillar: "Self", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "prayer", name: "Prayer", description: "10 quiet minutes", pillar: "Faith", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "family", name: "Family deposit", description: "Be fully present on purpose", pillar: "Family", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "walk2", name: "Post-dinner walk", description: "Invite the family", pillar: "Family", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "writing", name: "Writing block", description: "Ship 500 honest words", pillar: "Business", measurementType: "check", unit: "", target: null, scheduleDays: [1,2,3,4,5] },
  { id: "reflection", name: "Daily reflection", description: "Turn today’s data into wisdom", pillar: "Self", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
  { id: "sleep", name: "Sleep window", description: "In bed by 10:30 PM", pillar: "Self", measurementType: "check", unit: "", target: null, scheduleDays: [0,1,2,3,4,5,6] },
];

