"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';
import { type Transaction } from '@mysten/sui/transactions';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient
} from '@mysten/dapp-kit';
import { CompleteGraphService } from '@/services/complete-graph-service';
import {
  GraphNode,
  GraphRelationship,
  QueryResult,
  GraphStats
} from '@/services/types';
import {
  Play,
  Save,
  Database,
  Search,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

// Dynamically import Monaco Editor
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface EditorState {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  selectedNode: GraphNode | null;
  selectedRelationship: GraphRelationship | null;
  queryResult: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  stats: GraphStats | null;
}

interface D3Node extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  source: D3Node;
  target: D3Node;
  relationship: GraphRelationship;
}

interface TransactionParams {
  transaction: unknown;
}

export default function GraphEditorPage() {
  // Refs for D3
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  // Wallet integration
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) => {
      // Use the custom execution with proper options
      return await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showObjectChanges: true,
          showEvents: true,
          showInput: true,
        },
      });
    },
  });

  // Create a proper signAndExecute function for the SUI service
  const signAndExecute = (params: TransactionParams): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      console.log('🔄 Wallet: Executing transaction...', params);
      
      signAndExecuteTransaction(
        {
          transaction: params.transaction as Transaction,
          chain: 'sui:testnet', // Specify the chain
        },
        {
          onSuccess: (result) => {
            console.log('✅ Wallet: Transaction successful:', result);
            console.log('📋 Object changes:', result.objectChanges);
            resolve(result);
          },
          onError: (error) => {
            console.error('❌ Wallet: Transaction failed:', error);
            reject(error);
          },
        }
      );
    });
  };

  // Services
  const [graphService] = useState(() => new CompleteGraphService());

  // State
  const [state, setState] = useState<EditorState>({
    nodes: [],
    relationships: [],
    selectedNode: null,
    selectedRelationship: null,
    queryResult: null,
    isLoading: false,
    error: null,
    stats: null
  });

  // UI State
  const [activeTab, setActiveTab] = useState<'query' | 'create' | 'stats' | 'save'>('create');
  const [queryText, setQueryText] = useState('// Create nodes\nCREATE (p:Person {name: "Alice", age: 30})\nCREATE (c:Company {name: "TechCorp"})\n\n// Create relationship\nMATCH (p:Person), (c:Company)\nWHERE p.name = "Alice" AND c.name = "TechCorp"\nCREATE (p)-[:WORKS_AT]->(c)');
  const [createForm, setCreateForm] = useState({
    nodeType: 'Person',
    nodeProps: '{"name": "John", "age": 25}',
    relType: 'KNOWS',
    relProps: '{"since": "2020"}',
    sourceNodeId: '',
    targetNodeId: ''
  });
  const [saveForm, setSaveForm] = useState({
    name: 'My Graph',
    description: 'A sample graph database',
    isPublic: false,
    tags: 'graph,demo'
  });

  // Define updateState function
  const updateState = useCallback(() => {
    const stats = graphService.getStats();
    setState(prev => ({
      ...prev,
      nodes: graphService.getNodes(),
      relationships: graphService.getRelationships(),
      stats
    }));
  }, [graphService]);

  // Initialize graph service
  useEffect(() => {
    updateState();
    console.log('📋 Graph editor initialized. Click "Create Sample Graph" to see visualization.');
  }, [updateState]);

  // Define updateVisualization function
  const updateVisualization = useCallback(() => {
    if (!svgRef.current || !simulationRef.current) return;

    console.log('🔄 Updating visualization with:', state.nodes.length, 'nodes and', state.relationships.length, 'relationships');

    const svg = d3.select(svgRef.current);
    const container = svg.select(".graph-container");
    const rect = svg.node()?.getBoundingClientRect();
    const width = rect?.width || 800;
    const height = rect?.height || 600;

    // Prepare data with better initial positioning
    const nodes: D3Node[] = state.nodes.map((node, i) => {
      const angle = (i / state.nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.2;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius
      };
    });

    const links: D3Link[] = state.relationships.map(rel => ({
      source: nodes.find(n => n.id === rel.sourceId)!,
      target: nodes.find(n => n.id === rel.targetId)!,
      relationship: rel
    })).filter(link => link.source && link.target);

    console.log('📊 Processed data:', {
      nodes: nodes.length,
      links: links.length,
      dimensions: { width, height }
    });

    // Update simulation
    simulationRef.current.nodes(nodes);
    simulationRef.current.force<d3.ForceLink<D3Node, D3Link>>("link")?.links(links);

    // Create link elements with Obsidian-style appearance
    const link = container.selectAll<SVGLineElement, D3Link>(".link")
      .data(links, d => `${d.source.id}-${d.target.id}`);

    link.exit()
      .transition()
      .duration(300)
      .attr("stroke-opacity", 0)
      .remove();

    const linkEnter = link.enter().append("line")
      .attr("class", "link")
      .attr("stroke", "rgba(139, 92, 246, 0.6)") // Purple like Obsidian
      .attr("stroke-opacity", 0)
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .style("filter", "url(#glow)")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-width", 4)
          .attr("stroke", "rgba(139, 92, 246, 1)");

        // Show tooltip
        showTooltip(event, `${d.relationship.type}`);
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-width", 2)
          .attr("stroke", "rgba(139, 92, 246, 0.6)");

        hideTooltip();
      })
      .on("click", (event, d) => {
        setState(prev => ({ ...prev, selectedRelationship: d.relationship }));
      });

    linkEnter
      .transition()
      .duration(500)
      .attr("stroke-opacity", 0.6);

    const linkUpdate = linkEnter.merge(link);

    // Create node elements with Obsidian-style design
    const node = container.selectAll<SVGGElement, D3Node>(".node")
      .data(nodes, d => d.id);

    node.exit()
      .transition()
      .duration(300)
      .attr("opacity", 0)
      .remove();

    const nodeEnter = node.enter().append("g")
      .attr("class", "node graph-node")
      .attr("opacity", 0)
      .style("cursor", "grab")
      .call(d3.drag<SVGGElement, D3Node>()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
      );

    // Add outer glow circle
    nodeEnter.append("circle")
      .attr("class", "node-glow")
      .attr("r", 35)
      .attr("fill", "none")
      .attr("stroke", d => getNodeColor(d.type))
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)
      .style("filter", "url(#glow)");

    // Add main node circle
    nodeEnter.append("circle")
      .attr("class", "node-main")
      .attr("r", 20)
      .attr("fill", d => getNodeColor(d.type))
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2)
      .style("filter", "url(#glow)")
      .on("click", (event, d) => onClickNode(d.id))
      .on("mouseover", function(event, d) {
        // Elastic expand animation
        d3.select(this)
          .transition()
          .duration(200)
          .ease(d3.easeElastic.amplitude(1).period(0.3))
          .attr("r", 25);

        d3.select(this.parentNode as SVGGElement).select(".node-glow")
          .transition()
          .duration(200)
          .attr("r", 45)
          .attr("stroke-opacity", 0.6);

        // Show tooltip
        showTooltip(event, `${d.properties.name || d.id}\nType: ${d.type}`);
      })
      .on("mouseout", function() {
        // Elastic contract animation
        d3.select(this)
          .transition()
          .duration(300)
          .ease(d3.easeElastic.amplitude(1).period(0.4))
          .attr("r", 20);

        d3.select(this.parentNode as SVGGElement).select(".node-glow")
          .transition()
          .duration(300)
          .attr("r", 35)
          .attr("stroke-opacity", 0.3);

        hideTooltip();
      });

    // Add node labels
    nodeEnter.append("text")
      .attr("class", "node-label")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .style("pointer-events", "none")
      .style("text-shadow", "0 0 4px rgba(0, 0, 0, 0.8)")
      .text(d => d.properties.name || d.id.slice(0, 6));

    // Animate node entrance
    nodeEnter
      .transition()
      .duration(500)
      .delay((d, i) => i * 100)
      .attr("opacity", 1);

    const nodeUpdate = nodeEnter.merge(node);

    // Create tooltip
    const tooltip = d3.select("body").selectAll<HTMLDivElement, number>(".graph-tooltip").data([0]);
    const tooltipEnter = tooltip.enter()
      .append("div")
      .attr("class", "graph-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(17, 24, 39, 0.95)")
      .style("color", "white")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("border", "1px solid rgba(139, 92, 246, 0.5)")
      .style("backdrop-filter", "blur(4px)")
      .style("z-index", "1000");

    const tooltipUpdate = tooltipEnter.merge(tooltip) as d3.Selection<HTMLDivElement, number, d3.BaseType, unknown>;
    function showTooltip(event: MouseEvent, text: string) {
      tooltipUpdate
        .html(text.replace(/\n/g, '<br>'))
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .transition()
        .duration(200)
        .style("opacity", 1);
    }

    function hideTooltip() {
      tooltipUpdate
        .transition()
        .duration(200)
        .style("opacity", 0);
    }

    // Update positions on tick with smooth animation
    simulationRef.current.on("tick", () => {
      linkUpdate
        .attr("x1", d => d.source.x!)
        .attr("y1", d => d.source.y!)
        .attr("x2", d => d.target.x!)
        .attr("y2", d => d.target.y!);

      nodeUpdate
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Restart simulation with higher energy for smooth animation
    simulationRef.current.alpha(0.8).restart();

    console.log('🚀 Simulation restarted with alpha:', simulationRef.current.alpha());

    function dragStarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulationRef.current?.alphaTarget(0.5).restart();
      d.fx = d.x;
      d.fy = d.y;

      // Change cursor during drag
      d3.select(event.sourceEvent.target).style("cursor", "grabbing");
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulationRef.current?.alphaTarget(0);
      d.fx = null;
      d.fy = null;

      // Reset cursor
      d3.select(event.sourceEvent.target).style("cursor", "grab");

      // Add a little bounce effect
      simulationRef.current?.alpha(0.3).restart();
    }
  }, [state.nodes, state.relationships, onClickNode]);

  // Initialize D3 visualization with responsive sizing
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);

    // Get actual container dimensions
    const rect = container.getBoundingClientRect();
    const width = Math.max(800, rect.width - 40); // Minimum 800px width
    const height = Math.max(600, rect.height - 40); // Minimum 600px height

    console.log('🖼️ Initializing D3 with dimensions:', { width, height });

    // Set SVG size and viewBox to match container
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Clear previous content
    svg.selectAll("*").remove();

    // Create background with subtle grid
    const defs = svg.append('defs');

    // Add glow filters for Obsidian-like effects
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');

    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Add subtle grid pattern
    const pattern = defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', 40)
      .attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse');

    pattern.append('path')
      .attr('d', 'M 40 0 L 0 0 0 40')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(100, 255, 255, 0.1)')
      .attr('stroke-width', 1);

    // Add background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#grid)')
      .attr('opacity', 0.3);

    // Create container group for zooming/panning
    const graphContainer = svg.append("g").attr("class", "graph-container");

    // Add zoom behavior with smooth transitions
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        graphContainer.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create simulation with Obsidian-like physics
    const simulation = d3.forceSimulation<D3Node>()
      .force("link", d3.forceLink<D3Node, D3Link>()
        .id(d => d.id)
        .distance(150) // Increased distance for better spacing
        .strength(0.6) // Reduced strength for more elastic feel
      )
      .force("charge", d3.forceManyBody()
        .strength(-1200) // Stronger repulsion
        .distanceMin(50)
        .distanceMax(500)
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide()
        .radius(45) // Larger collision radius
        .strength(0.8)
      )
      // Add bounds force to keep nodes in view
      .force("bounds", () => {
        simulation.nodes().forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            node.x = Math.max(60, Math.min(width - 60, node.x));
            node.y = Math.max(60, Math.min(height - 60, node.y));
          }
        });
      })
      .alphaDecay(0.01) // Slower decay for longer animation
      .velocityDecay(0.3) // More elastic movement
      .alpha(1);

    simulationRef.current = simulation;

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newRect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(800, newRect.width - 40);
      const newHeight = Math.max(600, newRect.height - 40);

      svg
        .attr('width', newWidth)
        .attr('height', newHeight)
        .attr('viewBox', `0 0 ${newWidth} ${newHeight}`);

      simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
      simulation.alpha(0.3).restart();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  // Update visualization when data changes
  useEffect(() => {
    updateVisualization();
  }, [updateVisualization]);

  const getNodeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'Person': '#10b981',      // Emerald
      'Company': '#8b5cf6',     // Violet
      'Product': '#f59e0b',     // Amber
      'Location': '#ef4444',    // Red
      'Event': '#06b6d4',        // Cyan
    };
    return colors[type] || '#6366f1'; // Default indigo
  };

  const onClickNode = useCallback((nodeId: string) => {
    const node = graphService.getNode(nodeId);
    setState(prev => ({ ...prev, selectedNode: node }));
  }, [graphService]);

  // ==========================
  // CRUD OPERATIONS
  // ==========================

  const createNode = () => {
    try {
      const properties = JSON.parse(createForm.nodeProps || '{}');
      const nodeId = graphService.createNode(createForm.nodeType, properties);
      updateState();
      setCreateForm(prev => ({ ...prev, nodeProps: '{"name": "John", "age": 25}' }));
      showSuccess(`Created node: ${nodeId}`);
    } catch (error) {
      showError(`Failed to create node: ${error}`);
    }
  };

  const createRelationship = () => {
    try {
      // Better error checking
      if (state.nodes.length === 0) {
        throw new Error('Create some nodes first before adding relationships');
      }

      if (!createForm.sourceNodeId || !createForm.targetNodeId) {
        throw new Error('Please select both source and target nodes from the dropdowns');
      }

      if (createForm.sourceNodeId === createForm.targetNodeId) {
        throw new Error('Source and target nodes must be different');
      }

      const properties = JSON.parse(createForm.relProps || '{}');
      const relId = graphService.createRelationship(
        createForm.relType,
        createForm.sourceNodeId,
        createForm.targetNodeId,
        properties
      );
      updateState();
      setCreateForm(prev => ({
        ...prev,
        relProps: '{"since": "2020"}',
        sourceNodeId: '',
        targetNodeId: ''
      }));
      showSuccess(`Created relationship: ${relId}`);
    } catch (error) {
      showError(`Failed to create relationship: ${error}`);
    }
  };

  const deleteNode = (nodeId: string) => {
    try {
      graphService.deleteNode(nodeId);
      updateState();
      showSuccess(`Deleted node: ${nodeId}`);
    } catch (error) {
      showError(`Failed to delete node: ${error}`);
    }
  };

  const deleteRelationship = (relId: string) => {
    try {
      graphService.deleteRelationship(relId);
      updateState();
      showSuccess(`Deleted relationship: ${relId}`);
    } catch (error) {
      showError(`Failed to delete relationship: ${error}`);
    }
  };

  // ==========================
  // QUERY PROCESSING
  // ==========================

  const executeQuery = () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Parse and execute simple commands
      const commands = queryText.split('\n').filter(line => line.trim());

      commands.forEach(command => {
        const cmd = command.trim();

        if (cmd.startsWith('CREATE (')) {
          executeCreateCommand(cmd);
        } else if (cmd.startsWith('MATCH')) {
          executeMatchCommand(cmd);
        }
      });

      updateState();
      showSuccess('Query executed successfully');
    } catch (error) {
      showError(`Query execution failed: ${error}`);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const executeCreateCommand = (command: string) => {
    // Simple CREATE parser: CREATE (n:Type {prop: value})
    const match = command.match(/CREATE \((\w+):(\w+)\s*(\{[^}]*\})?\)/);
    if (match) {
      const [, , type, propsStr] = match;
      const properties = propsStr ? JSON.parse(propsStr.replace(/(\w+):/g, '"$1":')) : {};
      graphService.createNode(type, properties);
    }
  };

  const executeMatchCommand = (command: string) => {
    // Simple MATCH implementation would go here
    console.log('MATCH command:', command);
  };

  // ==========================
  // PERSISTENCE OPERATIONS
  // ==========================

  const saveGraph = async () => {
    if (!currentAccount) {
      showError('Please connect your wallet first');
      return;
    }

    console.log('🔗 Wallet connected:', currentAccount.address);
    console.log('💾 Starting graph save process...');

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const tags = saveForm.tags.split(',').map(t => t.trim()).filter(Boolean);

      console.log('📊 Save parameters:', {
        name: saveForm.name,
        description: saveForm.description,
        isPublic: saveForm.isPublic,
        tags: tags
      });

      const result = await graphService.saveGraph({
        name: saveForm.name,
        description: saveForm.description,
        isPublic: saveForm.isPublic,
        tags
      }, signAndExecute);

      console.log('🎉 Graph save completed:', result);
      showSuccess(`Graph saved! Blob ID: ${result.blobId}`);

    } catch (error) {
      console.error('💥 Graph save failed:', error);
      showError(`Failed to save graph: ${error}`);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadGraph = async (blobId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await graphService.loadGraph(blobId);
      updateState();
      showSuccess('Graph loaded successfully');
    } catch (error) {
      showError(`Failed to load graph: ${error}`);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // ==========================
  // GRAPH ANALYSIS
  // ==========================

  const analyzeGraph = () => {
    try {
      const centrality = graphService.calculateDegreeCentrality();
      const components = graphService.findConnectedComponents();
      const pagerank = graphService.calculatePageRank();

      console.log('Graph Analysis:', {
        centrality: centrality.slice(0, 5),
        components: components.length,
        pagerank: pagerank.slice(0, 5)
      });

      showSuccess('Graph analysis completed - check console');
    } catch (error) {
      showError(`Analysis failed: ${error}`);
    }
  };

  // ==========================
  // EVENT HANDLERS
  // ==========================

  // ==========================
  // UTILITY FUNCTIONS
  // ==========================

  const showSuccess = (message: string) => {
    console.log('✅', message);
    // You could replace this with a toast notification
  };

  const showError = (message: string) => {
    console.error('❌', message);
    setState(prev => ({ ...prev, error: message }));
    // You could replace this with a toast notification
  };

  // Add createSampleData function
  const createSampleData = () => {
    try {
      // Clear existing data first
      graphService.clearGraph();

      // Create sample nodes
      const aliceId = graphService.createNode('Person', { name: 'Alice', age: 30 });
      const bobId = graphService.createNode('Person', { name: 'Bob', age: 25 });
      const charlieId = graphService.createNode('Person', { name: 'Charlie', age: 28 });
      const techCorpId = graphService.createNode('Company', { name: 'TechCorp', founded: 2020 });
      const productId = graphService.createNode('Product', { name: 'WebApp', version: '2.0' });

      // Create sample relationships
      graphService.createRelationship('KNOWS', aliceId, bobId, { since: '2020' });
      graphService.createRelationship('KNOWS', bobId, charlieId, { since: '2021' });
      graphService.createRelationship('WORKS_AT', aliceId, techCorpId, { role: 'Engineer' });
      graphService.createRelationship('WORKS_AT', bobId, techCorpId, { role: 'Designer' });
      graphService.createRelationship('DEVELOPS', techCorpId, productId, { responsibility: 100 });

      updateState();
      console.log('✅ Sample graph data loaded!');
      console.log('Nodes created:', graphService.getAllData().nodes.length);
      console.log('Relationships created:', graphService.getAllData().relationships.length);
    } catch (errorMessage) {
      console.log('Note: Could not create sample data, starting with empty graph', errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {/* Header */}
      <header className="glass border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </Link>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              WebWalrus Graph Editor
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <ConnectButton />
            <div className="text-sm glass p-2 rounded">
              <div>Nodes: <span className="text-cyan-400">{state.stats?.nodeCount || 0}</span></div>
              <div>Relationships: <span className="text-purple-400">{state.stats?.relationshipCount || 0}</span></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-col lg:flex-row flex-1 p-4 h-[calc(100vh-80px)]">
        {/* Left Sidebar - Editor/Forms */}
        <aside className="w-full lg:w-1/3 p-4 bg-gray-800 bg-opacity-70 rounded-lg shadow-xl flex flex-col mb-4 lg:mb-0 mr-0 lg:mr-4 overflow-hidden">
          <div className="flex mb-4 border-b border-gray-700">
            <button
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'create' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('create')}
            >
              <Plus className="inline-block w-4 h-4 mr-1" /> Create
            </button>
            <button
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'query' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('query')}
            >
              <Search className="inline-block w-4 h-4 mr-1" /> Query
            </button>
            <button
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'stats' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('stats')}
            >
              <BarChart3 className="inline-block w-4 h-4 mr-1" /> Stats
            </button>
            <button
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'save' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('save')}
            >
              <Save className="inline-block w-4 h-4 mr-1" /> Save/Load
            </button>
          </div>

          {activeTab === 'create' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Create New</h2>

              {/* Create Node */}
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Node</h3>
                <label htmlFor="nodeType" className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                <input
                  type="text"
                  id="nodeType"
                  value={createForm.nodeType}
                  onChange={(e) => setCreateForm({ ...createForm, nodeType: e.target.value })}
                  placeholder="e.g., Person, Company"
                  className="input mb-3"
                />
                <label htmlFor="nodeProps" className="block text-sm font-medium text-gray-300 mb-1">Properties (JSON)</label>
                <textarea
                  id="nodeProps"
                  value={createForm.nodeProps}
                  onChange={(e) => setCreateForm({ ...createForm, nodeProps: e.target.value })}
                  rows={3}
                  className="input mb-3 resize-y"
                  placeholder='{"name": "Jane Doe", "age": 42}'
                ></textarea>
                <button
                  onClick={createNode}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Node
                </button>
              </div>

              {/* Create Relationship */}
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Relationship</h3>
                <label htmlFor="relType" className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                <input
                  type="text"
                  id="relType"
                  value={createForm.relType}
                  onChange={(e) => setCreateForm({ ...createForm, relType: e.target.value })}
                  placeholder="e.g., KNOWS, WORKS_AT"
                  className="input mb-3"
                />

                <label htmlFor="sourceNode" className="block text-sm font-medium text-gray-300 mb-1">Source Node</label>
                <select
                  id="sourceNode"
                  value={createForm.sourceNodeId}
                  onChange={(e) => setCreateForm({ ...createForm, sourceNodeId: e.target.value })}
                  className="input mb-3"
                >
                  <option value="">Select Source Node</option>
                  {state.nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.properties.name || node.id} ({node.type})
                    </option>
                  ))}
                </select>

                <label htmlFor="targetNode" className="block text-sm font-medium text-gray-300 mb-1">Target Node</label>
                <select
                  id="targetNode"
                  value={createForm.targetNodeId}
                  onChange={(e) => setCreateForm({ ...createForm, targetNodeId: e.target.value })}
                  className="input mb-3"
                >
                  <option value="">Select Target Node</option>
                  {state.nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.properties.name || node.id} ({node.type})
                    </option>
                  ))}
                </select>

                <label htmlFor="relProps" className="block text-sm font-medium text-gray-300 mb-1">Properties (JSON)</label>
                <textarea
                  id="relProps"
                  value={createForm.relProps}
                  onChange={(e) => setCreateForm({ ...createForm, relProps: e.target.value })}
                  rows={2}
                  className="input mb-3 resize-y"
                  placeholder='{"since": "2023-01-01"}'
                ></textarea>
                <button
                  onClick={createRelationship}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Relationship
                </button>
              </div>

              <div className="mb-4">
                <button
                  onClick={createSampleData}
                  className="btn-secondary w-full flex items-center justify-center"
                >
                  <Database className="w-4 h-4 mr-2" /> Create Sample Graph
                </button>
              </div>
            </div>
          )}

          {activeTab === 'query' && (
            <div className="flex flex-col flex-1">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Graph Query (Cypher-like)</h2>
              <div className="flex-1 mb-4 overflow-hidden rounded-lg border border-gray-700">
                <Editor
                  height="100%"
                  language="cypher" // Or a custom language for your syntax
                  theme="vs-dark"
                  value={queryText}
                  onChange={(value) => setQueryText(value || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    fontFamily: 'Fira Code, monospace',
                    fontLigatures: true,
                    tabSize: 2,
                    insertSpaces: true,
                    automaticLayout: true,
                    cursorBlinking: 'smooth',
                    cursorStyle: 'line',
                    lineHeight: 22,
                    // You can add more Monaco options here
                  }}
                />
              </div>
              <button
                onClick={executeQuery}
                className="btn-primary w-full flex items-center justify-center"
                disabled={state.isLoading}
              >
                {state.isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Execute Query
              </button>
              {state.queryResult && (
                <div className="mt-4 p-3 bg-gray-900 bg-opacity-50 rounded-lg text-sm overflow-auto max-h-48">
                  <h3 className="text-white font-medium mb-2">Query Result:</h3>
                  <pre className="text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(state.queryResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Graph Statistics & Analysis</h2>
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Overview</h3>
                <p className="mb-1 text-gray-300">Total Nodes: <span className="text-cyan-400">{state.stats?.nodeCount || 0}</span></p>
                <p className="mb-1 text-gray-300">Total Relationships: <span className="text-purple-400">{state.stats?.relationshipCount || 0}</span></p>
                <p className="mb-1 text-gray-300">Node Types: <span className="text-orange-400">{Object.keys(state.stats?.nodeTypes || {}).length}</span></p>
                <p className="mb-1 text-gray-300">Relationship Types: <span className="text-green-400">{Object.keys(state.stats?.relationshipTypes || {}).length}</span></p>
              </div>

              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Node Type Distribution</h3>
                {state.stats?.nodeTypes && Object.entries(state.stats.nodeTypes).map(([type, count]) => (
                  <p key={type} className="text-gray-300 text-sm">{type}: <span className="text-cyan-400">{count}</span></p>
                ))}
              </div>

              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Relationship Type Distribution</h3>
                {state.stats?.relationshipTypes && Object.entries(state.stats.relationshipTypes).map(([type, count]) => (
                  <p key={type} className="text-gray-300 text-sm">{type}: <span className="text-purple-400">{count}</span></p>
                ))}
              </div>

              <div className="mb-4">
                <button
                  onClick={analyzeGraph}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <BarChart3 className="w-4 h-4 mr-2" /> Run Advanced Analysis
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Results will be logged to console (Degree Centrality, Connected Components, PageRank).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'save' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Save / Load Graph</h2>
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Save Current Graph</h3>
                <label htmlFor="graphName" className="block text-sm font-medium text-gray-300 mb-1">Graph Name</label>
                <input
                  type="text"
                  id="graphName"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                  placeholder="e.g., My Project Graph"
                  className="input mb-3"
                />
                <label htmlFor="graphDescription" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  id="graphDescription"
                  value={saveForm.description}
                  onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                  rows={2}
                  className="input mb-3 resize-y"
                  placeholder="A brief description of your graph"
                ></textarea>
                <label htmlFor="graphTags" className="block text-sm font-medium text-gray-300 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  id="graphTags"
                  value={saveForm.tags}
                  onChange={(e) => setSaveForm({ ...saveForm, tags: e.target.value })}
                  placeholder="e.g., project, demo, personal"
                  className="input mb-3"
                />
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={saveForm.isPublic}
                    onChange={(e) => setSaveForm({ ...saveForm, isPublic: e.target.checked })}
                    className="form-checkbox h-4 w-4 text-cyan-600 transition duration-150 ease-in-out"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-300">
                    Make Public
                  </label>
                </div>
                <button
                  onClick={saveGraph}
                  className="btn-primary w-full flex items-center justify-center"
                  disabled={state.isLoading || !currentAccount}
                >
                  {state.isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Graph to Sui
                </button>
                {!currentAccount && (
                  <p className="text-red-400 text-xs mt-2">Connect your wallet to save graphs.</p>
                )}
              </div>

              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white">Load Graph from Sui</h3>
                <label htmlFor="loadBlobId" className="block text-sm font-medium text-gray-300 mb-1">Graph Blob ID</label>
                <input
                  type="text"
                  id="loadBlobId"
                  placeholder="Paste Blob ID here"
                  className="input mb-3"
                  onBlur={(e) => {
                    if (e.target.value) loadGraph(e.target.value);
                  }}
                />
                <p className="text-sm text-gray-400">
                  Enter a Blob ID and press Enter to load the graph.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* Graph Visualization Area */}
        <div ref={containerRef} className="flex-1 bg-gray-800 bg-opacity-70 rounded-lg shadow-xl relative overflow-hidden">
          {state.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-lg">
              No graph data to display. Create some nodes or load a sample graph!
            </div>
          )}
          <svg ref={svgRef} className="w-full h-full"></svg>
        </div>

        {/* Right Sidebar - Details Panel */}
        <aside className="w-full lg:w-1/4 p-4 bg-gray-800 bg-opacity-70 rounded-lg shadow-xl flex flex-col mt-4 lg:mt-0 lg:ml-4 overflow-hidden">
          <h2 className="text-xl font-semibold mb-3 text-cyan-300">Details Panel</h2>
          <div className="flex-1 overflow-y-auto pr-2">
            {state.selectedNode && (
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white flex items-center">
                  <Edit className="w-5 h-5 mr-2" /> Selected Node
                </h3>
                <p className="text-sm text-gray-300 mb-1">ID: <span className="font-mono text-purple-300">{state.selectedNode.id}</span></p>
                <p className="text-sm text-gray-300 mb-1">Type: <span className="font-medium text-cyan-300">{state.selectedNode.type}</span></p>
                <h4 className="text-md font-medium mt-3 mb-1 text-white">Properties:</h4>
                <pre className="bg-gray-700 p-2 rounded text-xs text-gray-200 overflow-auto max-h-32">
                  {JSON.stringify(state.selectedNode.properties, null, 2)}
                </pre>
                <button
                  onClick={() => deleteNode(state.selectedNode!.id)}
                  className="btn-danger w-full flex items-center justify-center mt-4"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Node
                </button>
              </div>
            )}

            {state.selectedRelationship && (
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-2 text-white flex items-center">
                  <Edit className="w-5 h-5 mr-2" /> Selected Relationship
                </h3>
                <p className="text-sm text-gray-300 mb-1">ID: <span className="font-mono text-purple-300">{state.selectedRelationship.id}</span></p>
                <p className="text-sm text-gray-300 mb-1">Type: <span className="font-medium text-cyan-300">{state.selectedRelationship.type}</span></p>
                <p className="text-sm text-gray-300 mb-1">Source: <span className="font-mono text-orange-300">{state.selectedRelationship.sourceId}</span></p>
                <p className="text-sm text-gray-300 mb-1">Target: <span className="font-mono text-orange-300">{state.selectedRelationship.targetId}</span></p>
                <h4 className="text-md font-medium mt-3 mb-1 text-white">Properties:</h4>
                <pre className="bg-gray-700 p-2 rounded text-xs text-gray-200 overflow-auto max-h-32">
                  {JSON.stringify(state.selectedRelationship.properties, null, 2)}
                </pre>
                <button
                  onClick={() => deleteRelationship(state.selectedRelationship!.id)}
                  className="btn-danger w-full flex items-center justify-center mt-4"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Relationship
                </button>
              </div>
            )}

            {!state.selectedNode && !state.selectedRelationship && (
              <div className="p-4 text-gray-400 text-center">
                Click on a node or relationship in the graph to see its details here.
              </div>
            )}

            {state.error && (
              <div className="mt-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded-lg text-sm text-red-300">
                <h3 className="font-medium mb-1">Error:</h3>
                <p>{state.error}</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}