import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Database, Network, Brain, Code, Link, User, Server, Shield, Clock, Zap } from 'lucide-react';
import { SimulationNodeDatum } from 'd3';

// Define node and link interfaces
interface Node extends d3.SimulationNodeDatum {
  id: string;
  icon: string;
  size: number;
  glow: boolean;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
}

export default function GraphMotion() {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const repelIntervalRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  // Define icons mapping
  const icons = {
    'database': Database,
    'network': Network,
    'brain': Brain,
    'code': Code,
    'link': Link,
    'user': User,
    'server': Server,
    'shield': Shield,
    'clock': Clock,
    'zap': Zap
  };
  
  // Create nodes with various icons - fewer nodes for cleaner look
  const iconTypes = Object.keys(icons);
  const nodes: Node[] = Array.from({ length: 12 }, (_, i) => ({
    id: `node${i}`,
    icon: iconTypes[i % iconTypes.length],
    size: i === 0 ? 35 : Math.random() * 12 + 18,
    glow: Math.random() > 0.7,
    // Shift nodes slightly more to the right
    x: 600 + Math.cos((i / 12) * 2 * Math.PI) * 300 + Math.random() * 80,
    y: 400 + Math.sin((i / 12) * 2 * Math.PI) * 220 + Math.random() * 60,
    vx: 0,
    vy: 0,
    fx: undefined,
    fy: undefined
  }));
  
  // Create a more natural graph structure
  const links: Link[] = [];
  
  // Create a spanning tree structure first
  for (let i = 1; i < nodes.length; i++) {
    const target = Math.floor(Math.random() * i);
    links.push({
      source: `node${i}`,
      target: `node${target}`,
      value: Math.random() * 2 + 1,
      index: undefined
    });
  }
  
  // Add some additional random connections for more interesting structure
  const extraLinks = Math.floor(nodes.length * 0.4);
  for (let i = 0; i < extraLinks; i++) {
    const source = Math.floor(Math.random() * nodes.length);
    let target = Math.floor(Math.random() * nodes.length);
    
    while (target === source || links.some(l => 
      (l.source === `node${source}` && l.target === `node${target}`) || 
      (l.source === `node${target}` && l.target === `node${source}`))) {
      target = Math.floor(Math.random() * nodes.length);
    }
    
    links.push({
      source: `node${source}`,
      target: `node${target}`,
      value: Math.random() * 1.5 + 0.5,
      index: undefined
    });
  }

  // Define the createGraph function with proper dependencies
  const createGraph = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    // Match the viewBox dimensions
    const width = 1000;
    const height = 800;

    // Clear any existing content
    svg.selectAll("*").remove();

    // Create definitions for filters and gradients
    const defs = svg.append("defs");
    
    // Create node gradient (more subtle, Obsidian-like)
    const nodeGradient = defs.append("radialGradient")
      .attr("id", "nodeGradient");
    // Use light greys for a subtle effect
    nodeGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#e5e5e5")
      .attr("stop-opacity", 0.85);
    nodeGradient.append("stop")
      .attr("offset", "70%")
      .attr("stop-color", "#cccccc")
      .attr("stop-opacity", 0.6);
    nodeGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#888888")
      .attr("stop-opacity", 0.22);

    // Create subtle glow filter (Obsidian-style)
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "2")
      .attr("result", "blur");
    filter.append("feFlood")
      .attr("flood-color", "#bbbbbb")
      .attr("flood-opacity", "0.7")
      .attr("result", "color");
    filter.append("feComposite")
      .attr("in", "color")
      .attr("in2", "blur")
      .attr("operator", "in")
      .attr("result", "glowColor");
    filter.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "glowColor")
      .attr("operator", "over");

    // Create more intense glow for highlighted nodes
    const intenseGlow = defs.append("filter")
      .attr("id", "intense-glow")
      .attr("x", "-100%")
      .attr("y", "-100%")
      .attr("width", "300%")
      .attr("height", "300%");
    intenseGlow.append("feGaussianBlur")
      .attr("stdDeviation", "6")
      .attr("result", "blur");
    intenseGlow.append("feFlood")
      .attr("flood-color", "#bbbbbb")
      .attr("flood-opacity", "0.7")
      .attr("result", "color");
    intenseGlow.append("feComposite")
      .attr("in", "color")
      .attr("in2", "blur")
      .attr("operator", "in")
      .attr("result", "glowColor");
    intenseGlow.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "glowColor")
      .attr("operator", "over");
    
    // Create the simulation with better centering
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(() => 180 + Math.random() * 80)
        .strength(0.25))
      .force("charge", d3.forceManyBody().strength(() => -400 - Math.random() * 120))
      // Shift center to the right
      .force("center", d3.forceCenter(width / 2 + 80, height / 2))
      .force("collision", d3.forceCollide().radius((node: SimulationNodeDatum) => {
        const n = node as Node;
        return (n.size || 15) + 38;
      }).strength(0.8))
      .force("x", d3.forceX(width / 2 + 80).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .alphaDecay(0.0007) // very slow decay for gentle, continuous movement
      .alphaMin(0.025); // never fully settle
    
    // Create links with Obsidian-style appearance
    const link = svg.append("g")
      .selectAll<SVGLineElement, Link>("line")
      .data(links)
      .join("line")
      .attr("stroke", "rgba(255, 255, 255, 0.2)")
      .attr("stroke-width", d => Math.sqrt(d.value || 1) * 0.8)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.6);
    
    // Create node groups
    const node = svg.append("g")
      .selectAll<SVGGElement, Node>("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "grab")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // Add node circles with Obsidian-style appearance
    node.append("circle")
      .attr("r", d => d.size)
      .attr("fill", "url(#nodeGradient)")
      .attr("filter", d => d.glow ? "url(#intense-glow)" : "url(#glow)")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr("r", d.size * 1.18)
          .attr("filter", "none");
        // Start interval to keep moving node away from mouse
        const nodeId = d.id;
        if (repelIntervalRef.current[nodeId]) clearInterval(repelIntervalRef.current[nodeId]);
        repelIntervalRef.current[nodeId] = setInterval(() => {
          const [mouseX, mouseY] = d3.pointer(event, svgRef.current);
          const dx = (d.x ?? 0) - mouseX;
          const dy = (d.y ?? 0) - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (typeof d.vx !== 'number') d.vx = 0;
          if (typeof d.vy !== 'number') d.vy = 0;
          const force = 12; // stronger force for active fleeing
          d.vx += (dx / dist) * force;
          d.vy += (dy / dist) * force;
          if (simulationRef.current) simulationRef.current.alpha(0.18).restart();
        }, 30);
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition()
          .duration(180)
          .attr("r", d.size)
          .attr("filter", d.glow ? "url(#intense-glow)" : "url(#glow)");
        // Stop the repel interval
        const nodeId = d.id;
        if (repelIntervalRef.current[nodeId]) {
          clearInterval(repelIntervalRef.current[nodeId]);
          delete repelIntervalRef.current[nodeId];
        }
      });
    
    // Add SVG foreign objects for the Lucide icons
    node.append("foreignObject")
      .attr("width", d => d.size * 1.6)
      .attr("height", d => d.size * 1.6)
      .attr("x", d => -(d.size * 0.8))
      .attr("y", d => -(d.size * 0.8))
      .html(d => {
        const iconSize = d.size * 1.0;
        return `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(255,255,255,0.6)); opacity: 0.9;">
            ${getIconPath(d.icon)}
          </svg>
        </div>`;
      });
    
    // Function to get SVG path for a given icon name
    function getIconPath(iconName: string): string {
      switch(iconName) {
        case 'database':
          return '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>';
        case 'network':
          return '<rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path>';
        case 'brain':
          return '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.5"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.5"></path><path d="M2 12h20"></path><path d="M2 12a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"></path>';
        case 'code':
          return '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>';
        case 'link':
          return '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>';
        case 'user':
          return '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>';
        case 'server':
          return '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>';
        case 'shield':
          return '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path>';
        case 'clock':
          return '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
        case 'zap':
          return '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>';
        default:
          return '<circle cx="12" cy="12" r="10"></circle>';
      }
    }
    
    // Add subtle particle effects (fewer and more subtle)
    interface Particle {
      linkIndex: number;
      progress: number;
      speed: number;
      size: number;
      opacity: number;
    }

    const particles: Particle[] = [];
    links.forEach((_, i) => {
      // 50% chance for 1 particle, 20% for 2, else none
      const rand = Math.random();
      let numParticles = 0;
      if (rand < 0.2) numParticles = 2;
      else if (rand < 0.7) numParticles = 1;
      for (let j = 0; j < numParticles; j++) {
        particles.push({
          linkIndex: i,
          progress: Math.random(),
          speed: 0.001 + Math.random() * 0.002,
          size: Math.random() * 1.5 + 1.5, // size range: 1.5 to 3
          opacity: Math.random() * 0.3 + 0.2
        });
      }
    });
    
    const particleElements = svg.append("g")
      .selectAll<SVGCircleElement, Particle>("circle")
      .data(particles)
      .join("circle")
      .attr("r", d => d.size)
      .attr("fill", "white")
      .attr("opacity", d => d.opacity)
      .attr("filter", "url(#glow)");
    
    // Update function
    function ticked() {
      // Update links
      link
        .attr("x1", d => {
          const sourceNode = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
          return sourceNode?.x || 0;
        })
        .attr("y1", d => {
          const sourceNode = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
          return sourceNode?.y || 0;
        })
        .attr("x2", d => {
          const targetNode = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
          return targetNode?.x || 0;
        })
        .attr("y2", d => {
          const targetNode = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
          return targetNode?.y || 0;
        });
      
      // Update nodes
      node.attr("transform", d => `translate(${d.x || 0}, ${d.y || 0})`);
      
      // Update particles
      particles.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
      });
      
      particleElements
        .attr("cx", d => {
          const link = links[d.linkIndex];
          const sourceNode = typeof link.source === 'string' ? nodes.find(n => n.id === link.source) : link.source;
          const targetNode = typeof link.target === 'string' ? nodes.find(n => n.id === link.target) : link.target;
          
          if (!sourceNode || !targetNode) return 0;
          return (sourceNode.x || 0) + ((targetNode.x || 0) - (sourceNode.x || 0)) * d.progress;
        })
        .attr("cy", d => {
          const link = links[d.linkIndex];
          const sourceNode = typeof link.source === 'string' ? nodes.find(n => n.id === link.source) : link.source;
          const targetNode = typeof link.target === 'string' ? nodes.find(n => n.id === link.target) : link.target;
          
          if (!sourceNode || !targetNode) return 0;
          return (sourceNode.y || 0) + ((targetNode.y || 0) - (sourceNode.y || 0)) * d.progress;
        });
    }
    
    // Set up the simulation
    simulation.on("tick", ticked);
    
    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      d3.select(event.sourceEvent.target).style("cursor", "grabbing");
    }
    
    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      d3.select(event.sourceEvent.target).style("cursor", "grab");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    createGraph();
  }, [createGraph]);

  // Clean up all intervals on unmount
  useEffect(() => {
    const intervals = repelIntervalRef.current;
    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg 
        ref={svgRef} 
        className="w-full h-full"
        viewBox="0 0 1000 800" 
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}