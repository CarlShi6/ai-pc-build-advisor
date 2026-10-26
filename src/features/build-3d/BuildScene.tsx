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

function CaseModel({ size, presentation }: { size: Point; presentation: ScenePresentation }) {
  const dim = useContext(DimContext);
  const light = useContext(LightTierContext);
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
      {Array.from({ length: fanCount }, (_, index) => (
        <group
          key={index}
          position={[w / 2 - 0.09, h / 2 - 0.62 - index * 0.78, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
            <Mat {...plastic} />
          </mesh>
          <RgbRing radius={0.28} position={[0, 0, 0.03]} color={presentation.accentColor} />
        </group>
      ))}
    </group>
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
            <Mat {...plastic} />
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
                <Mat {...plastic} />
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
            <Mat {...darkMetal} />
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
  focusSlot,
  onPick,
  presentation,
}: {
  slot: SlotId;
  document: BuildDocumentV3;
  selected: boolean;
  mode: SceneMode;
  explode: number;
  focusSlot: SlotId | null;
  onPick: (slot: SlotId) => void;
  presentation: ScenePresentation;
}) {
  const group = useRef<Group>(null);
  const occupancy = slotOccupancy(document, slot);
  const target = slotPosition(slot, mode, explode, focusSlot);
  const dimmed = isDimmed(slot, focusSlot);
  const model =
    occupancy === "selected" ? referenceModelFor(selectedPart(document, slot)?.id) : null;
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
  const edgeColor = selected
    ? "#c4f59f"
    : occupancy === "unresolved" || flagged
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
            <ReferenceModelMesh model={model} />
          ) : slot === "case" ? (
            <CaseModel size={size} presentation={presentation} />
          ) : (
            <PartModel slot={slot} size={size} accent={presentation.accentColor} />
          )
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
        {edgeColor && !dimmed && !(slot === "case" && occupancy === "selected") && (
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
  focusSlot = null,
  onFocus,
  onClearFocus,
  focusCard,
  partLink,
}: BuildSceneProps) {
  const labelRefs = useRef<Partial<Record<SlotId, HTMLElement | null>>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const presentation = scenePresentation(document);
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
            position={[0, 0.3, 0.1]}
            intensity={focusSlot ? 2 : 6}
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
              <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} />
              <DepthOfField target={[0, 0, 0.6]} focalLength={0.2} bokehScale={0.7} />
              <Vignette eskil={false} offset={0.25} darkness={0.55} />
            </EffectComposer>
          ) : (
            // Light tier: no SSAO or depth of field, no multisampling; RGB glow and vignette stay.
            <EffectComposer multisampling={0}>
              <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} />
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
          return (
            <div
              key={slot}
              ref={(element) => {
                labelRefs.current[slot] = element;
              }}
              data-scene-slot={slot}
              className={`v3-scene-callout ${selectedSlot === slot ? "active" : ""} ${occupancy} ${isDimmed(slot, focusSlot) ? "dimmed" : ""}`}
            >
              <button
                type="button"
                onClick={() => pick(slot)}
                aria-label={`${slotLabel[slot]}: ${part?.displayName ?? occupancy}`}
              >
                <strong>{slotLabel[slot]}</strong>
                <small>
                  {part?.model ?? (occupancy === "unresolved" ? "Review match" : "Add part")}
                </small>
              </button>
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
