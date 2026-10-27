import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Environment,
  Lightformer,
  Line,
  MeshReflectorMaterial,
  OrbitControls,
  PerformanceMonitor,
} from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, N8AO, Vignette } from "@react-three/postprocessing";
import type { ThreeEvent } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type Group } from "three";
import {
  primarySlots,
  selectedPart,
  slotLabel,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
} from "@/lib/v3/build-document";
import { scenePresentation, type ScenePresentation } from "@/lib/v3/scene-presentation";
import {
  isDimmed,
  slotLayout as layout,
  slotPosition,
  type Point,
  type SceneMode,
} from "@/lib/v3/scene-focus";
import {
  PHOTO_APPEARANCE_LABEL,
  appearanceHex,
  appearanceSummary,
  colorName,
  PHOTO_FANS_LABEL,
  lightHex,
  photoAppearance,
  photoFans,
  type PhotoFans,
  type SlotAppearance,
} from "@/lib/v3/photo-appearance";
import {
  MM_PER_SCENE_UNIT,
  referenceModelFor,
  sceneSize,
  type ReferenceModel,
} from "@/lib/v3/reference-models";

export type { SceneMode } from "@/lib/v3/scene-focus";
export interface BuildSceneProps {
  document: BuildDocumentV3;
  selectedSlot: SlotId;
  mode: SceneMode;
  explode: number;
  resetKey: number;
  onSelect: (slot: SlotId) => void;
  /** Focus/Isolate: the pulled-out part, or null for the full build. */
  focusSlot?: SlotId | null;
  onFocus?: (slot: SlotId) => void;
  onClearFocus?: () => void;
  /** Rendered next to the focused part (e.g. the replace card). */
  focusCard?: ReactNode;
  /** Label link for a part: a manufacturer page, or a clearly labeled retailer search. */
  partLink?: (slot: SlotId) => { href: string; label: string } | null;
}

const FLOOR_Y = -1.7;

// PBR material presets for the illustrative parts; per-SKU reference models bring their own.
const metal = { color: "#c3c8cf", metalness: 1, roughness: 0.3 };
const darkMetal = { color: "#2a2d32", metalness: 0.75, roughness: 0.36 };
const pcb = { color: "#15201a", metalness: 0.2, roughness: 0.78 };
const plastic = { color: "#18191c", metalness: 0.05, roughness: 0.55 };

/** True inside a slot that is dimmed because another part is focused. */
const DimContext = createContext(false);
/** True in the light quality tier: glass skips the extra transmission render pass. */
const LightTierContext = createContext(false);

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Standard material that fades out when its slot is dimmed. */
function Mat(props: Record<string, unknown> & { opacity?: number; transparent?: boolean }) {
  const dim = useContext(DimContext);
  const opacity = props.opacity ?? 1;
  return (
    <meshStandardMaterial
      // three.js needs a recompile when `transparent` flips, so remount on dim changes.
      key={dim ? "dim" : "lit"}
      {...props}
      transparent={dim || props.transparent}
      opacity={dim ? Math.min(0.1, opacity) : opacity}
      depthWrite={!dim && props.depthWrite !== false}
    />
  );
}

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
      <Mat {...material} />
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
  const dim = useContext(DimContext);
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, radius * 0.07, 12, 48]} />
      <Mat color={color} emissive={color} emissiveIntensity={dim ? 0.3 : 2.4} toneMapped={false} />
    </mesh>
  );
}

function RgbStrip({ size, position, color }: { size: Point; position: Point; color: string }) {
  const dim = useContext(DimContext);
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <Mat color={color} emissive={color} emissiveIntensity={dim ? 0.3 : 2.2} toneMapped={false} />
    </mesh>
  );
}

