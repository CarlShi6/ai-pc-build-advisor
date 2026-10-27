import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Environment,
  Lightformer,
  Line,
  MeshReflectorMaterial,
  OrbitControls,
  PerformanceMonitor,
  RoundedBox,
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
  Box3,
  CatmullRomCurve3,
  DirectionalLight,
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  TubeGeometry,
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
  CAMERA_FOV,
  DEFAULT_CAMERA,
  EXPLODED_VIEW,
  FOCUS_FILL,
  FOCUS_VIEW,
  RECEDE,
  SHOWCASE_POINT,
  FRAME_BOTTOM,
  FRAME_TOP,
  fitBoxes,
  fitCamera,
  focusFrame,
  isDimmed,
  showcaseRotation,
  slotLayout as layout,
  type CameraPose,
  type Point,
  type SceneMode,
} from "@/lib/v3/scene-focus";
import { slotModel } from "@/lib/v3/slot-models";
import {
  GENERIC_CASE_WALL,
  GENERIC_SHROUD_FROM_BOTTOM,
  casePanelOf,
  casePanels,
  explodeDistances,
  explodeOffset,
  sceneBoxes,
  shiftBox,
  type CasePanel,
  type ExplodeId,
  type SceneBox,
} from "@/lib/v3/scene-explode";
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
  cornerRadius,
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

/** Exploded offset of each case panel, inside the case slot's group. */
const PanelOffsetContext = createContext<Partial<Record<CasePanel, Point>>>({});

const ORIGIN: Point = [0, 0, 0];

