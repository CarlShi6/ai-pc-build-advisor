// Review harness: renders one img2threejs factory at fixed review views (dev-only, not shipped).
import * as THREE from "three";
import * as factory from "MODEL_FACTORY";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "front";
const scaleToUnits = Number(params.get("scale") ?? "150"); // millimetres per scene unit
const bg = params.get("bg") ?? "#7f8790";

const fns = Object.entries(factory as Record<string, unknown>);
const pick = (suffix: string) =>
  fns.find(([name]) => name.startsWith("create") && name.endsWith(suffix))?.[1] as
    | ((...args: unknown[]) => unknown)
    | undefined;
const createModel = fns.find(
  ([name]) => /^create.*Model$/.test(name) && !name.endsWith("LookDevModel"),
)?.[1] as (options?: unknown) => THREE.Group;
const createLights = pick("LookDevLights");
const createEnvironment = pick("Environment");
const configure = fns.find(([name]) => /^configure.*Renderer$/.test(name))?.[1] as
  | ((renderer: THREE.WebGLRenderer) => void)
  | undefined;

const width = Number(params.get("w") ?? "800");
const height = Number(params.get("h") ?? "800");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height);
renderer.setPixelRatio(1);
configure?.(renderer);
renderer.toneMappingExposure = Number(params.get("exposure") ?? "1");
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(bg);
if (createEnvironment) scene.environment = createEnvironment(renderer) as THREE.Texture;
if (createLights) scene.add(createLights("reference") as THREE.Object3D);

const shadows = params.get("shadows") !== "off";
const model = createModel({ castShadow: shadows, receiveShadow: shadows });
model.scale.setScalar(1 / scaleToUnits);
scene.add(model);
// unlit=1: map-stripped evidence — every material becomes a flat base-colour MeshBasicMaterial.
if (params.get("unlit") === "1") {
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshBasicMaterial({ color: source.color?.clone() ?? new THREE.Color("#ffffff") });
  });
}

const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const directions: Record<string, THREE.Vector3> = {
  front: new THREE.Vector3(1, 0.04, 0),
  side: new THREE.Vector3(0, 0.04, 1),
  rear: new THREE.Vector3(-1, 0.04, 0),
  left: new THREE.Vector3(0, 0.04, -1),
  orbit: new THREE.Vector3(1, 0.45, 0.9),
};
const fov = Number(params.get("fov") ?? "30");
const fill = Number(params.get("fill") ?? "0");
const camera = new THREE.PerspectiveCamera(fov, width / height, 0.01, 1000);
const dir = (directions[view] ?? directions.front).clone().normalize();
const halfTan = Math.tan((camera.fov * Math.PI) / 360);
// fill > 0: frame so the object's height fills that fraction of the frame (reference matching).
const fit = fill > 0 ? size.y / 2 / halfTan / fill : (Math.max(size.x, size.y, size.z) / 2 / halfTan) * 1.35;
camera.position.copy(center).addScaledVector(dir, fit);
camera.lookAt(center);
camera.updateProjectionMatrix();

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.ShadowMaterial({ opacity: 0.18 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = box.min.y - 0.001;
floor.receiveShadow = true;
scene.add(floor);

renderer.render(scene, camera);
(window as unknown as { __ready: unknown }).__ready = {
  sizeMm: size.clone().multiplyScalar(scaleToUnits).toArray().map((v) => Math.round(v * 10) / 10),
  // Part-tree manifest for check_part_coverage.py: one entry per spec component node.
  manifest: (() => {
    const parts: { name: string; kind: string; module: string; triangles: number }[] = [];
    let unnamedMeshes = 0;
    const owner = (node: THREE.Object3D): string | undefined => {
      for (let cur: THREE.Object3D | null = node; cur; cur = cur.parent) {
        const id = (cur.userData?.sculptComponent as { id?: string } | undefined)?.id;
        if (id) return id;
      }
      return undefined;
    };
    const tris = new Map<string, number>();
    model.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = owner(mesh);
      if (!id) {
        unnamedMeshes += 1;
        return;
      }
      const geo = mesh.geometry;
      const count = geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3;
      tris.set(id, (tris.get(id) ?? 0) + count);
    });
    for (const [id, triangles] of tris) parts.push({ name: id, kind: "part", module: id, triangles });
    const runtime = (model.userData.sculptRuntime ?? {}) as Record<string, unknown>;
    const nodes = (runtime.nodes ?? {}) as Record<string, THREE.Object3D>;
    const actionReady = {
      runtimeKeys: Object.keys(runtime),
      pivotNodes: Object.keys(nodes).length,
      withCollider: Object.values(nodes).filter((n) => (n.userData?.actionProfile as { collider?: unknown })?.collider).length,
    };
    return { model: model.name, parts, unnamedMeshes, integralMeshes: 0, actionReady };
  })(),
  meshes: (() => {
    let count = 0;
    model.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) count += 1;
    });
    return count;
  })(),
};
