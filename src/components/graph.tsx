// // Improved, aesthetic knowledge graph with glowing particles and stylized paths

// import * as d3 from 'd3';
// import { useEffect, useRef } from 'react';

// interface Node extends d3.SimulationNodeDatum {
//   id: string;
// }

// interface Link extends d3.SimulationLinkDatum<Node> {
//   source: string;
//   target: string;
// }

// const nodes: Node[] = Array.from({ length: 30 }, (_, i) => ({ 
//   id: `Node${i}`,
//   x: undefined,
//   y: undefined,
//   vx: undefined,
//   vy: undefined,
//   index: undefined
// }));

// const links: Link[] = Array.from({ length: 50 }, () => {
//   const source = Math.floor(Math.random() * nodes.length);
//   let target = Math.floor(Math.random() * nodes.length);
//   while (target === source) target = Math.floor(Math.random() * nodes.length);
//   return { 
//     source: `Node${source}`, 
//     target: `Node${target}`,
//     index: undefined
//   };
// });

// export default function GraphMotion() {
//   const svgRef = useRef<SVGSVGElement>(null);

//   useEffect(() => {
//     if (!svgRef.current) return;

//     const container = svgRef.current.parentElement;
//     if (!container) return;
    
//     const width = container.clientWidth;
//     const height = container.clientHeight || 600;

//     const svg = d3.select(svgRef.current)
//       .attr('viewBox', `0 0 ${width} ${height}`)
//       .attr('width', '100%')
//       .attr('height', '100%')
//       .attr('preserveAspectRatio', 'xMidYMid meet')
//       .style('background-color', 'transparent');

//     svg.selectAll('*').remove();

//     const simulation = d3.forceSimulation<Node>(nodes)
//       .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(120).strength(0.3))
//       .force('charge', d3.forceManyBody().strength(-180))
//       .force('center', d3.forceCenter(width / 2, height / 2))
//       .force('collision', d3.forceCollide(30));

//     const link = svg.append('g')
//       .attr('stroke', '#ffffff25')
//       .attr('stroke-width', 1.2)
//       .selectAll('path')
//       .data(links)
//       .join('path')
//       .attr('fill', 'none')
//       .attr('stroke-linecap', 'round');

//     const node = svg.append('g')
//       .selectAll('circle')
//       .data(nodes)
//       .join('circle')
//       .attr('r', 7)
//       .attr('fill', 'url(#glowGradient)')
//       .attr('filter', 'url(#glow)');

//     const glowDefs = svg.append('defs');

//     // Theme-matching gradient colors
//     glowDefs.append('radialGradient')
//       .attr('id', 'glowGradient')
//       .selectAll('stop')
//       .data([
//         { offset: '0%', color: '#a855f7', opacity: 1 },    // Brighter purple
//         { offset: '80%', color: '#7e22ce', opacity: 0.5 }, // Medium purple
//         { offset: '100%', color: '#4c1d95', opacity: 0 }   // Dark purple
//       ])
//       .enter()
//       .append('stop')
//       .attr('offset', d => d.offset)
//       .attr('stop-color', d => d.color)
//       .attr('stop-opacity', d => d.opacity);

//     const filter = glowDefs.append('filter')
//       .attr('id', 'glow')
//       .attr('x', '-50%')
//       .attr('y', '-50%')
//       .attr('width', '200%')
//       .attr('height', '200%');

//     filter.append('feGaussianBlur')
//       .attr('in', 'SourceGraphic')
//       .attr('stdDeviation', 5)
//       .attr('result', 'blur');

//     filter.append('feColorMatrix')
//       .attr('in', 'blur')
//       .attr('mode', 'matrix')
//       .attr('values', '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -7')
//       .attr('result', 'glow');

//     filter.append('feBlend')
//       .attr('in', 'SourceGraphic')
//       .attr('in2', 'glow')
//       .attr('mode', 'normal');

//     const particles = svg.append('g')
//       .selectAll('circle.particle')
//       .data(links)
//       .join('circle')
//       .attr('class', 'particle')
//       .attr('r', 3)
//       .attr('fill', '#c084fc')
//       .attr('filter', 'url(#glow)');

//     function ticked() {
//       link.attr('d', (d: any) => {
//         const sourceNode = nodes.find(n => n.id === d.source) || nodes.find(n => n.id === d.source.id);
//         const targetNode = nodes.find(n => n.id === d.target) || nodes.find(n => n.id === d.target.id);
//         if (!sourceNode || !targetNode) return '';
//         return `M${sourceNode.x || 0},${sourceNode.y || 0} Q ${((sourceNode.x || 0) + (targetNode.x || 0)) / 2 + Math.random()*20 - 10}, ${((sourceNode.y || 0) + (targetNode.y || 0)) / 2 + Math.random()*20 - 10} ${targetNode.x || 0},${targetNode.y || 0}`;
//       });

//       node.attr('cx', (d: Node) => d.x || 0)
//          .attr('cy', (d: Node) => d.y || 0);

