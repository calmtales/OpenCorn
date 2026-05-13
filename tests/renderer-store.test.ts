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
    expect(state.nodes.get("wf-test-42")?.childrenIds).toEqual([
      "wf-test-42-scene-1",
    ]);
    expect(state.nodes.get("wf-test-42-scene-1")?.childrenIds).toEqual([
      "wf-test-42-scene-2",
    ]);
    expect(state.nodes.get("wf-test-42-scene-2")?.childrenIds).toEqual([
      "wf-test-42-scene-3",
    ]);
  });

  it("preserves the current node when reloading the same storyboard", () => {
    useStory
      .getState()
      .loadStoryboard(storyboard, "seed text", "wf-test-42-scene-2");
    expect(useStory.getState().currentId).toBe("wf-test-42-scene-2");
  });

  it("records a viewport focus request for newly added branches", () => {
    const store = useStory.getState();
    store.enterCanvas("A branching seed");
    store.beginBranchGeneration("root");

    const branchIds = store.addBranches("root", [
      {
        title: "Route One",
        summary: "The story opens a first alternate route.",
        body: "The story opens a first alternate route.",
        imagePrompt: "Route One",
        imageUrl: "",
        mood: "discovery",
        tone: "divergent",
        label: "route one",
      },
      {
        title: "Route Two",
        summary: "The story opens a second alternate route.",
        body: "The story opens a second alternate route.",
        imagePrompt: "Route Two",
        imageUrl: "",
        mood: "neutral",
        tone: "what-if",
        label: "route two",
      },
    ]);

    const state = useStory.getState();
    expect(branchIds).toHaveLength(2);
    expect(state.branchGeneratingNodeIds).not.toContain("root");
    expect(state.branchFocusRequest).not.toBeNull();
    expect(state.branchFocusRequest?.parentId).toBe("root");
    expect(state.branchFocusRequest?.childIds).toEqual(branchIds);
  });

  it("inserts a canon beat between parent and child and focuses it", () => {
    useStory.getState().loadStoryboard(storyboard, "seed text");

    const createdId = useStory.getState().insertBetween(
      "wf-test-42-scene-1",
      "wf-test-42-scene-2",
      {
        title: "The Warning Echo",
        summary: "A second pulse makes the dive unavoidable.",
        body: "A second pulse makes the dive unavoidable.",
        imagePrompt: "sonar screen with a second impossible pulse",
        mood: "tense",
        tone: "canon",
        label: "insert",
      },
      "canon",
      "human",
      "writer-assist",
    );

    const state = useStory.getState();
    expect(createdId).toStartWith("ins-");
    expect(state.nodes.get("wf-test-42-scene-1")?.childrenIds).toEqual([
      createdId,
    ]);
    expect(state.nodes.get(createdId!)?.childrenIds).toEqual([
      "wf-test-42-scene-2",
    ]);
    expect(state.nodes.get("wf-test-42-scene-2")?.parentId).toBe(createdId);
    expect(state.branchFocusRequest?.parentId).toBe("wf-test-42-scene-1");
    expect(state.branchFocusRequest?.childIds).toEqual([createdId]);
  });
});
