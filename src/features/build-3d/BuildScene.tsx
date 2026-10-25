import { useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  primarySlots,
  selectedPart,
  slotLabel,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { scenePresentation, type ScenePresentation } from "@/lib/v3/scene-presentation";

export type SceneMode = "standard" | "exploded" | "review";
export interface BuildSceneProps {
  document: BuildDocumentV3;
  selectedSlot: SlotId;
  mode: SceneMode;
  explode: number;
  resetKey: number;
  onSelect: (slot: SlotId) => void;
}

type Point = [number, number, number];
const layout: Record<SlotId, { anchor: Point; label: Point; size: Point; offset: Point }> = {
  case: { anchor: [0, 0, 0], label: [-2.85, 1.45, 0], size: [2.35, 3.15, 1.55], offset: [0, 0, 0] },
  motherboard: {
    anchor: [-0.25, 0.1, -0.22],
    label: [-2.85, 0.58, 0],
    size: [1.45, 1.75, 0.12],
    offset: [-0.85, 0, -0.3],
  },
  cpu: {
    anchor: [-0.24, 0.62, -0.07],
    label: [-2.85, -0.27, 0],
    size: [0.42, 0.42, 0.18],
    offset: [-1.45, 0.45, 0],
  },
  cooler: {
    anchor: [-0.25, 0.64, 0.23],
    label: [-2.85, -1.12, 0],
    size: [0.78, 0.78, 0.45],
    offset: [-1.5, 0.85, 0.8],
  },
  gpu: {
    anchor: [0.05, -0.42, 0.35],
    label: [2.85, 1.45, 0],
    size: [1.65, 0.39, 0.48],
    offset: [1.4, 0, 1],
  },
  memory: {
    anchor: [0.58, 0.55, 0.05],
    label: [2.85, 0.58, 0],
    size: [0.2, 1.06, 0.14],
    offset: [1.35, 0.4, 0.1],
  },
  storage: {
    anchor: [0.55, -0.77, 0.1],
    label: [2.85, -0.27, 0],
    size: [0.68, 0.2, 0.17],
    offset: [1.4, -0.6, 0.35],
  },
  psu: {
    anchor: [-0.37, -1.12, 0.05],
    label: [2.85, -1.12, 0],
    size: [0.85, 0.58, 0.88],
    offset: [0.95, -0.75, 0.1],
  },
};

function SlotMesh({
  slot,
  document,
  selected,
  mode,
  explode,
  onSelect,
  presentation,
}: {
  slot: SlotId;
  document: BuildDocumentV3;
  selected: boolean;
  mode: SceneMode;
  explode: number;
  onSelect: (slot: SlotId) => void;
  presentation: ScenePresentation;
}) {
  const spec = layout[slot];
  const occupancy = slotOccupancy(document, slot);
  const isCase = slot === "case";
  const factor = mode === "exploded" ? explode / 100 : 0;
  const position: Point = spec.anchor.map(
    (value, index) => value + spec.offset[index] * factor,
  ) as Point;
  const color = selected
    ? "#b3ed9a"
    : occupancy === "unresolved"
      ? "#d9a468"
      : occupancy === "unselected"
        ? "#708f7b"
        : mode === "review" &&
            document.build.compatibilityWarnings.some((warning) =>
              warning.affectedPartIds.includes(selectedPart(document, slot)?.id ?? ""),
            )
          ? "#d9a468"
          : "#78bb86";
  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(slot);
  }
  return (
    <mesh
      position={position}
      rotation={slot === "gpu" && presentation.gpuVertical ? [0, 0, Math.PI / 2] : [0, 0, 0]}
      onClick={handleClick}
    >
      <boxGeometry
        args={isCase && presentation.layout === "showcase" ? [2.55, 3.05, 1.75] : spec.size}
      />
      <meshStandardMaterial
        color={isCase ? presentation.caseColor : color}
        emissive={selected ? presentation.accentColor : "#000000"}
        emissiveIntensity={selected ? 0.18 : 0}
        transparent
        opacity={isCase ? 0.38 : occupancy === "unselected" ? 0.12 : 0.7}
        wireframe={isCase || occupancy !== "selected"}
        metalness={0.3}
        roughness={0.55}
      />
    </mesh>
  );
}