/** Group that eases to `position`; snaps on the first frame and when motion is reduced. */
function Eased({ position = ORIGIN, children }: { position?: Point; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const placed = useRef(false);
  useFrame((_, delta) => {
    const node = ref.current;
    if (!node) return;
    const [x, y, z] = position;
    if (!placed.current || prefersReducedMotion()) {
      node.position.set(x, y, z);
      placed.current = true;
    } else node.position.lerp(new Vector3(x, y, z), 1 - Math.exp(-delta * 9));
  });
  return <group ref={ref}>{children}</group>;
}

/** True inside the ghosted placeholder of an open slot (PRD §9.3): every surface is a faint grey. */
const GhostContext = createContext(false);

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
  const ghost = useContext(GhostContext);
  const opacity = props.opacity ?? 1;
  if (ghost)
    // One flat, light translucent grey: reads as "a board goes here" against white or dark walls.
    return (
      <meshStandardMaterial
        key={dim ? "ghost-dim" : "ghost"}
        color="#B4BCC6"
        roughness={0.8}
        metalness={0}
        transparent
        opacity={dim ? 0.06 : 0.26}
        depthWrite={false}
      />
    );
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
  panel: casePanel,
}: {
  color: string;
  roughness: number;
  transmission: number;
  sidePanel?: boolean;
  /** The case panel this pane belongs to: outlined while exploded, as bare glass barely shows. */
  panel?: CasePanel | null;
}) {
  const offsets = useContext(PanelOffsetContext);
  const apart = !!casePanel && Math.hypot(...(offsets[casePanel] ?? ORIGIN)) > 0.05;
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
    <>
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
      {apart && !dim && <Edges color="#c9d1da" transparent opacity={0.6} />}
    </>
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
  const offsets = useContext(PanelOffsetContext);
  const [w, h, d] = size;
  const t = GENERIC_CASE_WALL;
  const white = presentation.caseColor === appearanceHex.white;
  const panel = white
    ? { color: presentation.caseColor, metalness: 0.1, roughness: 0.45 }
    : { color: presentation.caseColor, metalness: 0.55, roughness: 0.42 };
  const fanCount = Math.min(6, Math.max(0, presentation.fanAccentCount));
  const fanFrame = white ? "#dfe3e8" : "#18191c";
  // Panels match `genericCasePanels`; each moves on its own when exploded. The rest is the frame.
  return (
    <group>
      <Eased position={offsets.top}>
        <Box size={[w, t, d]} position={[0, h / 2, 0]} material={panel} />
      </Eased>
      <Box size={[w, t, d]} position={[0, -h / 2, 0]} material={panel} />
      <Eased position={offsets.back}>
        <Box size={[w, h, t]} position={[0, 0, -d / 2]} material={panel} />
      </Eased>
      <Box size={[t, h, d]} position={[-w / 2, 0, 0]} material={panel} />
      {/* Front panel: mesh look; see-through enough to show lit front fans. */}
      <Eased position={offsets.front}>
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
      </Eased>
      <Eased position={offsets.shroud}>
        <Box
          size={[w - t * 2, 0.04, d - t * 2]}
          position={[0, -h / 2 + GENERIC_SHROUD_FROM_BOTTOM, 0]}
          material={panel}
        />
      </Eased>
      {/* Tempered glass side panel, facing the default camera. */}
      <Eased position={offsets.glass}>
        {glass ? (
          <mesh position={[0, 0, d / 2]}>
            <boxGeometry args={[w, h, 0.02]} />
            <GlassMaterial
              color="#d8e2e6"
              roughness={0.04}
              transmission={1}
              sidePanel
              panel="glass"
            />
          </mesh>
        ) : (
          <Box size={[w, h, 0.02]} position={[0, 0, d / 2]} material={panel} />
        )}
      </Eased>
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

/** A bent hose along a smooth curve through `points`; fewer segments in the light tier. */
function Hose({
  points,
  diameter,
  position,
  material,
}: {
  points: Point[];
  diameter: number;
  position: Point;
  material: Record<string, unknown>;
}) {
  const light = useContext(LightTierContext);
  const geometry = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3(points.map((point) => new Vector3(...point))),
        light ? 12 : 48,
        diameter / 2,
        light ? 6 : 14,
        false,
      ),
    [points, diameter, light],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <Mat {...material} />
    </mesh>
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
  if (part.shape === "tube" && part.pathMm)
    return (
      <Hose
        points={part.pathMm}
        diameter={part.diameterMm ?? 10}
        position={part.positionMm}
        material={surface}
      />
    );
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
function ReferenceModelMesh({
  model,
  accent,
  panels = false,
}: {
  model: ReferenceModel;
  accent: string;
  /** The case slot's model: its panels move on their own when exploded. */
  panels?: boolean;
}) {
  const dim = useContext(DimContext);
  const light = useContext(LightTierContext);
  const offsets = useContext(PanelOffsetContext);
  const panelOf = useMemo(
    () => new Map(model.parts.map((part) => [part.id, panels ? casePanelOf(part, model) : null])),
    [model, panels],
  );
  return (
    <group
      rotation={model.frame === "gpu" ? gpuFrameRotation : undefined}
      scale={1 / MM_PER_SCENE_UNIT}
    >
      {model.parts.map((part) => {
        const panel = panelOf.get(part.id);
        const element = referencePartElement(part);
        if (!panel) return element;
        const offset = (offsets[panel] ?? ORIGIN).map(
          (value) => value * MM_PER_SCENE_UNIT,
        ) as Point;
        return (
          <Eased key={part.id} position={offset}>
            {element}
          </Eased>
        );
      })}
    </group>
  );

  function referencePartElement(part: ReferenceModelPart) {
    const material = model.materials[part.material];
    if (part.shape !== "box" && part.shape !== "disc")
      return <ReferencePart key={part.id} part={part} material={material} accent={accent} />;
    const glass = !!material.transmission;
    // A lit part (a memory light bar) glows in the build's RGB colour.
    const lit = part.material === "light";
    const radius = cornerRadius(part);
    const surface = lit ? (
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
        panel={panelOf.get(part.id)}
      />
    ) : (
      <Mat color={material.color} roughness={material.roughness} metalness={material.metalness} />
    );
    // Rounded edges in the full tier; the light tier keeps plain boxes.
    if (part.shape === "box" && radius > 0 && !light)
      return (
        <RoundedBox
          key={part.id}
          args={part.sizeMm}
          radius={radius}
          smoothness={2}
          position={part.positionMm}
          castShadow={!glass}
          receiveShadow
        >
          {surface}
        </RoundedBox>
      );
    return (
      <mesh
        key={part.id}
        position={part.positionMm}
        scale={part.sizeMm}
        castShadow={!glass}
        receiveShadow
      >
        {part.shape === "box" ? <boxGeometry /> : <sphereGeometry args={[0.5, 48, 12]} />}
        {surface}
      </mesh>
    );
  }
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
  target,
  rotation,
  focusSlot,
  onPick,
  onGroup,
  presentation,
  look,
  fans,
}: {
  slot: SlotId;
  document: BuildDocumentV3;
  selected: boolean;
  mode: SceneMode;
  /** Resting position and turn: assembled, exploded, stepped back or on the showcase spot. */
  target: Point;
  rotation: Point;
  focusSlot: SlotId | null;
  onPick: (slot: SlotId) => void;
  onGroup: (slot: SlotId, group: Group | null) => void;
  presentation: ScenePresentation;
  /** Unresolved slot the photo shows: drawn as a look-alike placeholder (PRD §9.3 level 2). */
  look?: SlotAppearance;
  /** Confirmed case only: fans seen in the photo (a style note; fans are not Build slots). */
  fans?: PhotoFans | null;
}) {
  const group = useRef<Group>(null);
  const occupancy = slotOccupancy(document, slot);
  const dimmed = isDimmed(slot, focusSlot);
  // A reference model, a photo look-alike or the ghosted board (see slotModel).
  const drawn = slotModel(document, slot);
  const model = drawn?.model ?? null;
  const partColor = colorName(selectedPart(document, slot)?.color);
  const size: Point = model
    ? sceneSize(model)
    : slot === "case" && presentation.layout === "showcase"
      ? [2.55, 3.05, 1.75]
      : layout[slot].size;
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
        ref={(node) => {
          group.current = node;
          onGroup(slot, node);
        }}
        // A dimmed case would swallow clicks meant for the parts around it.
        onClick={dimmed && slot === "case" ? undefined : handleClick}
      >
        {occupancy === "selected" ? (
          model ? (
            <>
              <ReferenceModelMesh
                model={model}
                accent={presentation.accentColor}
                panels={slot === "case"}
              />
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
        ) : drawn?.kind === "ghost" ? (
          // Open motherboard slot: a faint generic board, so the parts around it have a base.
          <GhostContext.Provider value>
            <ReferenceModelMesh model={drawn.model} accent={presentation.accentColor} />
          </GhostContext.Provider>
        ) : drawn?.kind === "appearance" ? (
          // A detailed look-alike in the photo's colour and light; the label says no model.
          <ReferenceModelMesh
            model={drawn.model}
            accent={
              look?.lightColor
                ? (lightHex[look.lightColor] ?? presentation.accentColor)
                : presentation.accentColor
            }
          />
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
  from,
  to,
  selected,
  unresolved,
}: {
  from: Point;
  to: Point;
  selected: boolean;
  unresolved: boolean;
}) {
  const color = selected ? "#6aa6ff" : unresolved ? "#f2b65f" : "#7d8690";
  return (
    <Line
      points={[from, to]}
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

function ProjectOverlay({
  labelRefs,
  labels,
}: {
  labelRefs: RefObject<Partial<Record<SlotId, HTMLElement | null>>>;
  labels: Record<SlotId, Point>;
}) {
  useFrame(({ camera, size }) => {
    for (const slot of primarySlots) {
      const element = labelRefs.current?.[slot];
      if (!element) continue;
      const point = new Vector3(...labels[slot]).project(camera);
      const x = Math.max(78, Math.min(size.width - 78, ((point.x + 1) * size.width) / 2));
      const y = Math.max(25, Math.min(size.height - 25, ((1 - point.y) * size.height) / 2));
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  });
  return null;
}

const rigBox = new Box3();
const rigCorner = new Vector3();
const rigGoal = new Vector3();

function boxOf(box: Box3): SceneBox {
  const centre = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  return { centre: [centre.x, centre.y, centre.z], size: [size.x, size.y, size.z] };
}

interface OrbitLike {
  target: Vector3;
  update: () => void;
  addEventListener: (type: "start", listener: () => void) => void;
  removeEventListener: (type: "start", listener: () => void) => void;
}

/**
 * Camera rig (E2): frames the shown part in the free area beside the replace card, frames the
 * whole exploded layout, or goes back to where the camera was before a part was shown. It hands
 * control back as soon as the user orbits or zooms. It also places the card and reports the
 * shown part's on-screen rectangle as `data-focus-rect` ("left top right bottom", canvas px).
 */
function CameraRig({
  focusSlot,
  mode,
  explode,
  groups,
  explodedBoxes,
  cardRef,
  sceneRef,
}: {
  focusSlot: SlotId | null;
  mode: SceneMode;
  explode: number;
  groups: RefObject<Partial<Record<SlotId, Group | null>>>;
  explodedBoxes: SceneBox[];
  cardRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  const active = useRef(true);
  const saved = useRef<CameraPose | null>(null);
  const previousFocus = useRef<SlotId | null>(null);
  const frames = useRef(0);
  useEffect(() => {
    // Remember where the camera was when a part is first shown, to come back to it.
    if (!previousFocus.current && focusSlot && controls)
      saved.current = {
        position: camera.position.toArray() as Point,
        target: controls.target.toArray() as Point,
      };
    previousFocus.current = focusSlot;
    active.current = true;
  }, [focusSlot, camera, controls]);
  useEffect(() => {
    saved.current = null;
    active.current = true;
  }, [mode]);
  useEffect(() => {
    active.current = true;
  }, [explode]);
  useEffect(() => {
    if (!controls) return;
    const release = () => {
      active.current = false;
    };
    controls.addEventListener("start", release);
    return () => controls.removeEventListener("start", release);
  }, [controls]);
  useFrame((_, delta) => {
    const card = cardRef.current;
    const frame = focusFrame(
      size.width,
      size.height,
      card?.offsetWidth || 320,
      card?.offsetHeight || 300,
    );
    if (card) {
      card.style.left = `${frame.card.left}px`;
      card.style.top = `${frame.card.top}px`;
      card.style.maxHeight = `${frame.card.maxHeight}px`;
    }
    const shown = focusSlot ? groups.current?.[focusSlot] : null;
    let goal: CameraPose;
    if (shown) {
      rigBox.setFromObject(shown);
      const box = boxOf(rigBox);
      // The case is shown from the default side-front view; a part straight on.
      goal = fitCamera(
        box,
        focusSlot === "case" ? DEFAULT_CAMERA : FOCUS_VIEW,
        CAMERA_FOV,
        size,
        frame.free,
        FOCUS_FILL,
      );
      frames.current += 1;
      if (sceneRef.current && frames.current % 5 === 0) {
        const xs: number[] = [];
        const ys: number[] = [];
        for (const x of [rigBox.min.x, rigBox.max.x])
          for (const y of [rigBox.min.y, rigBox.max.y])
            for (const z of [rigBox.min.z, rigBox.max.z]) {
              rigCorner.set(x, y, z).project(camera);
              xs.push(((rigCorner.x + 1) * size.width) / 2);
              ys.push(((1 - rigCorner.y) * size.height) / 2);
            }
        sceneRef.current.dataset.focusRect = [
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs),
          Math.max(...ys),
        ]
          .map((value) => Math.round(value))
          .join(" ");
      }
    } else {
      if (sceneRef.current) delete sceneRef.current.dataset.focusRect;
      goal =
        mode === "exploded"
          ? fitBoxes(
              explodedBoxes,
              EXPLODED_VIEW,
              CAMERA_FOV,
              size,
              { x0: 24, y0: FRAME_TOP - 40, x1: size.width - 24, y1: size.height - FRAME_BOTTOM },
              0.92,
            )
          : (saved.current ?? { position: DEFAULT_CAMERA, target: ORIGIN });
    }
    if (!active.current || !controls) return;
    const step = prefersReducedMotion() ? 1 : 1 - Math.exp(-delta * 4);
    camera.position.lerp(rigGoal.set(...goal.position), step);
    controls.target.lerp(rigGoal.set(...goal.target), step);
    controls.update();
  });
  return null;
}

/** A soft directional light aimed at the showcase spot. */
function ShowcaseLight({ position }: { position: Point }) {
  const light = useRef<DirectionalLight>(null);
  useLayoutEffect(() => {
    const node = light.current;
    if (!node) return;
    node.target.position.set(...SHOWCASE_POINT);
    node.target.updateMatrixWorld();
  }, []);
  return <directionalLight ref={light} position={position} intensity={1.4} />;
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
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const groups = useRef<Partial<Record<SlotId, Group | null>>>({});
  const registerGroup = (slot: SlotId, group: Group | null) => {
    groups.current[slot] = group;
  };
  // E1: every part and case panel moves along its own direction; distances come from the boxes.
  const boxes = useMemo(() => sceneBoxes(document), [document]);
  const distances = useMemo(() => explodeDistances(boxes), [boxes]);
  const amount = mode === "exploded" ? Math.max(0, Math.min(100, explode)) / 100 : 0;
  const explodedBoxes = (Object.keys(boxes) as ExplodeId[]).map((id) =>
    shiftBox(boxes[id], explodeOffset(id, distances, amount)),
  );
  const floorY = Math.min(
    FLOOR_Y,
    Math.min(...explodedBoxes.map((box) => box.centre[1] - box.size[1] / 2)) - 0.06,
  );
  // E2: a shown part goes to the showcase spot, best face forward; the rest dims and steps back.
  // Showing the case keeps everything in place, panels closed, and fades the parts inside.
  const showing = focusSlot && focusSlot !== "case" ? focusSlot : null;
  const placements = Object.fromEntries(
    primarySlots.map((slot) => {
      const anchor = layout[slot].anchor;
      if (slot === showing) {
        const rotation = showcaseRotation(slot);
        // Put the part's own centre (off its origin for case-frame models) on the spot.
        const centre = new Vector3(
          ...boxes[slot].centre.map((value, k) => value - anchor[k]),
        ).applyEuler(new Euler(...rotation));
        return [
          slot,
          {
            target: SHOWCASE_POINT.map((value, k) => value - centre.getComponent(k)) as Point,
            rotation,
          },
        ];
      }
      const offset = explodeOffset(slot, distances, amount);
      const step = showing ? RECEDE : ORIGIN;
      return [
        slot,
        {
          target: anchor.map((value, k) => value + offset[k] + step[k]) as Point,
          rotation: (slot === "gpu" && presentation.gpuVertical
            ? [0, 0, Math.PI / 2]
            : [0, 0, 0]) as Point,
        },
      ];
    }),
  ) as Record<SlotId, { target: Point; rotation: Point }>;
  const panelOffsets = Object.fromEntries(
    casePanels.map((panel) => [
      panel,
      focusSlot === "case" ? ORIGIN : explodeOffset(panel, distances, amount),
    ]),
  ) as Record<CasePanel, Point>;
  // Labels sit above each exploded part; otherwise in their side columns.
  const labels = Object.fromEntries(
    primarySlots.map((slot) => {
      if (mode !== "exploded") return [slot, layout[slot].label];
      const box = shiftBox(boxes[slot], explodeOffset(slot, distances, amount));
      return [slot, [box.centre[0], box.centre[1] + box.size[1] / 2 + 0.25, box.centre[2]]];
    }),
  ) as Record<SlotId, Point>;
  // Adaptive quality: a device that can't hold ~30 fps drops to the light tier for the session.
  const [quality, setQuality] = useState<"high" | "low">("high");
  const lowerQuality = () => setQuality("low");
  const [panelFaded, setPanelFaded] = useState(false);
  // Bloom only above 1.6: lit white panels stay below it, emissive RGB (2.2+) glows.
  return (
    <div
      ref={sceneRef}
      className={`v3-scene-canvas ${focusSlot ? "is-focused" : ""}`}
      data-scene-mode={mode}
      data-focus-slot={focusSlot ?? undefined}
      data-scene-quality={quality}
      data-reference-models={referenceModelSlots(document).join(" ")}
      data-slot-models={primarySlots
        .flatMap((slot) => {
          const drawn = slotModel(document, slot);
          return drawn ? [`${slot}:${drawn.kind}`] : [];
        })
        .join(" ")}
      data-side-panel={sidePanelRemoved ? "removed" : panelFaded ? "faded" : "shown"}
      role="region"
      aria-label="Illustrative interactive PC scene. The eight 2D slot buttons below provide keyboard access."
    >
      <Canvas
        key={resetKey}
        // Side-front: the camera looks in through the glass side panel (+z), past the front edge.
        camera={{ position: DEFAULT_CAMERA, fov: CAMERA_FOV }}
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
            <fog attach="fog" args={["#17191c", 16, 40]} />
            <StudioEnvironment />
            <ambientLight intensity={0.25} />
            <directionalLight position={[3, 6, 6]} intensity={1.6} castShadow />
            <directionalLight position={[-5, 3, -4]} intensity={0.8} color="#cfd8ff" />
            {/* Low interior fill just inside the glass so parts read through it. It falls off fast
                (decay 2) so the white walls next to it do not flare; the RGB colour comes from the
                lit fan and pump rings, not from a light pooling on the PSU shroud. */}
            <pointLight
              position={[0.2, 0.4, whiteBoard ? 0.7 : 0.55]}
              intensity={(focusSlot ? 0.6 : 0.9) * (whiteBoard ? 0.6 : 1)}
              distance={3}
              decay={2}
            />
            {/* Showcase key light: from the camera side, above, onto the shown part. */}
            {showing && (
              <ShowcaseLight
                position={
                  SHOWCASE_POINT.map(
                    (value, k) => value + FOCUS_VIEW[k] * 5 + [1.5, 2.5, 0][k],
                  ) as Point
                }
              />
            )}
            {/* RGB spill under the top fans: from the side, down-facing fans read as their glow. */}
            <pointLight
              position={[-0.25, 0.85, 0.45]}
              intensity={focusSlot ? 0 : 0.35}
              distance={1.4}
              decay={2}
              color={presentation.accentColor}
            />
            <PanelOffsetContext.Provider value={panelOffsets}>
              {primarySlots.map((slot) => (
                <SlotMesh
                  key={slot}
                  slot={slot}
                  document={document}
                  selected={selectedSlot === slot}
                  mode={mode}
                  target={placements[slot].target}
                  rotation={placements[slot].rotation}
                  focusSlot={focusSlot}
                  onPick={pick}
                  onGroup={registerGroup}
                  presentation={presentation}
                  look={looks[slot]}
                  fans={slot === "case" ? fans : null}
                />
              ))}
            </PanelOffsetContext.Provider>
            {/* Dashed callouts to the side labels; exploded labels sit on their parts instead. */}
            {!focusSlot &&
              mode !== "exploded" &&
              primarySlots.map((slot) => (
                <SlotCallout
                  key={`${slot}-callout`}
                  from={placements[slot].target}
                  to={labels[slot]}
                  selected={selectedSlot === slot}
                  unresolved={slotOccupancy(document, slot) === "unresolved"}
                />
              ))}
            <ContactShadows
              frames={quality === "low" ? 1 : Infinity}
              position={[0, floorY + 0.005, 0]}
              opacity={0.65}
              scale={9}
              blur={2.6}
              far={3.2}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]}>
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
            <ProjectOverlay labelRefs={labelRefs} labels={labels} />
            <OrbitControls
              makeDefault
              enablePan
              enableZoom
              minDistance={0.8}
              maxDistance={30}
              maxPolarAngle={Math.PI / 2 - 0.05}
              target={[0, 0, 0]}
            />
            <CameraRig
              focusSlot={focusSlot}
              mode={mode}
              explode={explode}
              groups={groups}
              explodedBoxes={explodedBoxes}
              cardRef={cardRef}
              sceneRef={sceneRef}
            />
            {quality === "high" ? (
              <EffectComposer multisampling={4}>
                <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={1} halfRes />
                <Bloom mipmapBlur luminanceThreshold={1.6} intensity={0.9} />
                {/* Depth of field follows the shown part; off for the wide exploded layout. */}
                {mode !== "exploded" && focusSlot !== "case" && (
                  <DepthOfField
                    target={showing ? SHOWCASE_POINT : [0, 0, 0.6]}
                    focalLength={0.2}
                    bokehScale={0.7}
                  />
                )}
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
