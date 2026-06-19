export type DemoEntrySeed = {
  caption: string;
  timestamp: string;
  imageSource: number;
  filename: string;
  isMilestone?: number;
};

export type DemoQuestSeed = {
  title: string;
  emoji: string;
  startedAt: string;
  entries: DemoEntrySeed[];
} & ({ status: "active"; completedAt?: null } | { status: "archived"; completedAt: string });

export const WRITER_DEMO_QUEST: DemoQuestSeed = {
  title: "Writer",
  emoji: "✍️",
  status: "active",
  startedAt: "2026-01-08T18:20:00.000Z",
  completedAt: null,
  entries: [
    {
      caption: "Brainstorming story ideas and chasing the one that keeps tugging at me.",
      timestamp: "2026-01-08T18:20:00.000Z",
      imageSource: require("../../assets/demo/demo-01.png"),
      filename: "demo-writer-01.png",
      isMilestone: 1,
    },
    {
      caption: "Character notes are starting to feel like real people with messy wants.",
      timestamp: "2026-01-22T20:10:00.000Z",
      imageSource: require("../../assets/demo/demo-02.png"),
      filename: "demo-writer-02.png",
    },
    {
      caption: "Main character backstory unlocked a better emotional engine for the book.",
      timestamp: "2026-02-06T19:35:00.000Z",
      imageSource: require("../../assets/demo/demo-03.png"),
      filename: "demo-writer-03.png",
    },
    {
      caption: "Plot outline is taped together enough to start moving.",
      timestamp: "2026-02-24T17:55:00.000Z",
      imageSource: require("../../assets/demo/demo-04.png"),
      filename: "demo-writer-04.png",
    },
    {
      caption: "Chapter 1 draft exists. It is rough, but it is real.",
      timestamp: "2026-03-07T21:05:00.000Z",
      imageSource: require("../../assets/demo/demo-05.png"),
      filename: "demo-writer-05.png",
    },
    {
      caption: "Writing session at a coffee shop got me through a tricky scene.",
      timestamp: "2026-03-23T16:30:00.000Z",
      imageSource: require("../../assets/demo/demo-06.png"),
      filename: "demo-writer-06.png",
    },
    {
      caption: "Chapter 3 progress. The middle is starting to have a pulse.",
      timestamp: "2026-04-04T18:45:00.000Z",
      imageSource: require("../../assets/demo/demo-07.png"),
      filename: "demo-writer-07.png",
    },
    {
      caption: "Chapter 5 progress after a stubborn week. Still showing up.",
      timestamp: "2026-04-18T22:15:00.000Z",
      imageSource: require("../../assets/demo/demo-08.png"),
      filename: "demo-writer-08.png",
    },
    {
      caption: "Editing manuscript pages with a less precious heart today.",
      timestamp: "2026-05-02T19:10:00.000Z",
      imageSource: require("../../assets/demo/demo-09.png"),
      filename: "demo-writer-09.png",
    },
    {
      caption: "Feedback from beta readers gave me exactly the clarity I needed.",
      timestamp: "2026-05-14T20:25:00.000Z",
      imageSource: require("../../assets/demo/demo-10.png"),
      filename: "demo-writer-10.png",
    },
    {
      caption: "Revision notes are turning the draft into something sturdier.",
      timestamp: "2026-05-25T18:00:00.000Z",
      imageSource: require("../../assets/demo/demo-11.png"),
      filename: "demo-writer-11.png",
    },
    {
      caption: "Final manuscript draft exported. Tiny confetti moment.",
      timestamp: "2026-06-04T21:40:00.000Z",
      imageSource: require("../../assets/demo/demo-12.png"),
      filename: "demo-writer-12.png",
    },
    {
      caption: "Query letter draft is sharp enough to send soon.",
      timestamp: "2026-06-12T17:30:00.000Z",
      imageSource: require("../../assets/demo/demo-13.png"),
      filename: "demo-writer-13.png",
    },
    {
      caption: "Manuscript submitted. Proud of every messy page that got me here.",
      timestamp: "2026-06-18T18:50:00.000Z",
      imageSource: require("../../assets/demo/demo-14.png"),
      filename: "demo-writer-14.png",
      isMilestone: 1,
    },
  ],
};

export const POET_DEMO_QUEST: DemoQuestSeed = {
  title: "Poet",
  emoji: "📝",
  status: "archived",
  startedAt: "2026-01-12T19:00:00.000Z",
  completedAt: "2026-06-08T20:00:00.000Z",
  entries: [
    {
      caption: "Collected old poems from notebooks, notes apps, and forgotten drafts.",
      timestamp: "2026-01-12T19:00:00.000Z",
      imageSource: require("../../assets/demo/demo-15.png"),
      filename: "demo-poet-01.png",
      isMilestone: 1,
    },
    {
      caption: "Chose the collection theme: becoming, leaving, returning.",
      timestamp: "2026-01-28T20:15:00.000Z",
      imageSource: require("../../assets/demo/demo-16.png"),
      filename: "demo-poet-02.png",
    },
    {
      caption: "Organized poems into sections that finally make emotional sense.",
      timestamp: "2026-02-11T18:30:00.000Z",
      imageSource: require("../../assets/demo/demo-17.png"),
      filename: "demo-poet-03.png",
    },
    {
      caption: "Edited the first batch and cut the lines that were only pretending.",
      timestamp: "2026-03-03T21:20:00.000Z",
      imageSource: require("../../assets/demo/demo-18.png"),
      filename: "demo-poet-04.png",
    },
    {
      caption: "Designed a title page that feels quiet and brave.",
      timestamp: "2026-04-09T17:40:00.000Z",
      imageSource: require("../../assets/demo/demo-19.png"),
      filename: "demo-poet-05.png",
    },
    {
      caption: "Final proofreading pass. Found three tiny typos and one better ending.",
      timestamp: "2026-05-21T19:25:00.000Z",
      imageSource: require("../../assets/demo/demo-20.png"),
      filename: "demo-poet-06.png",
    },
    {
      caption: "Completed poetry collection. This one gets to live outside my notebook.",
      timestamp: "2026-06-08T18:10:00.000Z",
      imageSource: require("../../assets/demo/demo-21.png"),
      filename: "demo-poet-07.png",
      isMilestone: 1,
    },
  ],
};
