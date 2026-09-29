import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

interface VectorSpace3DModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VectorNodeData {
  id: string;
  title: string;
  category: string;
  similarity: string;
  chunkId: string;
  position: [number, number, number];
  color: string;
  excerpt: string;
}

const SAMPLE_NODES: VectorNodeData[] = [
  {
    id: 'node-1',
    title: 'Thoả thuận Bảo mật NDA Techcombank',
    category: 'Legal / Enterprise',
    similarity: '99.4%',
    chunkId: 'chk_tcb_nda_001',
    position: [1.8, 1.2, 0.5],
    color: '#00f2fe',
    excerpt: 'Điều khoản bảo mật FSI cấp độ 3, cam kết không lưu trữ dữ liệu banking ngoài lãnh thổ Việt Nam.',
  },
  {
    id: 'node-2',
    title: 'Dự toán Hạ tầng Kubernetes 250 Seats',
    category: 'Commercial / Pricing',
    similarity: '98.1%',
    chunkId: 'chk_pricing_250_k8s',
    position: [1.2, -1.4, 0.8],
    color: '#1664ff',
    excerpt: 'Hỗ trợ Kubernetes On-Premise, cam kết SLA 99.99%, RAG không giới hạn token, HA 3 nodes.',
  },
  {
    id: 'node-3',
    title: 'Quy trình Staff Handoff Tier 3',
    category: 'Operations',
    similarity: '95.7%',
    chunkId: 'chk_ops_handoff_t3',
    position: [-1.5, 1.0, -0.6],
    color: '#722ed1',
    excerpt: 'Chuyển giao phiên chat trực tiếp từ AI Bot sang Chuyên viên Tư vấn khi phát hiện intent đàm phán hợp đồng.',
  },
  {
    id: 'node-4',
    title: 'CloudFlow Retry Policy Webhook',
    category: 'Technical API',
    similarity: '92.3%',
    chunkId: 'chk_api_webhook_retry',
    position: [-1.8, -1.1, -0.4],
    color: '#f53f3f',
    excerpt: 'Chính sách exponential backoff với jitter tối đa 5 lần thử cho các webhook giao dịch tài chính.',
  },
  {
    id: 'node-5',
    title: 'FPT Software Khung Hợp Đồng SLA 99.99%',
    category: 'Enterprise SLA',
    similarity: '97.2%',
    chunkId: 'chk_fpt_sla_framework',
    position: [0.3, 1.9, -1.2],
    color: '#00b42a',
    excerpt: 'Thời gian phản hồi sự cố khẩn cấp P1 dưới 15 phút, đội ngũ trực 24/7/365.',
  },
  {
    id: 'node-6',
    title: 'Hệ thống Nhúng text-embedding-3-large',
    category: 'AI Pipeline',
    similarity: '99.8%',
    chunkId: 'chk_ai_embeddings_1536',
    position: [-0.4, -0.2, 1.7],
    color: '#faad14',
    excerpt: 'Mô hình vector hoá 1536 chiều, chỉ mục pgvector HNSW trên cơ sở dữ liệu PostgreSQL 16.',
  },
];

