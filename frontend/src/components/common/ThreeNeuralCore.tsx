import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeNeuralCoreProps {
  variant?: 'mini' | 'hero' | 'cinematic';
  isProcessing?: boolean;
  className?: string;
  onClick?: () => void;
}

export const ThreeNeuralCore: React.FC<ThreeNeuralCoreProps> = ({
  variant = 'mini',
  isProcessing = false,
  className = '',
  onClick,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || (variant === 'mini' ? 44 : variant === 'hero' ? 240 : 500);
    const height = mount.clientHeight || (variant === 'mini' ? 44 : variant === 'hero' ? 240 : 500);

    // 1. Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = variant === 'mini' ? 3.2 : 3.8;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // 2. Geometry: Fibonacci Neural Sphere
    const particleCount = variant === 'mini' ? 120 : variant === 'hero' ? 320 : 600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const radius = 1.25;
    const colorSapphire = new THREE.Color('#1664ff');
    const colorIndigo = new THREE.Color('#722ed1');
    const colorCyan = new THREE.Color('#00f2fe');

    for (let i = 0; i < particleCount; i++) {
      // Golden ratio spiral on sphere
      const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      // Color gradient
      const mixRatio = (y / radius + 1) / 2;
      const c = colorSapphire.clone().lerp(mixRatio > 0.5 ? colorIndigo : colorCyan, mixRatio);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Material with Soft Glow Shader texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(22, 100, 255, 0.8)');
      gradient.addColorStop(0.7, 'rgba(114, 46, 209, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(canvas);

    const pointMaterial = new THREE.PointsMaterial({
      size: variant === 'mini' ? 0.16 : 0.14,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, pointMaterial);
    scene.add(particles);

    // 3. Neural Synapses (Connecting Lines)
    let lineSegments: THREE.LineSegments | null = null;
    if (variant !== 'mini') {
      const linePositions: number[] = [];
      const lineColors: number[] = [];
      const maxDistance = 0.55;

      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            linePositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            linePositions.push(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);

            const alpha = 1 - dist / maxDistance;
            lineColors.push(0.1, 0.4, 1.0 * alpha);
            lineColors.push(0.4, 0.2, 0.9 * alpha);
          }
        }
      }

      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

      const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });

      lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      scene.add(lineSegments);
    }

    // 4. Mouse Interactive parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / height - 0.5) * 2;
      targetRotationY = mouseX * 0.8;
      targetRotationX = mouseY * 0.8;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 5. Animation loop
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = (performance.now() - startTime) * 0.001;

      const speedMultiplier = isProcessingRef.current ? 3.0 : 1.0;

      // Base rotation
      particles.rotation.y += 0.006 * speedMultiplier;
      particles.rotation.x += 0.003 * speedMultiplier;

      // Smooth mouse follow
      particles.rotation.y += (targetRotationY - particles.rotation.y) * 0.05;
      particles.rotation.x += (targetRotationX - particles.rotation.x) * 0.05;

      if (lineSegments) {
        lineSegments.rotation.y = particles.rotation.y;
        lineSegments.rotation.x = particles.rotation.x;
      }

      // Breathing / Pulse effect
      const pulse = 1 + Math.sin(elapsedTime * 2 * speedMultiplier) * (isProcessingRef.current ? 0.08 : 0.03);
      particles.scale.set(pulse, pulse, pulse);
      if (lineSegments) {
        lineSegments.scale.set(pulse, pulse, pulse);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 6. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      geometry.dispose();
      pointMaterial.dispose();
      particleTexture.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return (
    <div
      ref={mountRef}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 ${className}`}
      title="GoTek AI Neural Core · Khám phá không gian tri thức 3D"
    />
  );
};
