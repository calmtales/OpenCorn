/*  ──────────────────────────────────────────────────────────────────────
 *  ReactFlow branching canvas — Noustiny-style tactical narrative map
 *  Ported for OpenCorn (inline CSS, no Tailwind, no framer-motion)
 *  ────────────────────────────────────────────────────────────────────── */

import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import {
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStory, selectCanonPath } from "../lib/store";
import { useShallow } from "zustand/react/shallow";
import type { StoryNode } from "../lib/types";
import { nodeTypes } from "./StoryNode";
import { edgeTypes } from "./StoryEdge";
import { nodeHeight, variantOf } from "../lib/layout";
import { BulkActionPanel } from "./BulkActionPanel";

function toReactFlow(
  nodes: Map<string, StoryNode>,
  canonSet: Set<string>,
): { rfNodes: Node[]; rfEdges: Edge[] } {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];
  nodes.forEach((n) => {
    const h = nodeHeight(n);
    rfNodes.push({
      id: n.id,
      type: "story",
      position: { x: n.x, y: n.y - h / 2 },
      data: { node: n },
      draggable: false,
      connectable: false,
      selectable: true,
    });
    if (n.parentId) {
      const parent = nodes.get(n.parentId);
      const canon = canonSet.has(n.id) && canonSet.has(n.parentId);
      const explored =
        !canon &&
        (parent?.status === "visited" || parent?.status === "canon" || parent?.status === "current") &&
        (n.status === "visited" || n.status === "canon" || n.status === "current");
      rfEdges.push({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId,
        target: n.id,
        type: "story",
        data: { canon, explored },
        className: canon ? "canon" : explored ? "explored" : "unvisited",
      });
    }
  });
  return { rfNodes, rfEdges };
}

const styles = {
  crosshairBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(10,13,18,0.85)",
    color: "rgba(138,150,170,0.8)",
    borderRadius: 2,
    cursor: "pointer",
    fontSize: 10,
  } as React.CSSProperties,
  minimapHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    padding: "6px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(10,13,18,0.92)",
  },
  minimapLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.34em",
    color: "#4fc3f7",
  },
};

// Canvas-level keyframe animation injection + dot grid background
if (typeof document !== "undefined" && !document.getElementById("canvas-animations")) {
  const style = document.createElement("style");
  style.id = "canvas-animations";
  style.textContent = `
    /* Eliminate any ReactFlow internal background gap (the "black strip") */
    .react-flow { background: transparent !important; }
    .react-flow__renderer { background: transparent !important; }
    .react-flow__pane { cursor: grab; }
    .react-flow__pane:active { cursor: grabbing; }
    /* Smooth minimap transitions */
    .react-flow__minimap { transition: opacity 0.2s ease; }
    /* Ensure edge animations are smooth */
    .react-flow__edge { transition: stroke 0.16s ease, stroke-width 0.16s ease; }

    /* Tactical dot grid background */
    .opencorn-canvas-wrap {
      background-image:
        radial-gradient(circle, rgba(79,195,247,0.07) 1px, transparent 1px);
      background-size: 28px 28px;
      background-position: 0 0;
    }
  `;
  document.head.appendChild(style);
}

