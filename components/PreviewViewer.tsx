"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  glbUrl: string;
  name: string;
  publicId: string;
  projectName: string;
  fileBytes?: number;
};

export function PreviewViewer({ glbUrl, name, publicId, projectName, fileBytes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meta, setMeta] = useState("Unpacking the asset…");
  const [ready, setReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [wire, setWire] = useState(false);
  const rotateRef = useRef(true);
  const pauseRef = useRef(false);
  const wireRef = useRef(false);
  const resetRef = useRef<(() => void) | null>(null);
  const shotRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    rotateRef.current = autoRotate;
  }, [autoRotate]);
  useEffect(() => {
    pauseRef.current = paused;
  }, [paused]);
  useEffect(() => {
    wireRef.current = wire;
  }, [wire]);

  useEffect(() => {
    let dead = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (dead || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x070b14);
      const camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / Math.max(canvas.clientHeight, 1), 0.01, 200);
      const startPos = new THREE.Vector3(2.1, 1.35, 2.4);
      camera.position.copy(startPos);
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x1a2233, 1.05));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(3.2, 6, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x4fc3f7, 0.35);
      fill.position.set(-4, 2, -2);
      scene.add(fill);
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(3.2, 64),
        new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.92, metalness: 0.05 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const grid = new THREE.GridHelper(6, 24, 0x1e3a54, 0x142033);
      scene.add(grid);
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, 0.7, 0);
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.minDistance = 0.8;
      controls.maxDistance = 12;
      const gltf = await new GLTFLoader().loadAsync(glbUrl);
      if (dead) return;
      const root = gltf.scene;
      scene.add(root);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.position.y += size.y / 2;
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const scale = 1.6 / maxDim;
      root.scale.setScalar(scale);
      controls.target.set(0, (size.y * scale) / 2, 0);
      const fit = () => {
        camera.position.set(2.1, 1.35, 2.4);
        controls.target.set(0, (size.y * scale) / 2, 0);
        controls.update();
      };
      fit();
      resetRef.current = fit;
      shotRef.current = () => {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `${publicId}.png`;
        a.click();
      };
      const materials: { mat: { wireframe: boolean } }[] = [];
      root.traverse((obj: { isMesh?: boolean; material?: { wireframe: boolean } | { wireframe: boolean }[] }) => {
        if (!obj.isMesh || !obj.material) return;
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        list.forEach((mat) => materials.push({ mat }));
      });
      setMeta(`${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);
      setReady(true);
      const onResize = () => {
        if (!canvas.parentElement) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      window.addEventListener("resize", onResize);
      const loop = () => {
        if (dead) return;
        if (!pauseRef.current) {
          controls.autoRotate = rotateRef.current;
          controls.autoRotateSpeed = 1.6;
          controls.update();
        }
        materials.forEach(({ mat }) => {
          mat.wireframe = wireRef.current;
        });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();
      return () => window.removeEventListener("resize", onResize);
    })().catch((err) => setMeta(err instanceof Error ? err.message : "preview failed"));
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      renderer?.dispose();
    };
  }, [glbUrl, publicId]);

  return (
    <div className="stage-wrap">
      <div className="stage" onClick={() => setPaused(false)}>
        <canvas id="preview-canvas" ref={canvasRef} />
        {!ready ? <p className="stage-loading">{meta}</p> : null}
        <p className="stage-hint">DRAG TO ORBIT · SCROLL TO ZOOM</p>
        <div className="stage-toolbar">
          <button type="button" className="btn" onClick={() => setPaused((v) => !v)}>
            {paused ? "Play" : "Pause"}
          </button>
          <button type="button" className="btn" onClick={() => setAutoRotate((v) => !v)}>
            {autoRotate ? "Auto rotate on" : "Auto rotate off"}
          </button>
          <button type="button" className="btn" onClick={() => setWire((v) => !v)}>
            {wire ? "Solid" : "Wireframe"}
          </button>
          <button type="button" className="btn" onClick={() => resetRef.current?.()}>
            Reset view
          </button>
          <button type="button" className="btn" onClick={() => shotRef.current?.()}>
            PNG
          </button>
        </div>
      </div>
      <aside className="file-card">
        <p className="kicker">Character file</p>
        <h2>{name}</h2>
        <p className="muted">
          {publicId} · {projectName}
        </p>
        <dl className="file-meta">
          <div>
            <dt>Format</dt>
            <dd>GLB · PBR</dd>
          </div>
          <div>
            <dt>Bounds</dt>
            <dd>{meta}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{fileBytes ? `${(fileBytes / 1024).toFixed(1)} KB` : "—"}</dd>
          </div>
        </dl>
        <div className="row">
          <a className="btn sauce" href={glbUrl} download={`${publicId}.glb`}>
            Download character
          </a>
        </div>
      </aside>
    </div>
  );
}