//       particles.each(function(d: any, i: number) {
//         const sourceNode = nodes.find(n => n.id === d.source) || nodes.find(n => n.id === d.source.id);
//         const targetNode = nodes.find(n => n.id === d.target) || nodes.find(n => n.id === d.target.id);
//         if (!sourceNode || !targetNode) return;
//         const t = (Date.now() / 3000 + i * 0.01) % 1;
//         const x = (sourceNode.x || 0) * (1 - t) + (targetNode.x || 0) * t;
//         const y = (sourceNode.y || 0) * (1 - t) + (targetNode.y || 0) * t;
//         d3.select(this).attr('cx', x).attr('cy', y);
//       });
//     }

//     simulation.on('tick', ticked);

//     const animate = () => {
//       ticked();
//       requestAnimationFrame(animate);
//     };
//     animate();

//     // Handle resize
//     const handleResize = () => {
//       if (!container) return;
//       const newWidth = container.clientWidth;
//       const newHeight = container.clientHeight || 600;
      
//       svg.attr('viewBox', `0 0 ${newWidth} ${newHeight}`);
//       simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
//       simulation.alpha(0.3).restart();
//     };

//     window.addEventListener('resize', handleResize);

//     return () => {
//       simulation.stop();
//       window.removeEventListener('resize', handleResize);
//     };
//   }, []);

