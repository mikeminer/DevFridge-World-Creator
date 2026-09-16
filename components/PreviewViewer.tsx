"use client";

import { useEffect, useRef, useState } from "react";

export function PreviewViewer({ glbUrl }: { glbUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meta, setMeta] = useState("Loading 3D preview…");

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
      const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
      camera.position.set(1.6, 1.2, 1.8);
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.1));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(2, 4, 3);
      scene.add(dir);
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      const gltf = await new GLTFLoader().loadAsync(glbUrl);
      scene.add(gltf.scene);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      setMeta(`Loaded · bounds ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);
      const loop = () => {
        if (dead) return;
        controls.update();
        renderer!.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();
    })().catch((err) => setMeta(err instanceof Error ? err.message : "preview failed"));
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      renderer?.dispose();
    };
  }, [glbUrl]);

  return (
    <>
      <canvas id="preview-canvas" ref={canvasRef} />
      <p className="muted">{meta}</p>
    </>
  );
}