export const VectorSpace3DModal: React.FC<VectorSpace3DModalProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<VectorNodeData | null>(SAMPLE_NODES[0]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080c16, 0.12);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // 1. Ambient Cyber Starfield / Particles (Background)
    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 20;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x4f46e5,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 2. Interactive Coordinate Space Grid Rings
    const ringGeo = new THREE.RingGeometry(2.8, 2.82, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x1664ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // 3. Knowledge Cluster Nodes (Spheres with Light halo)
    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    const nodeMeshes: { mesh: THREE.Mesh; data: VectorNodeData }[] = [];

    SAMPLE_NODES.forEach((node) => {
      const geo = new THREE.SphereGeometry(0.16, 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...node.position);

      // Glow halo
      const haloGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color),
        transparent: true,
        opacity: 0.3,
        wireframe: true,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      mesh.add(halo);

      nodeGroup.add(mesh);
      nodeMeshes.push({ mesh, data: node });
    });

    // 4. Connecting Vector Synapses lines
    const linePositions: number[] = [];
    SAMPLE_NODES.forEach((n1, i) => {
      SAMPLE_NODES.forEach((n2, j) => {
        if (i < j) {
          linePositions.push(...n1.position);
          linePositions.push(...n2.position);
        }
      });
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x243b6b,
      transparent: true,
      opacity: 0.35,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    nodeGroup.add(lines);

    // 5. Interactive Raycaster & Mouse Drag Orbit
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        nodeGroup.rotation.y += deltaX * 0.008;
        nodeGroup.rotation.x += deltaY * 0.008;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((nm) => nm.mesh));
      if (intersects.length > 0) {
        const found = nodeMeshes.find((nm) => nm.mesh === intersects[0].object);
        if (found) {
          setSelectedNode(found.data);
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('click', onClick);

    // 6. Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isDragging) {
        nodeGroup.rotation.y += 0.0018;
      }

      ring.rotation.z += 0.001;
      starField.rotation.y -= 0.0003;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('click', onClick);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-[#040711]/90 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-6xl h-[88vh] bg-gradient-to-b from-[#0a0f1d] to-[#040711] border border-blue-500/30 rounded-3xl shadow-[0_0_80px_rgba(22,100,255,0.25)] flex flex-col overflow-hidden text-white"
        >
          {/* Top Cinematic Header */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <div>
                <h2 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                  <span>GoTek RAG 3D Vector Knowledge Space</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-mono">
                    1536-Dimensional Embeddings
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Trực quan hoá không gian vector tri thức đa chiều thời gian thực (Three.js WebGL)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>pgvector HNSW Online</span>
              </span>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                title="Đóng không gian 3D"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Main 3D Canvas Body */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Three.js Canvas Container */}
            <div ref={mountRef} className="flex-1 h-full w-full cursor-grab active:cursor-grabbing relative" />

            {/* Canvas Overlay Hints */}
            <div className="absolute top-4 left-6 pointer-events-none space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs text-slate-300">
                <span className="material-symbols-outlined text-[15px] text-blue-400">pan_tool</span>
                <span>Kéo chuột để xoay 360° · Bấm vào điểm sáng để chọn tài liệu</span>
              </div>
            </div>

            {/* Right Inspector Drawer (Node Details) */}
            <div className="w-96 h-full bg-[#070b16]/95 border-l border-white/10 p-6 flex flex-col overflow-y-auto space-y-5 custom-scrollbar backdrop-blur-xl">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                  Vector Node Inspector
                </span>
                <h3 className="font-bold text-lg text-white mt-1 leading-snug">
                  {selectedNode?.title || 'Chọn một điểm vector trên không gian'}
                </h3>
              </div>

              {selectedNode && (
                <>
                  {/* Similarity Metric Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Cosine Similarity</span>
                      <span className="text-emerald-400 font-bold font-mono text-sm">
                        {selectedNode.similarity} Match
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: selectedNode.similarity }}
                      />
                    </div>
                  </div>

                  {/* Metadata key-values */}
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-slate-400">Chuyên mục:</span>
                      <span className="font-semibold text-slate-200">{selectedNode.category}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-slate-400">Chunk ID:</span>
                      <span className="font-mono text-blue-400">{selectedNode.chunkId}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-slate-400">Vector Coordinates:</span>
                      <span className="font-mono text-slate-300">
                        [{selectedNode.position.map((p) => p.toFixed(2)).join(', ')}]
                      </span>
                    </div>
                  </div>

                  {/* Excerpt */}
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Nội dung trích đoạn (RAG Context)
                    </h5>
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 leading-relaxed font-mono">
                      "{selectedNode.excerpt}"
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedNode.excerpt);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1664ff] hover:bg-[#3370ff] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      <span>Sao chép trích đoạn</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