/** A fan: frame disc, hub and a lit ring facing +x (front intake), +y (bottom intake) or -y. */
function CaseFan({
  position,
  facing,
  radius,
  frameColor,
  light,
}: {
  position: Point;
  facing: "x" | "y" | "-y";
  radius: number;
  frameColor: string;
  light: string;
}) {
  return (
    <group
      position={position}
      rotation={
        facing === "x"
          ? [0, Math.PI / 2, 0]
          : facing === "y"
            ? [-Math.PI / 2, 0, 0]
            : [Math.PI / 2, 0, 0]
      }
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.05, 32]} />
        <Mat color={frameColor} metalness={0.05} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.26, radius * 0.26, 0.02, 20]} />
        <Mat color={frameColor} metalness={0.05} roughness={0.5} />
      </mesh>
      <RgbRing radius={radius * 0.92} position={[0, 0, 0.03]} color={light} />
    </group>
  );
}

function CaseModel({
  size,
  presentation,
  glass = true,
}: {
  size: Point;
  presentation: ScenePresentation;
  /** False when the photo shows a case without a windowed side. */
  glass?: boolean;
}) {
  const dim = useContext(DimContext);
  const light = useContext(LightTierContext);
  const [w, h, d] = size;
  const t = 0.035;
  const white = presentation.caseColor === appearanceHex.white;
  const panel = white
    ? { color: presentation.caseColor, metalness: 0.1, roughness: 0.45 }
    : { color: presentation.caseColor, metalness: 0.55, roughness: 0.42 };
  const fanCount = Math.min(6, Math.max(0, presentation.fanAccentCount));
  const fanFrame = white ? "#dfe3e8" : "#18191c";
  return (
    <group>
      <Box size={[w, t, d]} position={[0, h / 2, 0]} material={panel} />
      <Box size={[w, t, d]} position={[0, -h / 2, 0]} material={panel} />
      <Box size={[w, h, t]} position={[0, 0, -d / 2]} material={panel} />
      <Box size={[t, h, d]} position={[-w / 2, 0, 0]} material={panel} />
      {/* Front panel: mesh look; see-through enough to show lit front fans. */}
      <Box
        size={[t, h, d]}
        position={[w / 2, 0, 0]}
        material={{
          color: white ? "#cfd4da" : "#101113",
          metalness: 0.3,
          roughness: 0.8,
          ...(fanCount > 0 && { transparent: true, opacity: 0.45, depthWrite: false }),
        }}
      />
      {/* PSU shroud. */}
      <Box size={[w - t * 2, 0.04, d - t * 2]} position={[0, -h / 2 + 0.72, 0]} material={panel} />
      {/* Tempered glass side panel, facing the default camera. */}
      {glass ? (
        <mesh position={[0, 0, d / 2]}>
          <boxGeometry args={[w, h, 0.02]} />
          <meshPhysicalMaterial
            key={dim ? "dim" : "lit"}
            color="#d8e2e6"
            metalness={0}
            roughness={0.04}
            transmission={light ? 0 : 1}
            thickness={0.05}
            ior={1.5}
            transparent
            opacity={dim ? 0.04 : 0.22}
            depthWrite={false}
          />
        </mesh>
      ) : (
        <Box size={[w, h, t]} position={[0, 0, d / 2]} material={panel} />
      )}
      <FanSet size={size} count={fanCount} frameColor={fanFrame} light={presentation.accentColor} />
    </group>
  );
}

/**
 * Up to three front intakes, then up to three on the PSU shroud, spaced for a case of `size`
 * (laid out on the 2.35 x 3.15 tower slot and scaled from it).
 */
function FanSet({
  size,
  count,
  frameColor,
  light,
}: {
  size: Point;
  count: number;
  frameColor: string;
  light: string;
}) {
  const [w, h] = size;
  const sx = w / 2.35;
  const sy = h / 3.15;
  return (
    <>
      {Array.from({ length: Math.min(6, Math.max(0, count)) }, (_, index) => (
        <CaseFan
          key={index}
          position={
            index < 3
              ? [w / 2 - 0.09 * sx, h / 2 - (0.62 + index * 0.78) * sy, 0]
              : [-w / 2 + (0.5 + (index - 3) * 0.66) * sx, -h / 2 + 0.81 * sy, 0]
          }
          facing={index < 3 ? "x" : "y"}
          radius={0.3 * Math.min(sx, sy)}
          frameColor={frameColor}
          light={light}
        />
      ))}
    </>
  );
}

