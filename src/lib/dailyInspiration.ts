export type DailyInspirationCategory =
  | "motivation"
  | "encouragement"
  | "celebration"
  | "gentle-reminders"
  | "quotes"
  | "affirmations"
  | "wisdom";

export type DailyInspiration = {
  category: DailyInspirationCategory;
  dateKey: string;
  message: string;
};

type DailyInspirationLibrary = Record<DailyInspirationCategory, string[]>;

const CATEGORY_ROTATION: DailyInspirationCategory[] = [
  "motivation",
  "encouragement",
  "celebration",
  "gentle-reminders",
  "quotes",
  "affirmations",
  "wisdom",
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const GENERAL_DAILY_INSPIRATION: DailyInspirationLibrary = {
  motivation: [
    "Progress beats perfection.",
    "Tiny steps become incredible stories.",
    "Stick to the plan, not your mood.",
    "Trust the process you're building.",
    "Consistency is quieter than motivation, but it lasts longer.",
    "One photo. One step. One day closer.",
    "Small steps still move the story forward.",
    "The next right step is enough for today.",
    "Momentum begins with one honest try.",
    "Keep choosing the path that still feels true.",
    "You are allowed to build slowly and still build well.",
    "A little progress is still a promise kept.",
    "Start where your feet are. That counts.",
    "The work grows when you return to it.",
    "Let today be simple and real.",
  ],
  encouragement: [
    "Be someone who still tries.",
    "Your future self will remember today.",
    "Every step counts, especially the ones nobody sees.",
    "Keep collecting proof that you're becoming who you said you'd be.",
    "You're closer than yesterday.",
    "You don't need to be perfect today. You only need to keep going.",
    "You are building something your future self will thank you for.",
    "Every journey is made from ordinary days like this one.",
    "You can begin again without starting over.",
    "The quiet effort matters too.",
    "Your pace is allowed to be human.",
    "There is still room for this to become beautiful.",
    "You have made it through unsure days before.",
    "Keep going gently. It still counts.",
    "You are not behind. You are becoming.",
  ],
  celebration: [
    "Showing up is a victory worth celebrating.",
    "Progress deserves to be remembered.",
    "The work you do in private becomes the confidence you carry in public.",
    "Look at you keeping a promise to yourself.",
    "Even the smallest win deserves a place in the story.",
    "Today can be proof that you stayed with it.",
    "A step taken with care is worth honoring.",
    "You made room for the person you are becoming.",
    "Let this ordinary effort feel a little golden.",
    "Every saved step is a quiet celebration.",
    "You showed up, and that is not nothing.",
    "Some victories look like simply returning.",
    "This part of the journey deserves credit too.",
    "You are gathering evidence of your own follow-through.",
    "Let today's effort be enough to be proud of.",
  ],
  "gentle-reminders": [
    "You can move slowly and still arrive.",
    "Rest is allowed to be part of the rhythm.",
    "A gentle step is still a step.",
    "You do not have to earn your own kindness.",
    "The day does not need to be perfect to be meaningful.",
    "Let the next step be smaller if it needs to be.",
    "Your worth is not measured by one day's output.",
    "Make it lighter before you make it bigger.",
    "You can care deeply without rushing.",
    "Some days ask for patience, not pressure.",
    "Let enough be enough for this moment.",
    "You are allowed to be proud before everything is finished.",
    "Keep the promise small enough to keep.",
    "A pause can still belong to the journey.",
    "Begin again with tenderness.",
  ],
  quotes: [
    "What you water has a way of growing.",
    "The path is made by returning.",
    "Quiet courage is still courage.",
    "Little by little is how most things become.",
    "A steady heart can carry a long dream.",
    "The seed does not rush the season.",
    "Practice turns hope into something you can hold.",
    "The ordinary days are where devotion lives.",
    "What is cared for can change.",
    "Small brave things become a life.",
    "The story changes when you keep showing up.",
    "Patience is also a form of trust.",
    "The work remembers every return.",
    "A beginning can be soft and still be strong.",
    "Attention is how dreams become real.",
  ],
  affirmations: [
    "I can keep going without being hard on myself.",
    "I am allowed to grow at a steady pace.",
    "I can honor small progress.",
    "I am building trust with myself, one step at a time.",
    "I can return to what matters.",
    "I do not need perfect conditions to begin.",
    "I can be proud of effort that no one else sees.",
    "I am becoming more capable through practice.",
    "I can choose one meaningful step today.",
    "I am allowed to be both learning and worthy.",
    "I can make progress with care.",
    "I trust the quiet work I am doing.",
    "I can celebrate the process, not only the finish line.",
    "I am making a life that feels more like mine.",
    "I can keep this promise gently.",
  ],
  wisdom: [
    "Progress gets easier to trust when you save the evidence.",
    "A life changes through repeated ordinary choices.",
    "The version of you who begins is already brave.",
    "You learn the path by walking it.",
    "Confidence often arrives after the proof, not before it.",
    "A small habit can become a place to return to.",
    "The middle of the journey is where character gets made.",
    "Noticing progress helps you protect it.",
    "What feels small today may become the reason you kept going.",
    "You can build something lasting without making it heavy.",
    "The best plans leave room for being human.",
    "Practice is how belief becomes familiar.",
    "The work becomes less scary when it becomes known.",
    "What you repeat with care begins to shape you.",
    "The journey is allowed to be both messy and meaningful.",
  ],
};

export function getDailyInspiration(date = new Date()): DailyInspiration {
  return getDailyInspirationFromLibrary(GENERAL_DAILY_INSPIRATION, date);
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMillisecondsUntilNextLocalDay(date = new Date()): number {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  return Math.max(1000, nextDay.getTime() - date.getTime() + 250);
}

function getDailyInspirationFromLibrary(
  library: DailyInspirationLibrary,
  date: Date
): DailyInspiration {
  const dateKey = getLocalDateKey(date);
  const dayIndex = getLocalDayIndex(date);
  const category = CATEGORY_ROTATION[dayIndex % CATEGORY_ROTATION.length];
  const messages = library[category];
  const messageIndex = hashDateKey(dateKey, category) % messages.length;

  return {
    category,
    dateKey,
    message: messages[messageIndex],
  };
}

function getLocalDayIndex(date: Date): number {
  const localCalendarDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  return Math.floor(localCalendarDay / DAY_IN_MS);
}

function hashDateKey(dateKey: string, category: DailyInspirationCategory): number {
  const value = `${dateKey}:${category}`;
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
