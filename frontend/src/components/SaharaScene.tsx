import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

export type OrbMood = "idle" | "thinking" | "speaking" | "listening";

function Orb({ animate, mood }: { animate: boolean; mood: OrbMood }) {
  const group = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const satellite = useRef<Group>(null);

  useFrame((state, delta) => {
    if (!animate) return;
    const speed = mood === "thinking" ? 1.15 : mood === "listening" ? 0.95 : mood === "speaking" ? 0.75 : 0.35;
    if (group.current) group.current.rotation.y += delta * speed;
    if (core.current) {
      const pulse =
        mood === "thinking"
          ? 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.05
          : mood === "listening"
            ? 1 + Math.sin(state.clock.elapsedTime * 4.4) * 0.035
            : mood === "speaking"
              ? 1 + Math.sin(state.clock.elapsedTime * 5.5) * 0.045
              : 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.015;
      core.current.scale.setScalar(pulse);
      const material = core.current.material;
      if (material && "emissiveIntensity" in material) {
        const glow = mood === "thinking" ? 0.85 : mood === "listening" ? 0.55 : mood === "speaking" ? 0.7 : 0.18;
        material.emissiveIntensity = glow + Math.sin(state.clock.elapsedTime * 2.4) * 0.08;
      }
    }
    if (satellite.current) {
      const turn = state.clock.elapsedTime * (mood === "idle" ? 0.8 : 1.25);
      satellite.current.position.set(Math.cos(turn) * 1.65, Math.sin(turn) * 0.28, Math.sin(turn) * 1.65);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={core}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#e6b39a" emissive="#c9a0d4" emissiveIntensity={0.22} roughness={0.32} metalness={0.16} />
      </mesh>
      <mesh rotation={[1.15, 0.15, 0]}>
        <torusGeometry args={[1.55, 0.016, 24, 120]} />
        <meshStandardMaterial color="#f6f0ea" emissive="#b4a4d4" emissiveIntensity={0.1} roughness={0.42} metalness={0.06} />
      </mesh>
      <mesh rotation={[0.35, 0.9, 0.2]}>
        <torusGeometry args={[1.78, 0.01, 16, 96]} />
        <meshStandardMaterial color="#e0a8bc" transparent opacity={0.5} roughness={0.5} metalness={0.04} />
      </mesh>
      <group ref={satellite}>
        <mesh>
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshStandardMaterial color="#e0a8bc" emissive="#b4a4d4" emissiveIntensity={0.55} />
        </mesh>
      </group>
    </group>
  );
}

export function SaharaScene({ animate, mood = "idle" }: { animate: boolean; mood?: OrbMood }) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 3.5], fov: 38 }}
      style={{ width: "100%", height: "100%" }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      frameloop={animate ? "always" : "demand"}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <ambientLight intensity={0.52} />
      <directionalLight position={[2.5, 2.2, 3.5]} intensity={1.45} />
      <directionalLight position={[-2.4, -1.2, -1.5]} intensity={0.4} color="#b4a4d4" />
      <pointLight position={[0.2, 0.8, 2.2]} intensity={0.42} color="#e6b39a" />
      <pointLight position={[-1.2, 0.4, 1.4]} intensity={0.28} color="#e0a8bc" />
      <Orb animate={animate} mood={mood} />
    </Canvas>
  );
}