// GPU reference models are authored fan-face +x, height +y, bracket +z; the GPU slot lies flat
// with the fans facing down, the top edge towards the glass and the bracket at the rear.
const gpuFrameRotation = new Euler().setFromRotationMatrix(
  new Matrix4().makeBasis(new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0)),
);

/** A per-SKU reference reconstruction, drawn 1:1 from its millimetre parts. */
function ReferenceModelMesh({ model }: { model: ReferenceModel }) {
  const dim = useContext(DimContext);
  const light = useContext(LightTierContext);
  return (
    <group
      rotation={model.frame === "gpu" ? gpuFrameRotation : undefined}
      scale={1 / MM_PER_SCENE_UNIT}
    >
      {model.parts.map((part) => {
        const material = model.materials[part.material];
        const glass = !!material.transmission;
        return (
          <mesh
            key={part.id}
            position={part.positionMm}
            scale={part.sizeMm}
            castShadow={!glass}
            receiveShadow
          >
            {part.shape === "box" ? <boxGeometry /> : <sphereGeometry args={[0.5, 48, 12]} />}
            {glass ? (
              <meshPhysicalMaterial
                key={dim ? "dim" : "lit"}
                color={material.color}
                metalness={0}
                roughness={material.roughness}
                transmission={light ? 0 : material.transmission}
                thickness={0.05}
                ior={1.5}
                transparent
                opacity={dim ? 0.04 : 0.22}
                depthWrite={false}
              />
            ) : (
              <Mat
                color={material.color}
                roughness={material.roughness}
                metalness={material.metalness}
              />
            )}
          </mesh>
        );
      })}
    </group>
  );
}

