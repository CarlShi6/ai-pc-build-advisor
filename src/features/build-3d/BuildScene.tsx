import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { ThreeEvent } from "@react-three/fiber";
import {
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type Group,
  type InstancedMesh,
  type MeshPhysicalMaterial,
} from "three";
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
  referenceModelSlots,
  sceneCentre,
  sceneSize,
  type ReferenceAxis,
  type ReferenceMaterial,
  type ReferenceModelPart,
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
  /** Hide the case's glass side panel to look straight in. */
  sidePanelRemoved?: boolean;
}

const FLOOR_Y = -1.7;

// PBR material presets for the illustrative parts; per-SKU reference models bring their own.
const metal = { color: "#c3c8cf", metalness: 1, roughness: 0.3 };
const darkMetal = { color: "#2a2d32", metalness: 0.75, roughness: 0.36 };
const pcb = { color: "#15201a", metalness: 0.2, roughness: 0.78 };
const plastic = { color: "#18191c", metalness: 0.05, roughness: 0.55 };

/**
 * Brightest surface colour: pure white panels clip under the studio lights and hide the parts in
 * front of them, so near-white surfaces render as a slightly grey white (#E6E6E6 at most).
 */
const SURFACE_WHITE = 0xe6;

function surfaceColor(color?: string, lit = false) {
  if (lit || !color || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  const channels = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
  const top = Math.max(...channels);
  if (top <= SURFACE_WHITE) return color;
  return `#${channels
    .map((value) =>
      Math.round((value * SURFACE_WHITE) / top)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Side panel: removed by the user, or faded while the camera looks straight at it. */
const SidePanelContext = createContext({ removed: false, faded: false });

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
      color={surfaceColor(props.color as string | undefined, !!props.emissive)}
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

/**
 * Tempered glass with weak reflections, so the panel doesn't mirror the studio lights over the
 * interior. A side panel fades out when the user removes it or looks straight through it.
 */
function GlassMaterial({
  color,
  roughness,
  transmission,
  sidePanel = false,
}: {
  color: string;
  roughness: number;
  transmission: number;
  sidePanel?: boolean;
}) {
  const dim = useContext(DimContext);
  const light = useContext(LightTierContext);
  const panel = useContext(SidePanelContext);
  const ref = useRef<MeshPhysicalMaterial>(null);
  const goal = sidePanel && (panel.removed || panel.faded) ? 0 : dim ? 0.04 : 0.22;
  const snap = panel.removed || !sidePanel;
  // A remount (dim flips `transparent`) starts at the goal; afterwards opacity eases towards it.
  useLayoutEffect(() => {
    const material = ref.current;
    if (!material) return;
    material.opacity = goal;
    material.visible = goal > 0.01;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim]);
  useFrame((_, delta) => {
    const material = ref.current;
    if (!material) return;
    material.opacity =
      snap || prefersReducedMotion() ? goal : MathUtils.damp(material.opacity, goal, 7, delta);
    material.visible = material.opacity > 0.01;
  });
  return (
    <meshPhysicalMaterial
      ref={ref}
      key={dim ? "dim" : "lit"}
      color={color}
      metalness={0}
      roughness={roughness}
      transmission={light ? 0 : transmission}
      thickness={0.05}
      ior={1.5}
      envMapIntensity={0.25}
      specularIntensity={0.4}
      transparent
      depthWrite={false}
    />
  );
}

/**
 * Fades the side panel while the camera looks at it nearly head-on (within 15° of its normal,
 * back at 18°), so a straight side view shows the parts instead of glass glare.
 */
function SidePanelWatch({ onChange }: { onChange: (faded: boolean) => void }) {
  const faded = useRef(false);
  const direction = useRef(new Vector3());
  useFrame(({ camera }) => {
    const view = camera.getWorldDirection(direction.current);
    const flat = Math.hypot(view.x, view.z);
    const facing = flat > 0 ? -view.z / flat : 0;
    const next = faded.current
      ? facing > Math.cos((18 * Math.PI) / 180)
      : facing > Math.cos((15 * Math.PI) / 180);
    if (next !== faded.current) {
      faded.current = next;
      onChange(next);
    }
  });
  return null;
}

/**
 * A fan of half-width `radius` facing +x (front intake), +y (bottom intake) or -y: square frame,
 * pitched blades and a lit ring. Depth is 25/120 of the width, a standard 120 x 25 mm fan.
 */
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
  const rail = radius * 0.13;
  const depth = radius * (25 / 60);
  const blades = 2 * radius - 2 * rail - radius * 0.06;
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
      {/* Square frame: four rails around the blades. */}
      {[
        [0, radius - rail / 2, 2 * radius, rail],
        [0, -radius + rail / 2, 2 * radius, rail],
        [radius - rail / 2, 0, rail, 2 * radius],
        [-radius + rail / 2, 0, rail, 2 * radius],
      ].map(([x, y, width, height]) => (
        <Box
          key={`${x}:${y}`}
          size={[width, height, depth]}
          position={[x, y, 0]}
          material={{ color: frameColor, metalness: 0.05, roughness: 0.55 }}
        />
      ))}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group scale={[blades, depth * 0.7, blades]}>
          <Rotor material={{ color: frameColor, metalness: 0.05, roughness: 0.5 }} />
        </group>
        <group position={[0, depth / 2, 0]} scale={2 * radius - 2 * rail}>
          <LitRing color={light} />
        </group>
      </group>
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
          <GlassMaterial color="#d8e2e6" roughness={0.04} transmission={1} sidePanel />
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

// A y-axis primitive (cylinder, rotor, ring) turned to face along x, y or z.
const axisTurn: Record<ReferenceAxis, Point> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};
/** Local [diameter, length, diameter] scale of a turned y-axis primitive with world size `size`. */
function axisScale(axis: ReferenceAxis, size: Point): Point {
  return axis === "x"
    ? [size[1], size[0], size[2]]
    : axis === "y"
      ? size
      : [size[0], size[2], size[1]];
}

const BLADES = 9;

/**
 * Fan blades in unit space: diameter 1 across x/z, thickness 1 along y. Nine pitched blades
 * around a hub; the light tier draws one flat disc instead.
 */
function Rotor({ material }: { material: Record<string, unknown> }) {
  const light = useContext(LightTierContext);
  if (light)
    return (
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.3, 24]} />
        <Mat {...material} />
      </mesh>
    );
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.17, 1, 24]} />
        <Mat {...material} />
      </mesh>
      {Array.from({ length: BLADES }, (_, index) => (
        <group key={index} rotation={[0, (index * 2 * Math.PI) / BLADES, 0]}>
          <mesh position={[0.32, 0, 0]} rotation={[0.6, 0, 0]} castShadow>
            <boxGeometry args={[0.31, 0.08, 0.24]} />
            <Mat {...material} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Lit ring in unit space (outer diameter 1) facing along y, in the build's RGB colour. */
function LitRing({ color }: { color: string }) {
  const dim = useContext(DimContext);
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.465, 0.035, 10, 48]} />
      <Mat color={color} emissive={color} emissiveIntensity={dim ? 0.3 : 2.4} toneMapped={false} />
    </mesh>
  );
}

const FIN_PITCH_MM = 4;
const finMatrix = new Matrix4();

/**
 * Radiator core in millimetres: thin fin plates stacked along `axis` between two side rails. The
 * light tier draws one solid block.
 */
function Fins({
  sizeMm,
  axis,
  material,
}: {
  sizeMm: Point;
  axis: ReferenceAxis;
  material: Record<string, unknown>;
}) {
  const light = useContext(LightTierContext);
  const instances = useRef<InstancedMesh>(null);
  const k = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const count = Math.max(1, Math.floor(sizeMm[k] / FIN_PITCH_MM));
  useLayoutEffect(() => {
    const mesh = instances.current;
    if (!mesh) return;
    for (let index = 0; index < count; index += 1) {
      const offset: Point = [0, 0, 0];
      offset[k] = -sizeMm[k] / 2 + (index + 0.5) * (sizeMm[k] / count);
      mesh.setMatrixAt(index, finMatrix.makeTranslation(...offset));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, k, sizeMm, light]);
  if (light)
    return (
      <mesh scale={sizeMm}>
        <boxGeometry />
        <Mat {...material} />
      </mesh>
    );
  const plate: Point = [...sizeMm];
  plate[k] = 0.6;
  // Rails run along the stack on the two faces across the fin plates' width.
  const railFace = k === 2 ? 0 : 2;
  const rail: Point = [...sizeMm];
  rail[railFace] = 4;
  return (
    <group>
      <instancedMesh ref={instances} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={plate} />
        <Mat {...material} />
      </instancedMesh>
      {[-1, 1].map((sign) => {
        const position: Point = [0, 0, 0];
        position[railFace] = sign * (sizeMm[railFace] / 2 - 2);
        return (
          <mesh key={sign} position={position} castShadow>
            <boxGeometry args={rail} />
            <Mat {...material} />
          </mesh>
        );
      })}
    </group>
  );
}

/** One part of a reference model, in millimetres inside the model's group. */
function ReferencePart({
  part,
  material,
  accent,
}: {
  part: ReferenceModelPart;
  material: ReferenceMaterial;
  accent: string;
}) {
  const axis = part.axis ?? "x";
  const surface = {
    color: material.color,
    roughness: material.roughness,
    metalness: material.metalness,
  };
  if (part.shape === "fins")
    return (
      <group position={part.positionMm}>
        <Fins sizeMm={part.sizeMm} axis={axis} material={surface} />
      </group>
    );
  if (part.shape === "ring" || part.shape === "rotor" || part.shape === "cylinder") {
    const scale = axisScale(axis, part.sizeMm);
    return (
      <group position={part.positionMm} rotation={axisTurn[axis]}>
        {part.shape === "ring" ? (
          <group scale={Math.max(scale[0], scale[2])}>
            <LitRing color={accent} />
          </group>
        ) : (
          <group scale={scale}>
            {part.shape === "rotor" ? (
              <Rotor material={surface} />
            ) : (
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[0.5, 0.5, 1, 20]} />
                <Mat {...surface} />
              </mesh>
            )}
          </group>
        )}
      </group>
    );
  }
  return null;
}

/** A per-SKU reference reconstruction, drawn 1:1 from its millimetre parts. */
function ReferenceModelMesh({ model, accent }: { model: ReferenceModel; accent: string }) {
  const dim = useContext(DimContext);
  const light = useContext(LightTierContext);
  return (
    <group
      rotation={model.frame === "gpu" ? gpuFrameRotation : undefined}
      scale={1 / MM_PER_SCENE_UNIT}
    >
      {model.parts.map((part) => {
        const material = model.materials[part.material];
        if (part.shape !== "box" && part.shape !== "disc")
          return <ReferencePart key={part.id} part={part} material={material} accent={accent} />;
        const glass = !!material.transmission;
        // A lit part (a memory light bar) glows in the build's RGB colour.
        const lit = part.material === "light";
        return (
          <mesh
            key={part.id}
            position={part.positionMm}
            scale={part.sizeMm}
            castShadow={!glass}
            receiveShadow
          >
            {part.shape === "box" ? <boxGeometry /> : <sphereGeometry args={[0.5, 48, 12]} />}
            {lit ? (
              <Mat
                color={accent}
                emissive={accent}
                emissiveIntensity={dim ? 0.3 : 2.2}
                toneMapped={false}
              />
            ) : glass ? (
              <GlassMaterial
                color={material.color}
                roughness={material.roughness}
                transmission={material.transmission ?? 1}
                // The thin glass pane on the +z face is the side panel.
                sidePanel={model.frame === "case" && part.positionMm[2] > 0 && part.sizeMm[2] < 10}
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
  /** Confirmed case only: fans seen in the photo (a style note; fans are not Build slots). */
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
  // A focused GPU or AIO reference model turns its fans to the viewer; in the case they face down.
  const rotation: Point =
    slot === "gpu" && model && focusSlot === slot
      ? [-1.87, 0, 0]
      : slot === "cooler" && model && focusSlot === slot
        ? [-1.15, 0, 0]
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
    ? "#6aa6ff"
    : (occupancy === "unresolved" && !look) || flagged
      ? "#f2b65f"
      : occupancy === "unselected"
        ? "#7d8690"
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
              <ReferenceModelMesh model={model} accent={presentation.accentColor} />
              {/* Fans are not Build parts; draw the ones the photo shows on the confirmed case. */}
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
          <mesh position={model && model.frame === "case" ? sceneCentre(model) : undefined}>
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
  const color = selected ? "#6aa6ff" : occupancy === "unresolved" ? "#f2b65f" : "#7d8690";
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
    <Environment resolution={256} frames={1} environmentIntensity={1}>
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
  sidePanelRemoved = false,
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
  const [panelFaded, setPanelFaded] = useState(false);
  // Bloom only above 1.6: lit white panels stay below it, emissive RGB (2.2+) glows.
  return (
    <div
      className={`v3-scene-canvas ${focusSlot ? "is-focused" : ""}`}
      data-scene-quality={quality}
      data-reference-models={referenceModelSlots(document).join(" ")}
      data-side-panel={sidePanelRemoved ? "removed" : panelFaded ? "faded" : "shown"}
      role="region"
      aria-label="Illustrative interactive PC scene. The eight 2D slot buttons below provide keyboard access."
    >
      <Canvas
        key={resetKey}
        // Side-front: the camera looks in through the glass side panel (+z), past the front edge.
        camera={{ position: [3.4, 1.2, 8.6], fov: 38 }}
        dpr={quality === "high" ? [1, 1.5] : 1}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        // The AgX pass in the effect chain reads this; slightly under 1 keeps white panels off the clip.
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.9;
        }}
        shadows
        onPointerMissed={() => onClearFocus?.()}
      >
        <LightTierContext.Provider value={quality === "low"}>
          <SidePanelContext.Provider value={{ removed: sidePanelRemoved, faded: panelFaded }}>
            <PerformanceMonitor
              bounds={() => [30, 55]}
              onDecline={lowerQuality}
              onFallback={lowerQuality}
            />
            <SidePanelWatch onChange={setPanelFaded} />
            <color attach="background" args={["#17191c"]} />
            <fog attach="fog" args={["#17191c", 11, 22]} />
            <StudioEnvironment />
            <ambientLight intensity={0.25} />
            <directionalLight position={[3, 6, 6]} intensity={1.6} castShadow />
            <directionalLight position={[-5, 3, -4]} intensity={0.8} color="#cfd8ff" />
            {/* Low interior fill just inside the glass so parts read through it, plus a soft accent glow. */}
            <pointLight
              position={[0.2, 0.4, whiteBoard ? 0.7 : 0.55]}
              intensity={(focusSlot ? 0.8 : 1.4) * (whiteBoard ? 0.6 : 1)}
              distance={3.5}
              decay={1.6}
            />
            <pointLight
              position={[0.6, -0.9, 0.2]}
              intensity={1.5}
              distance={3}
              color={presentation.accentColor}
            />
            {/* RGB spill under the top fans: from the side, down-facing fans read as their glow. */}
            <pointLight
              position={[-0.25, 0.85, 0.45]}
              intensity={focusSlot ? 0 : 0.8}
              distance={1.6}
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
                <ToneMapping mode={ToneMappingMode.AGX} />
              </EffectComposer>
            ) : (
              // Light tier: no SSAO or depth of field, no multisampling; RGB glow, vignette and tone mapping stay.
              <EffectComposer multisampling={0}>
                <Bloom mipmapBlur luminanceThreshold={1.6} intensity={0.9} />
                <Vignette eskil={false} offset={0.25} darkness={0.55} />
                <ToneMapping mode={ToneMappingMode.AGX} />
              </EffectComposer>
            )}
          </SidePanelContext.Provider>
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