function InnerCanvas() {
  const nodes = useStory((s) => s.nodes);
  const currentId = useStory((s) => s.currentId);
  // useShallow ensures we only re-render when the canon path *contents* change,
  // not on every store mutation (selectCanonPath returns a new array every time).
  const canonPathArr = useStory(useShallow(selectCanonPath));
  const setSelected = useStory((s) => s.setSelected);
  const setCurrent = useStory((s) => s.setCurrent);
  const { setCenter, fitView, getNodes } = useReactFlow();
  const hasFitRef = useRef(false);
  const lastCenteredIdRef = useRef<string | null>(null);
  const selectedNodeIdsRef = useRef<string[]>([]);

  const canonSet = useMemo(() => new Set(canonPathArr), [canonPathArr]);

  // Memoize toReactFlow — keep node object references stable so ReactFlow's
  // controlled-mode reconciliation doesn't see false-positive prop changes.
  const { rfNodes, rfEdges } = useMemo(
    () => toReactFlow(nodes, canonSet),
    [nodes, canonSet],
  );

  // Initial fitView — center on current beat exactly once.
  useEffect(() => {
    if (hasFitRef.current) return;
    if (rfNodes.length === 0) return;
    const t = setTimeout(() => {
      const s = useStory.getState();
      const cur = s.nodes.get(s.currentId);
      if (cur) {
        const isCheckpoint = variantOf(cur) === "checkpoint";
        const anchorX = cur.x + (isCheckpoint ? 156 : 136);
        setCenter(anchorX, cur.y, { zoom: 0.9, duration: 600 });
        lastCenteredIdRef.current = cur.id;
      } else {
        fitView({ padding: 0.14, duration: 600, maxZoom: 0.95, minZoom: 0.25 });
      }
      hasFitRef.current = true;
    }, 120);
    return () => clearTimeout(t);
  }, [rfNodes.length, fitView, setCenter]);

  // Pan to current on navigation, but only when the canonical node changes.
  useEffect(() => {
    if (!hasFitRef.current) return;
    if (lastCenteredIdRef.current === currentId) return;
    const cur = useStory.getState().nodes.get(currentId);
    if (!cur) return;
    const isCheckpoint = variantOf(cur) === "checkpoint";
    const anchorX = cur.x + (isCheckpoint ? 156 : 136);
    lastCenteredIdRef.current = currentId;
    setCenter(anchorX, cur.y, { zoom: 0.8, duration: 650 });
  }, [currentId, setCenter]);

  const onPaneClick = useCallback(() => setSelected(null), [setSelected]);
  const onNodeClick = useCallback(
    (_e: unknown, rfNode: Node) => setCurrent(rfNode.id),
    [setCurrent],
  );

  // Track multi-selection for bulk actions
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const onSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      selectedNodeIdsRef.current = selNodes.map((n) => n.id);
      setSelectedNodeIds(selNodes.map((n) => n.id));
    },
    [],
  );

  return (
    <>
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onPaneClick={onPaneClick}
      onNodeClick={onNodeClick}
      onSelectionChange={onSelectionChange}
      proOptions={{ hideAttribution: true }}
      minZoom={0.15}
      maxZoom={2}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      selectionOnDrag
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      multiSelectionKeyCode="Shift"
      fitView={false}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      {/* MiniMap */}
      <Panel position="top-right" style={{ marginTop: 72 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "rgba(10,13,18,0.96)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={styles.minimapHeader}>
            <button
              type="button"
              onClick={() => {
                const cur = nodes.get(currentId);
                if (!cur) return;
                const isCheckpoint = variantOf(cur) === "checkpoint";
                const anchorX = cur.x + (isCheckpoint ? 156 : 136);
                setCenter(anchorX, cur.y, { zoom: 1.0, duration: 600 });
              }}
              style={styles.crosshairBtn}
              title="Center on current beat"
            >
              ⊕
            </button>
            <span style={styles.minimapLabel}>mini map</span>
          </div>
          <MiniMap
            pannable
            zoomable
            maskColor="rgba(10,13,18,0.82)"
            ariaLabel={null}
            nodeColor={(n) => {
              const node = (n.data as { node: StoryNode }).node;
              if (node.status === "current") return "#e9c16b";
              if (node.status === "canon") return "#4fc3f7";
              if (node.status === "visited") return "#64748b";
              if (node.status === "generating") return "#4fc3f7";
              return "#2a3140";
            }}
            nodeStrokeWidth={0}
            style={{ position: "relative", margin: 0 }}
          />
        </div>
      </Panel>
    </ReactFlow>
    {selectedNodeIds.length > 1 && (
      <BulkActionPanel
        selectedIds={selectedNodeIds}
        onClearSelection={() => setSelectedNodeIds([])}
      />
    )}
    </>
  );
}

export function Canvas() {
  return <div className="opencorn-canvas-wrap" style={{ width: "100%", height: "100%" }}><InnerCanvas /></div>;
}

export { ReactFlowProvider };