function PartModel({
  slot,
  size,
  accent,
  color,
  coolerType = null,
}: {
  slot: Exclude<SlotId, "case">;
  size: Point;
  accent: string;
  /** Body colour from the catalog or the photo; the generic dark finish when unknown. */
  color?: string;
  coolerType?: "aio" | "air" | null;
}): ReactNode {
  const [w, h, d] = size;
  const body = (fallback: Record<string, unknown>) =>
    color ? { color, metalness: 0.1, roughness: 0.45 } : fallback;
  const trim = color
    ? { color: color === appearanceHex.white ? "#cdd2d8" : color, metalness: 0.3, roughness: 0.5 }
    : darkMetal;
  switch (slot) {
    case "motherboard":
      return (
        <group>
          <Box size={size} material={body(pcb)} />
          <Box size={[w * 0.5, 0.18, 0.1]} position={[-w * 0.12, h * 0.42, d]} material={trim} />
          <Box size={[0.16, h * 0.42, 0.1]} position={[-w * 0.42, h * 0.12, d]} material={trim} />
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
      if (coolerType === "aio")
        // Pump head on the CPU plus a 360 mm-class radiator under the case top (offsets from the
        // cooler anchor to the generic case roof), with three lit fans below it.
        return (
          <group>
            <Box size={[w * 0.56, h * 0.56, d * 0.42]} material={body(metal)} />
            <RgbRing radius={w * 0.2} position={[0, 0, d * 0.22]} color={accent} />
            <group position={[0.25, 0.8, -0.23]}>
              <Box size={[1.9, 0.12, 0.5]} material={body(metal)} />
              {[-0.62, 0, 0.62].map((x) => (
                <CaseFan
                  key={x}
                  position={[x, -0.1, 0]}
                  facing="-y"
                  radius={0.24}
                  frameColor={color ?? plastic.color}
                  light={accent}
                />
              ))}
            </group>
          </group>
        );
      return (
        <group>
          <Box size={[w * 0.66, h * 0.92, d * 0.62]} material={body(metal)} />
          <mesh position={[0, 0, d * 0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w * 0.4, w * 0.4, 0.05, 32]} />
            <Mat {...body(plastic)} />
          </mesh>
          <RgbRing radius={w * 0.38} position={[0, 0, d * 0.46]} color={accent} />
        </group>
      );
    case "gpu":
      return (
        <group>
          <Box size={[w, h * 0.72, d]} material={body(darkMetal)} />
          <Box
            size={[w, 0.03, d]}
            position={[0, h * 0.38, 0]}
            // Brushed rather than polished: a mirror top caught the interior light as a bloom blob.
            material={{ ...metal, roughness: 0.6 }}
          />
          {[-w * 0.31, 0, w * 0.31].map((x) => (
            <group key={x} position={[x, -h * 0.37, 0]}>
              <mesh>
                <cylinderGeometry args={[d * 0.4, d * 0.4, 0.02, 32]} />
                <Mat {...body(plastic)} />
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
              <Box size={[w * 0.32, h, d]} material={body(darkMetal)} />
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
            <Mat {...darkMetal} />
          </mesh>
        </group>
      );
  }
}

/** Look-alike stand-in for an unresolved part, built only from what the photo shows. */
function AppearancePlaceholder({
  slot,
  size,
  look,
  presentation,
}: {
  slot: SlotId;
  size: Point;
  look: SlotAppearance;
  presentation: ScenePresentation;
}) {
  const color = look.color ? appearanceHex[look.color] : undefined;
  const accent = look.lightColor
    ? (lightHex[look.lightColor] ?? presentation.accentColor)
    : presentation.accentColor;
  if (slot === "case")
    return (
      <CaseModel
        size={size}
        glass={look.glassPanel}
        presentation={{
          ...presentation,
          caseColor: color ?? presentation.caseColor,
          accentColor: accent,
          fanAccentCount: look.fanCount,
        }}
      />
    );
  return (
    <PartModel slot={slot} size={size} accent={accent} color={color} coolerType={look.coolerType} />
  );
}

function SlotMesh({
  slot,
  document,
  selected,
  mode,
  explode,
  focusSlot,
  onPick,
  presentation,
  look,
  fans,
}: {
  slot: SlotId;
  document: BuildDocumentV3;
  selected: boolean;
  mode: SceneMode;
  explode: number;
  focusSlot: SlotId | null;
  onPick: (slot: SlotId) => void;
  presentation: ScenePresentation;
  /** Unresolved slot the photo shows: drawn as a look-alike placeholder (PRD §9.3 level 2). */
  look?: SlotAppearance;
  /** Confirmed case only: fans seen in the photo, until the fan models land (slice D). */
  fans?: PhotoFans | null;
}) {
  const group = useRef<Group>(null);
  const occupancy = slotOccupancy(document, slot);
  const target = slotPosition(slot, mode, explode, focusSlot);
  const dimmed = isDimmed(slot, focusSlot);
  const model =
    occupancy === "selected" ? referenceModelFor(selectedPart(document, slot)?.id) : null;
  const partColor = colorName(selectedPart(document, slot)?.color);
  const size: Point = model
    ? sceneSize(model)
    : slot === "case" && presentation.layout === "showcase"
      ? [2.55, 3.05, 1.75]
      : layout[slot].size;
  // A focused GPU reference model turns its fan side to the viewer; in the case it lies fans-down.
  const rotation: Point =
    slot === "gpu" && model && focusSlot === slot
      ? [-1.87, 0, 0]
      : slot === "gpu" && presentation.gpuVertical
        ? [0, 0, Math.PI / 2]
        : [0, 0, 0];
  const placed = useRef(false);
  // Ease towards the resting pose; snap on the first frame and when the user prefers reduced motion.
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const goal = new Vector3(...target);
    const turn = new Quaternion().setFromEuler(new Euler(...rotation));
    if (!placed.current || prefersReducedMotion()) {
      node.position.copy(goal);
      node.quaternion.copy(turn);
      placed.current = true;
    } else {
      const step = 1 - Math.exp(-delta * 9);
      node.position.lerp(goal, step);
      node.quaternion.slerp(turn, step);
    }
  });
  const flagged =
    mode === "review" &&
    document.build.compatibilityWarnings.some((warning) =>
      warning.affectedPartIds.includes(selectedPart(document, slot)?.id ?? ""),
    );
  // A photo look-alike already reads as a part; its "not confirmed" state is on the label.
  const edgeColor = selected
    ? "#c4f59f"
    : (occupancy === "unresolved" && !look) || flagged
      ? "#edba75"
      : occupancy === "unselected"
        ? "#6d7c74"
        : null;
  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onPick(slot);
  }
  return (
    <DimContext.Provider value={dimmed}>
      <group
        ref={group}
        position={target}
        // A dimmed case would swallow clicks meant for the parts around it.
        onClick={dimmed && slot === "case" ? undefined : handleClick}
      >
        {occupancy === "selected" ? (
          model ? (
            <>
              <ReferenceModelMesh model={model} />
              {/* The reference case has no fans yet (slice D); draw the ones the photo shows. */}
              {slot === "case" && fans && (
                <FanSet
                  size={size}
                  count={fans.count}
                  frameColor={fans.color === "black" ? "#18191c" : "#dfe3e8"}
                  light={
                    fans.lightColor
                      ? (lightHex[fans.lightColor] ?? presentation.accentColor)
                      : presentation.accentColor
                  }
                />
              )}
            </>
          ) : slot === "case" ? (
            <CaseModel size={size} presentation={presentation} />
          ) : (
            <PartModel
              slot={slot}
              size={size}
              accent={presentation.accentColor}
              color={partColor ? appearanceHex[partColor] : undefined}
              coolerType={
                selectedPart(document, slot)?.specs.coolerType === "aio"
                  ? "aio"
                  : selectedPart(document, slot)?.specs.coolerType === "air"
                    ? "air"
                    : null
              }
            />
          )
        ) : look ? (
          <AppearancePlaceholder slot={slot} size={size} look={look} presentation={presentation} />
        ) : (
          // Empty or unresolved slot: a faint placeholder volume, never a fake part.
          <mesh>
            <boxGeometry args={size} />
            <Mat
              color={occupancy === "unresolved" ? "#3a2f22" : "#23272b"}
              transparent
              opacity={slot === "case" ? 0.05 : 0.18}
              depthWrite={false}
            />
          </mesh>
        )}
        {edgeColor && !dimmed && !(slot === "case" && (occupancy === "selected" || look)) && (
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
    </DimContext.Provider>
  );
}

function SlotCallout({
  slot,
  document,
  selected,
  mode,
  explode,
  focusSlot,
}: {
  slot: SlotId;
  document: BuildDocumentV3;
  selected: boolean;
  mode: SceneMode;
  explode: number;
  focusSlot: SlotId | null;
}) {
  const anchor = slotPosition(slot, mode, explode, focusSlot);
  const occupancy = slotOccupancy(document, slot);
  const color = selected ? "#c4f59f" : occupancy === "unresolved" ? "#edba75" : "#8f9a94";
  const dimmed = isDimmed(slot, focusSlot);
  return (
    <Line
      points={[anchor, layout[slot].label]}
      color={color}
      lineWidth={1.2}
      dashed
      dashSize={0.1}
      gapSize={0.07}
      transparent
      opacity={dimmed ? 0.18 : selected ? 1 : 0.7}
    />
  );
}

function ProjectOverlay({
  labelRefs,
  cardRef,
  cardAnchor,
}: {
  labelRefs: RefObject<Partial<Record<SlotId, HTMLElement | null>>>;
  cardRef: RefObject<HTMLDivElement | null>;
  cardAnchor: Point | null;
}) {
  useFrame(({ camera, size }) => {
    for (const slot of primarySlots) {
      const element = labelRefs.current?.[slot];
      if (!element) continue;
      const point = new Vector3(...layout[slot].label).project(camera);
      const x = Math.max(78, Math.min(size.width - 78, ((point.x + 1) * size.width) / 2));
      const y = Math.max(25, Math.min(size.height - 25, ((1 - point.y) * size.height) / 2));
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
    const card = cardRef.current;
    if (card && cardAnchor) {
      const point = new Vector3(...cardAnchor).project(camera);
      const px = ((point.x + 1) * size.width) / 2;
      const py = ((1 - point.y) * size.height) / 2;
      const width = card.offsetWidth || 320;
      const height = card.offsetHeight || 300;
      // Sit beside the part, on whichever side has room, inside the canvas.
      const gap = 130;
      const left = px + gap + width < size.width - 12 ? px + gap : Math.max(12, px - gap - width);
      card.style.left = `${left}px`;
      card.style.top = `${Math.max(12, Math.min(size.height - height - 12, py - height / 2))}px`;
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
      {/* Soft: the glass side panel mirrors it straight back over the interior. */}
      <Lightformer form="ring" intensity={0.5} position={[0, 2, 8]} scale={3} color="#dfe8ff" />
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
  focusSlot = null,
  onFocus,
  onClearFocus,
  focusCard,
  partLink,
}: BuildSceneProps) {
  const labelRefs = useRef<Partial<Record<SlotId, HTMLElement | null>>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const presentation = scenePresentation(document);
  const looks = photoAppearance(document);
  const fans = photoFans(document);
  // A white board right behind the interior fill light blows out; move the light towards the glass.
  const whiteBoard =
    (looks.motherboard?.color ?? colorName(selectedPart(document, "motherboard")?.color)) ===
    "white";
  const pick = (slot: SlotId) => {
    onSelect(slot);
    onFocus?.(slot);
  };
  useEffect(() => {
    if (!focusSlot || !onClearFocus) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClearFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSlot, onClearFocus]);
  const cardAnchor = focusSlot ? slotPosition(focusSlot, mode, explode, focusSlot) : null;
  // Adaptive quality: a device that can't hold ~30 fps drops to the light tier for the session.
  const [quality, setQuality] = useState<"high" | "low">("high");
  const lowerQuality = () => setQuality("low");
  // Bloom only above 1.6: lit white panels stay below it, emissive RGB (2.2+) glows.
  return (
    <div
      className={`v3-scene-canvas ${focusSlot ? "is-focused" : ""}`}
      data-scene-quality={quality}
      role="region"
      aria-label="Illustrative interactive PC scene. The eight 2D slot buttons below provide keyboard access."
    >
      <Canvas
        key={resetKey}
        camera={{ position: [5.8, 3.2, 7.2], fov: 38 }}
        dpr={quality === "high" ? [1, 1.5] : 1}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        shadows
        onPointerMissed={() => onClearFocus?.()}
      >
        <LightTierContext.Provider value={quality === "low"}>
          <PerformanceMonitor
            bounds={() => [30, 55]}
            onDecline={lowerQuality}
            onFallback={lowerQuality}
          />
          <color attach="background" args={["#17191c"]} />
          <fog attach="fog" args={["#17191c", 11, 22]} />
          <StudioEnvironment />
          <ambientLight intensity={0.15} />
          <directionalLight position={[3, 6, 6]} intensity={2.4} castShadow />
          <directionalLight position={[-5, 3, -4]} intensity={1.2} color="#cfd8ff" />
          {/* Interior fill so parts read through the glass, plus a soft accent glow. */}
          <pointLight
            position={[0, 0.3, whiteBoard ? 0.65 : 0.1]}
            intensity={(focusSlot ? 2 : 4) * (whiteBoard ? 0.5 : 1)}
            distance={4.5}
            decay={1.6}
          />
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
              focusSlot={focusSlot}
              onPick={pick}
              presentation={presentation}
              look={looks[slot]}
              fans={slot === "case" ? fans : null}
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
              focusSlot={focusSlot}
            />
          ))}
          <ContactShadows
            frames={quality === "low" ? 1 : Infinity}
            position={[0, FLOOR_Y + 0.005, 0]}
            opacity={0.65}
            scale={9}
            blur={2.6}
            far={3.2}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
            <planeGeometry args={[40, 40]} />
            {quality === "low" ? (
              <meshStandardMaterial color="#151619" metalness={0.5} roughness={0.9} />
            ) : (
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
            )}
          </mesh>
          <ProjectOverlay labelRefs={labelRefs} cardRef={cardRef} cardAnchor={cardAnchor} />
          <OrbitControls
            enablePan
            enableZoom
            minDistance={5}
            maxDistance={15}
            maxPolarAngle={Math.PI / 2 - 0.05}
            target={[0, 0, 0]}
          />
          {quality === "high" ? (
            <EffectComposer multisampling={4}>
              <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={1} halfRes />
              <Bloom mipmapBlur luminanceThreshold={1.6} intensity={0.9} />
              <DepthOfField target={[0, 0, 0.6]} focalLength={0.2} bokehScale={0.7} />
              <Vignette eskil={false} offset={0.25} darkness={0.55} />
            </EffectComposer>
          ) : (
            // Light tier: no SSAO or depth of field, no multisampling; RGB glow and vignette stay.
            <EffectComposer multisampling={0}>
              <Bloom mipmapBlur luminanceThreshold={1.6} intensity={0.9} />
              <Vignette eskil={false} offset={0.25} darkness={0.55} />
            </EffectComposer>
          )}
        </LightTierContext.Provider>
      </Canvas>
      <div className="v3-scene-overlay">
        {primarySlots.map((slot) => {
          const part = selectedPart(document, slot);
          const occupancy = slotOccupancy(document, slot);
          const link = part ? partLink?.(slot) : null;
          const look = looks[slot];
          return (
            <div
              key={slot}
              ref={(element) => {
                labelRefs.current[slot] = element;
              }}
              data-scene-slot={slot}
              data-color={look?.color ?? colorName(part?.color) ?? undefined}
              data-look={look ? "photo" : undefined}
              className={`v3-scene-callout ${selectedSlot === slot ? "active" : ""} ${occupancy} ${look ? "photo-look" : ""} ${isDimmed(slot, focusSlot) ? "dimmed" : ""}`}
            >
              <button
                type="button"
                onClick={() => pick(slot)}
                aria-label={`${slotLabel[slot]}: ${part?.displayName ?? (look ? PHOTO_APPEARANCE_LABEL : occupancy)}`}
                title={look ? appearanceSummary(look) : undefined}
              >
                <strong>{slotLabel[slot]}</strong>
                <small>
                  {part?.model ??
                    (look
                      ? PHOTO_APPEARANCE_LABEL
                      : occupancy === "unresolved"
                        ? "Review match"
                        : "Add part")}
                </small>
              </button>
              {slot === "case" && fans && (
                <span className="v3-photo-fans-note" data-photo-fans={fans.count}>
                  {fans.count} fan{fans.count === 1 ? "" : "s"} · {PHOTO_FANS_LABEL}
                </span>
              )}
              {link && (
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label} ↗
                </a>
              )}
            </div>
          );
        })}
        {focusSlot && (
          <button type="button" className="v3-focus-exit" onClick={() => onClearFocus?.()}>
            Show full build <kbd>Esc</kbd>
          </button>
        )}
        {focusSlot && focusCard && (
          <div ref={cardRef} className="v3-focus-card">
            {focusCard}
          </div>
        )}
      </div>
    </div>
  );
}
