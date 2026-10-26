import { useRef, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Environment,
  Lightformer,
  Line,
  MeshReflectorMaterial,
  OrbitControls,
} from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
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

const FLOOR_Y = -1.7;

// PBR material presets (illustrative; exact per-SKU models arrive with the demo track week 3).
const metal = { color: "#c3c8cf", metalness: 1, roughness: 0.3 };
const darkMetal = { color: "#2a2d32", metalness: 0.75, roughness: 0.36 };
const pcb = { color: "#15201a", metalness: 0.2, roughness: 0.78 };
const plastic = { color: "#18191c", metalness: 0.05, roughness: 0.55 };

function Box({
  size,
  position = [0, 0, 0],
  material,
}: {
  size: Point;
  position?: Point;
  material: Record<string, unknown>;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...material} />
    </mesh>
  );
}

/** Emissive ring that bloom picks up as RGB lighting. */
function RgbRing({
  radius,
  position,
  rotation = [0, 0, 0],
  color,
}: {
  radius: number;
  position: Point;
  rotation?: Point;
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, radius * 0.07, 12, 48]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.4}
        toneMapped={false}
      />
    </mesh>
  );
}

function RgbStrip({ size, position, color }: { size: Point; position: Point; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function CaseModel({ size, presentation }: { size: Point; presentation: ScenePresentation }) {
  const [w, h, d] = size;
  const t = 0.035;
  const panel = { color: presentation.caseColor, metalness: 0.55, roughness: 0.42 };
  const fanCount = Math.min(3, Math.max(0, presentation.fanAccentCount));
  return (
    <group>
      <Box size={[w, t, d]} position={[0, h / 2, 0]} material={panel} />
      <Box size={[w, t, d]} position={[0, -h / 2, 0]} material={panel} />
      <Box size={[w, h, t]} position={[0, 0, -d / 2]} material={panel} />
      <Box size={[t, h, d]} position={[-w / 2, 0, 0]} material={panel} />
      {/* Front panel: dark mesh look. */}
      <Box
        size={[t, h, d]}
        position={[w / 2, 0, 0]}
        material={{ color: "#101113", metalness: 0.3, roughness: 0.8 }}
      />
      {/* PSU shroud. */}
      <Box size={[w - t * 2, 0.04, d - t * 2]} position={[0, -h / 2 + 0.72, 0]} material={panel} />
      {/* Tempered glass side panel, facing the default camera. */}
      <mesh position={[0, 0, d / 2]}>
        <boxGeometry args={[w, h, 0.02]} />
        <meshPhysicalMaterial
          color="#d8e2e6"
          metalness={0}
          roughness={0.04}
          transmission={1}
          thickness={0.05}
          ior={1.5}
          transparent
          opacity={0.22}
        />
      </mesh>
      {Array.from({ length: fanCount }, (_, index) => (
        <group
          key={index}
          position={[w / 2 - 0.09, h / 2 - 0.62 - index * 0.78, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
            <meshStandardMaterial {...plastic} />
          </mesh>
          <RgbRing radius={0.28} position={[0, 0, 0.03]} color={presentation.accentColor} />
        </group>
      ))}
    </group>
  );
}

function PartModel({
  slot,
  size,
  accent,
}: {
  slot: Exclude<SlotId, "case">;
  size: Point;
  accent: string;
}): ReactNode {
  const [w, h, d] = size;
  switch (slot) {
    case "motherboard":
      return (
        <group>
          <Box size={size} material={pcb} />
          <Box
            size={[w * 0.5, 0.18, 0.1]}
            position={[-w * 0.12, h * 0.42, d]}
            material={darkMetal}
          />
          <Box
            size={[0.16, h * 0.42, 0.1]}
            position={[-w * 0.42, h * 0.12, d]}
            material={darkMetal}
          />
          <Box
            size={[w * 0.32, 0.12, 0.06]}
            position={[w * 0.18, -h * 0.28, d * 0.8]}
            material={metal}
          />
        </group>
      );
    case "cpu":
      return <Box size={[w, h, d * 0.35]} material={metal} />;
    case "cooler":
      return (
        <group>
          <Box size={[w * 0.66, h * 0.92, d * 0.62]} material={metal} />
          <mesh position={[0, 0, d * 0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w * 0.4, w * 0.4, 0.05, 32]} />
            <meshStandardMaterial {...plastic} />
          </mesh>
          <RgbRing radius={w * 0.38} position={[0, 0, d * 0.46]} color={accent} />
        </group>
      );
    case "gpu":
      return (
        <group>
          <Box size={[w, h * 0.72, d]} material={darkMetal} />
          <Box size={[w, 0.03, d]} position={[0, h * 0.38, 0]} material={metal} />
          {[-w * 0.31, 0, w * 0.31].map((x) => (
            <group key={x} position={[x, -h * 0.37, 0]}>
              <mesh>
                <cylinderGeometry args={[d * 0.4, d * 0.4, 0.02, 32]} />
                <meshStandardMaterial {...plastic} />
              </mesh>
              <RgbRing
                radius={d * 0.38}
                position={[0, -0.012, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                color={accent}
              />
            </group>
          ))}
          <RgbStrip
            size={[w * 0.7, 0.025, 0.012]}
            position={[0, h * 0.1, d / 2 + 0.006]}
            color={accent}
          />
        </group>
      );
    case "memory":
      return (
        <group>
          {[-w * 0.25, w * 0.25].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <Box size={[w * 0.32, h, d]} material={darkMetal} />
              <RgbStrip
                size={[w * 0.32, 0.05, d]}
                position={[0, h / 2 + 0.025, 0]}
                color={accent}
              />
            </group>
          ))}
        </group>
      );
    case "storage":
      return (
        <group>
          <Box size={[w, h * 0.3, d]} material={pcb} />
          <Box
            size={[w * 0.7, h * 0.18, d * 0.9]}
            position={[w * 0.05, h * 0.22, 0]}
            material={metal}
          />
        </group>
      );
    case "psu":
      return (
        <group>
          <Box size={size} material={{ ...plastic, color: "#121315", metalness: 0.45 }} />
          <mesh position={[0, -h / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[d * 0.18, d * 0.36, 32]} />
            <meshStandardMaterial {...darkMetal} />
          </mesh>
        </group>
      );
  }
}

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
  const factor = mode === "exploded" ? explode / 100 : 0;
  const position: Point = spec.anchor.map(
    (value, index) => value + spec.offset[index] * factor,
  ) as Point;
  const size: Point =
    slot === "case" && presentation.layout === "showcase" ? [2.55, 3.05, 1.75] : spec.size;
  const flagged =
    mode === "review" &&
    document.build.compatibilityWarnings.some((warning) =>
      warning.affectedPartIds.includes(selectedPart(document, slot)?.id ?? ""),
    );
  const edgeColor = selected
    ? "#c4f59f"
    : occupancy === "unresolved" || flagged
      ? "#edba75"
      : occupancy === "unselected"
        ? "#6d7c74"
        : null;
  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(slot);
  }
  return (
    <group
      position={position}
      rotation={slot === "gpu" && presentation.gpuVertical ? [0, 0, Math.PI / 2] : [0, 0, 0]}
      onClick={handleClick}
    >
      {occupancy === "selected" ? (
        slot === "case" ? (
          <CaseModel size={size} presentation={presentation} />
        ) : (
          <PartModel slot={slot} size={size} accent={presentation.accentColor} />
        )
      ) : (
        // Empty or unresolved slot: a faint placeholder volume, never a fake part.
        <mesh>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={occupancy === "unresolved" ? "#3a2f22" : "#23272b"}
            transparent
            opacity={slot === "case" ? 0.05 : 0.18}
            depthWrite={false}
          />
        </mesh>
      )}
      {edgeColor && !(slot === "case" && occupancy === "selected") && (
        <mesh>
          <boxGeometry args={[size[0] * 1.02, size[1] * 1.02, size[2] * 1.02]} />
          <meshBasicMaterial visible={false} />
          <Edges
            color={edgeColor}
            lineWidth={selected && slot !== "case" ? 1.4 : 0.8}
            transparent
            opacity={selected ? 0.75 : 0.45}
          />
        </mesh>
      )}
    </group>
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
  const color = selected ? "#c4f59f" : occupancy === "unresolved" ? "#edba75" : "#8f9a94";
  return (
    <Line
      points={[anchor, spec.label]}
      color={color}
      lineWidth={1.2}
      dashed
      dashSize={0.1}
      gapSize={0.07}
      transparent
      opacity={selected ? 1 : 0.7}
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

/** Studio light rig built from lightformers, so no HDRI file is downloaded at runtime. */
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={1.5}>
      <Lightformer
        form="rect"
        intensity={3}
        position={[0, 6, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[10, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2}
        position={[-6, 2, 2]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 3, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        position={[6, 1, -2]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[6, 3, 1]}
      />
      <Lightformer form="ring" intensity={1.2} position={[0, 2, 8]} scale={3} color="#dfe8ff" />
    </Environment>
  );
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
        camera={{ position: [5.8, 3.2, 7.2], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        shadows
      >
        <color attach="background" args={["#17191c"]} />
        <fog attach="fog" args={["#17191c", 11, 22]} />
        <StudioEnvironment />
        <ambientLight intensity={0.15} />
        <directionalLight position={[3, 6, 6]} intensity={2.4} castShadow />
        <directionalLight position={[-5, 3, -4]} intensity={1.2} color="#cfd8ff" />
        {/* Interior fill so parts read through the glass, plus a soft accent glow. */}
        <pointLight position={[0.2, 0.4, 0.55]} intensity={6} distance={4.5} decay={1.6} />
        <pointLight
          position={[0.6, -0.2, 0.7]}
          intensity={2.5}
          distance={3}
          color={presentation.accentColor}
        />
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
        <ContactShadows
          position={[0, FLOOR_Y + 0.005, 0]}
          opacity={0.65}
          scale={9}
          blur={2.6}
          far={3.2}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
          <planeGeometry args={[40, 40]} />
          <MeshReflectorMaterial
            resolution={512}
            blur={[300, 80]}
            mixBlur={1}
            mixStrength={18}
            mirror={0.35}
            depthScale={1}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.4}
            color="#151619"
            metalness={0.5}
            roughness={0.9}
          />
        </mesh>
        <ProjectLabels refs={labelRefs} />
        <OrbitControls
          enablePan
          enableZoom
          minDistance={5}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={[0, 0, 0]}
        />
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={1} halfRes />
          <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} />
          <DepthOfField target={[0, 0, 0.6]} focalLength={0.2} bokehScale={0.7} />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
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
