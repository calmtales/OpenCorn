import { describe, expect, it, beforeEach } from "bun:test";
import { useStory } from "../src/renderer/lib/store";
import type { Storyboard } from "../src/shared/types";

describe("renderer story store", () => {
  const storyboard: Storyboard = {
    id: "wf-test-42",
    title: "A Strange Signal",
    idea: "A lonely scientist hears a signal from beneath the ocean.",
    style: "anime",
    createdAt: "2026-05-04T00:00:00Z",
    totalDuration: 21,
    scenes: [
      {
        id: "wf-test-42-scene-1",
        title: "The Disturbance",
        description: "A sonar dish catches an impossible pulse.",
        duration: 7,
        keyframes: [],
        order: 0,
      },
      {
        id: "wf-test-42-scene-2",
        title: "The Dive",
        description: "The scientist descends toward the source.",
        duration: 7,
        keyframes: [],
        order: 1,
      },
      {
        id: "wf-test-42-scene-3",
        title: "The Answer",
        description: "A luminous machine answers back.",
        duration: 7,
        keyframes: [],
        order: 2,
      },
    ],
  };

  beforeEach(() => {
    useStory.getState().resetToLanding();
  });

  it("loads storyboard scenes into a linear canvas tree", () => {
    useStory.getState().loadStoryboard(storyboard, "seed text");
    const state = useStory.getState();

    expect(state.mode).toBe("canvas");
    expect(state.rootId).toBe("wf-test-42");
    expect(state.currentId).toBe("wf-test-42-scene-3");
    expect(state.nodes.size).toBe(4);
    expect(state.nodes.get("wf-test-42")?.childrenIds).toEqual(["wf-test-42-scene-1"]);
    expect(state.nodes.get("wf-test-42-scene-1")?.childrenIds).toEqual(["wf-test-42-scene-2"]);
    expect(state.nodes.get("wf-test-42-scene-2")?.childrenIds).toEqual(["wf-test-42-scene-3"]);
  });

  it("preserves the current node when reloading the same storyboard", () => {
    useStory.getState().loadStoryboard(storyboard, "seed text", "wf-test-42-scene-2");
    expect(useStory.getState().currentId).toBe("wf-test-42-scene-2");
  });
});
