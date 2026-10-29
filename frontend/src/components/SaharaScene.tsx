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
        <meshStandardMaterial color="#ff8a4c" emissive="#ff8a4c" emissiveIntensity={0.28} roughness={0.28} metalness={0.2} />
      </mesh>
      <mesh rotation={[1.15, 0.15, 0]}>
        <torusGeometry args={[1.55, 0.018, 24, 120]} />
        <meshStandardMaterial color="#f7efe7" emissive="#ff8a4c" emissiveIntensity={0.08} roughness={0.4} metalness={0.08} />
      </mesh>
      <mesh rotation={[0.35, 0.9, 0.2]}>
        <torusGeometry args={[1.78, 0.01, 16, 96]} />
        <meshStandardMaterial color="#ffc4a0" transparent opacity={0.55} roughness={0.5} metalness={0.05} />
      </mesh>
      <group ref={satellite}>
        <mesh>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshStandardMaterial color="#ff8a4c" emissive="#ff8a4c" emissiveIntensity={0.7} />
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
      <ambientLight intensity={0.48} />
      <directionalLight position={[2.5, 2.2, 3.5]} intensity={1.7} />
      <directionalLight position={[-2.4, -1.2, -1.5]} intensity={0.45} color="#ffc4a0" />
      <pointLight position={[0.2, 0.8, 2.2]} intensity={0.55} color="#ff8a4c" />
      <Orb animate={animate} mood={mood} />
    </Canvas>
  );
}