//   return (
//     <div className="w-full h-full">
//       <svg ref={svgRef} className="w-full h-full" />
//     </div>
//   );
// }


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
  
  // Create nodes with various icons
  const iconTypes = Object.keys(icons);
  const nodes: Node[] = Array.from({ length: 16 }, (_, i) => ({
    id: `node${i}`,
    icon: iconTypes[i % iconTypes.length],
    size: i === 0 ? 45 : Math.random() * 15 + 20,
    glow: Math.random() > 0.6,
    x: Math.random() * 1200,
    y: Math.random() * 1000,
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
      value: Math.random() * 3 + 1,
      index: undefined
    });
  }
  
  // Add some additional random connections
  const extraLinks = Math.floor(nodes.length * 0.5);
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
      value: Math.random() * 2 + 0.5,
      index: undefined
    });
  }

  // Define the createGraph function with proper dependencies
  const createGraph = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 600;

    // Clear any existing content
    svg.selectAll("*").remove();

    // Create definitions for filters and gradients
    const defs = svg.append("defs");
    
    // Create glow filter
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
      
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "blur");
      
    filter.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "blur")
      .attr("operator", "over");
    
    // Create intense glow filter
    const intenseGlow = defs.append("filter")
      .attr("id", "intense-glow")
      .attr("x", "-100%")
      .attr("y", "-100%")
      .attr("width", "300%")
      .attr("height", "300%");
      
    intenseGlow.append("feGaussianBlur")
      .attr("stdDeviation", "12")
      .attr("result", "blur");
      
    intenseGlow.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "blur")
      .attr("operator", "over");
      
    // Create node gradient
    const nodeGradient = defs.append("radialGradient")
      .attr("id", "nodeGradient");
      
    nodeGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "white")
      .attr("stop-opacity", 1);
      
    nodeGradient.append("stop")
      .attr("offset", "60%")
      .attr("stop-color", "#eee")
      .attr("stop-opacity", 0.9);
      
    nodeGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#aaa")
      .attr("stop-opacity", 0.2);
    
    // Create the simulation
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(() => 150 + Math.random() * 100).strength(0.2))
      .force("charge", d3.forceManyBody().strength(() => -300 - Math.random() * 150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((node: SimulationNodeDatum) => {
        const n = node as Node;
        return (n.size || 15) + 25;
      }).strength(0.8))
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03))
      .alphaDecay(0.008);
    
    // Create links with improved visibility
    const link = svg.append("g")
      .selectAll<SVGPathElement, Link>("path")
      .data(links)
      .join("path")
      .attr("stroke", "rgba(255, 255, 255, 0.3)") // Brighter links
      .attr("stroke-width", d => Math.sqrt(d.value || 1) * 1.2) // Thicker lines
      .attr("fill", "none")
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", "1, 4"); // More visible dash pattern
    
    // Create node groups
    const node = svg.append("g")
      .selectAll<SVGGElement, Node>("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // Add node circles
    node.append("circle")
      .attr("r", d => d.size)
      .attr("fill", "url(#nodeGradient)")
      .attr("filter", d => d.glow ? "url(#intense-glow)" : "url(#glow)")
      .attr("opacity", 0.9);
    
    // Add SVG foreign objects for the Lucide icons
    node.append("foreignObject")
      .attr("width", d => d.size * 2)
      .attr("height", d => d.size * 2)
      .attr("x", d => -(d.size))
      .attr("y", d => -(d.size))
      .html(d => {
        const iconSize = d.size * 1.2;
        return `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 8px rgba(255,255,255,0.8));">
            ${getIconPath(d.icon)}
          </svg>
        </div>`;
      });
    
    // Create particles along the links
    const particlesGroup = svg.append("g").attr("class", "particles");
    
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
    
    // Add particles with improved flow
    interface Particle {
      linkIndex: number;
      progress: number;
      speed: number;
      size: number;
      brightness: number;
      delay: number;
    }

    const particles: Particle[] = [];
    links.forEach((_, i) => {
      const numParticles = Math.floor(Math.random() * 2) + 1; // Fewer particles for smoother flow
      for (let j = 0; j < numParticles; j++) {
        particles.push({
          linkIndex: i,
          progress: Math.random(),
          speed: 0.0003 + Math.random() * 0.0005, // Slower, more consistent speed
          size: Math.random() * 2 + 1, // Smaller particles
          brightness: Math.random() * 0.4 + 0.6, // More consistent brightness
          delay: Math.random() * 1000 // Shorter delay
        });
      }
    });
    
    const particleElements = particlesGroup
      .selectAll<SVGCircleElement, Particle>("circle")
      .data(particles)
      .join("circle")
      .attr("r", d => d.size)
      .attr("fill", "white")
      .attr("opacity", d => d.brightness * 0.8)
      .attr("filter", "url(#glow)");
    
    // Add mouseover interactions for nodes
    node.on("mouseover", function(event, d) {
      d3.select(this).select("circle")
        .transition()
        .duration(300)
        .attr("r", d.size * 1.3)
        .attr("filter", "url(#intense-glow)");
      
      simulation.alpha(0.3).restart();
    }).on("mouseout", function(event, d) {
      d3.select(this).select("circle")
        .transition()
        .duration(500)
        .attr("r", d.size)
        .attr("filter", d.glow ? "url(#intense-glow)" : "url(#glow)");
    });
    
    // Link interaction
    link.on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "rgba(255, 255, 255, 0.6)")
        .attr("stroke-width", (d.value || 1) * 2);
        
      const sourceNode = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
      const targetNode = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
      
      if (sourceNode && targetNode) {
        simulation
          .force("link", d3.forceLink<Node, Link>(links)
            .id(d => d.id)
            .distance(l => {
              if ((l.source === sourceNode && l.target === targetNode) || 
                  (l.source === targetNode && l.target === sourceNode)) {
                return 50;
              }
              return 150 + Math.random() * 100;
            })
            .strength(l => {
              if ((l.source === sourceNode && l.target === targetNode) || 
                  (l.source === targetNode && l.target === sourceNode)) {
                return 1;
              }
              return 0.2;
            }));
        
        simulation.alpha(0.1).restart();
      }
    }).on("mouseout", function(event, d) {
      d3.select(this)
        .transition()
        .duration(500)
        .attr("stroke", "rgba(255, 255, 255, 0.3)")
        .attr("stroke-width", Math.sqrt(d.value || 1) * 1.2);
        
      simulation
        .force("link", d3.forceLink<Node, Link>(links)
          .id(d => d.id)
          .distance(() => 150 + Math.random() * 100)
          .strength(0.2));
          
      simulation.alpha(0.1).restart();
    });
    
    // Update function with improved particle flow
    function ticked() {
      // Update links with smooth curves
      link.attr("d", d => {
        const sourceNode = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
        const targetNode = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
        
        if (!sourceNode || !targetNode) return '';
        
        const dx = (targetNode.x || 0) - (sourceNode.x || 0);
        const dy = (targetNode.y || 0) - (sourceNode.y || 0);
        const controlX = (sourceNode.x || 0) + dx * 0.5 + dy * 0.2;
        const controlY = (sourceNode.y || 0) + dy * 0.5 - dx * 0.2;
        
        return `M ${sourceNode.x || 0} ${sourceNode.y || 0} Q ${controlX} ${controlY} ${targetNode.x || 0} ${targetNode.y || 0}`;
      });
      
      // Update nodes
      node.attr("transform", d => `translate(${d.x || 0}, ${d.y || 0})`);
      
      // Update particles along links
      particleElements.attr("cx", d => {
        const link = links[d.linkIndex];
        const sourceNode = typeof link.source === 'string' ? nodes.find(n => n.id === link.source) : link.source;
        const targetNode = typeof link.target === 'string' ? nodes.find(n => n.id === link.target) : link.target;
        
        if (!sourceNode || !targetNode) return 0;
        
        return (sourceNode.x || 0) + ((targetNode.x || 0) - (sourceNode.x || 0)) * d.progress;
      }).attr("cy", d => {
        const link = links[d.linkIndex];
        const sourceNode = typeof link.source === 'string' ? nodes.find(n => n.id === link.source) : link.source;
        const targetNode = typeof link.target === 'string' ? nodes.find(n => n.id === link.target) : link.target;
        
        if (!sourceNode || !targetNode) return 0;
        
        return (sourceNode.y || 0) + ((targetNode.y || 0) - (sourceNode.y || 0)) * d.progress;
      });
    }
    
    // Set up the simulation
    simulation.on("tick", ticked);
    
    // Create animation loop
    function animate() {
      ticked();
      requestAnimationFrame(animate);
    }
    animate();
    
    // Drag functions with proper type handling
    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    createGraph();
  }, [createGraph]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <svg 
        ref={svgRef} 
        className="w-full h-full"
        viewBox="0 0 1200 1000" 
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}