function SlotCallout({
  slot,
  document,
  selected,
  mode,
  explode,
}: {
  slot: SlotId;
  document: BuildDocumentV3;
  selected: boolean;
  mode: SceneMode;
  explode: number;
}) {
  const spec = layout[slot];
  const factor = mode === "exploded" ? explode / 100 : 0;
  const anchor: Point = spec.anchor.map(
    (value, index) => value + spec.offset[index] * factor,
  ) as Point;
  const occupancy = slotOccupancy(document, slot);
  const color = selected ? "#c4f59f" : occupancy === "unresolved" ? "#edba75" : "#a4c7a5";
  return (
    <Line
      points={[anchor, spec.label]}
      color={color}
      lineWidth={1.5}
      dashed
      dashSize={0.1}
      gapSize={0.07}
    />
  );
}

function ProjectLabels({
  refs,
}: {
  refs: RefObject<Partial<Record<SlotId, HTMLButtonElement | null>>>;
}) {
  useFrame(({ camera, size }) => {
    for (const slot of primarySlots) {
      const element = refs.current?.[slot];
      if (!element) continue;
      const point = new Vector3(...layout[slot].label).project(camera);
      const x = Math.max(78, Math.min(size.width - 78, ((point.x + 1) * size.width) / 2));
      const y = Math.max(25, Math.min(size.height - 25, ((1 - point.y) * size.height) / 2));
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  });
  return null;
}

export default function BuildScene({
  document,
  selectedSlot,
  mode,
  explode,
  resetKey,
  onSelect,
}: BuildSceneProps) {
  const labelRefs = useRef<Partial<Record<SlotId, HTMLButtonElement | null>>>({});
  const presentation = scenePresentation(document);
  return (
    <div
      className="v3-scene-canvas"
      role="region"
      aria-label="Illustrative interactive PC scene. The eight 2D slot buttons below provide keyboard access."
    >
      <Canvas
        key={resetKey}
        camera={{ position: [5.8, 3.5, 7.2], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#10251a"]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 7, 5]} intensity={2} />
        <pointLight position={[-3, 1, 3]} intensity={7} color={presentation.accentColor} />
        <gridHelper args={[10, 10, "#31533a", "#23412d"]} position={[0, -1.7, 0]} />
        {primarySlots.map((slot) => (
          <SlotMesh
            key={slot}
            slot={slot}
            document={document}
            selected={selectedSlot === slot}
            mode={mode}
            explode={explode}
            onSelect={onSelect}
            presentation={presentation}
          />
        ))}
        {Array.from({ length: Math.min(3, presentation.fanAccentCount) }, (_, index) => (
          <mesh key={`fan-accent-${index}`} position={[0.72, 0.95 - index * 0.9, 0.82]}>
            <torusGeometry args={[0.25, 0.025, 8, 32]} />
            <meshBasicMaterial color={presentation.accentColor} transparent opacity={0.75} />
          </mesh>
        ))}
        {primarySlots.map((slot) => (
          <SlotCallout
            key={`${slot}-callout`}
            slot={slot}
            document={document}
            selected={selectedSlot === slot}
            mode={mode}
            explode={explode}
          />
        ))}
        <ProjectLabels refs={labelRefs} />
        <OrbitControls enablePan enableZoom minDistance={5} maxDistance={15} target={[0, 0, 0]} />
      </Canvas>
      <div className="v3-scene-overlay">
        {primarySlots.map((slot) => {
          const part = selectedPart(document, slot);
          const occupancy = slotOccupancy(document, slot);
          return (
            <button
              key={slot}
              ref={(element) => {
                labelRefs.current[slot] = element;
              }}
              type="button"
              data-scene-slot={slot}
              className={`v3-scene-callout ${selectedSlot === slot ? "active" : ""} ${occupancy}`}
              onClick={() => onSelect(slot)}
              aria-label={`${slotLabel[slot]}: ${part?.displayName ?? occupancy}`}
            >
              <strong>{slotLabel[slot]}</strong>
              <small>
                {part?.model ?? (occupancy === "unresolved" ? "Review match" : "Add part")}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
