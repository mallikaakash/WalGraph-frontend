"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3';
import { Transaction } from '@mysten/sui/transactions';
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
  Loader2,
  Copy,
  Check,
  Upload,
  FileText,
  Download
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

// Dynamically import Monaco Editor
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// Define types for better TypeScript support
interface QueryCommand {
  command: string;
  type: string;
  result: unknown;
  success: boolean;
}

interface CreateCommandResult {
  nodeId: string;
  type: string;
  properties: Record<string, unknown>;
  variable: string;
}

interface MatchCommandResult {
  pattern: string;
  matchedNodes?: Array<{
    id: string;
    type: string;
    properties: Record<string, unknown>;
  }>;
  matchedRelationships?: Array<{
    id: string;
    type: string;
    sourceId: string;
    targetId: string;
    properties: Record<string, unknown>;
  }>;
  count: number;
  returnVariable: string;
}

interface QueryAggregations {
  executedCommands?: number;
  commands?: QueryCommand[];
  timestamp?: string;
  graphStats?: GraphStats;
  error?: string;
  originalQuery?: string;
  [key: string]: unknown;
}

interface CSVImportSettings {
  nodeColumns: string[];
  nodeTypeColumn: string;
  nodeIdColumn: string;
  relationshipMode: 'none' | 'sequential' | 'properties';
  relationshipType: string;
  sourceColumn: string;
  targetColumn: string;
  skipFirstRow: boolean;
}

interface CSVRowData {
  [key: string]: string | number | undefined;
}

interface CSVParseError {
  type: string;
  code: string;
  message: string;
  row?: number;
}

interface CSVData {
  data: CSVRowData[];
  errors: CSVParseError[];
  meta: {
    fields?: string[];
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
  };
}

interface ImportNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

interface ImportRelationship {
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, unknown>;
}

interface EditorState {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  selectedNode: GraphNode | null;
  selectedRelationship: GraphRelationship | null;
  queryResult: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  stats: GraphStats | null;
  savedGraphInfo: {
    blobId: string;
    transactionDigest: string;
    timestamp: string;
    name: string;
  } | null;
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
  const signAndExecute = (params: unknown): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      console.log('🔄 Wallet: Executing transaction...', params);
      
      // Cast params to TransactionParams since we know the structure
      const transactionParams = params as TransactionParams;
      
      signAndExecuteTransaction(
        {
          transaction: transactionParams.transaction as Transaction,
          chain: 'sui:testnet', // Specify the chain
        },
        {
          onSuccess: (result) => {
            console.log('✅ Wallet: Transaction successful:', result);
            console.log('📋 Object changes:', result.objectChanges);
            console.log('🔗 Transaction digest:', result.digest);
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
    stats: null,
    savedGraphInfo: null
  });

  // UI State
  const [activeTab, setActiveTab] = useState<'query' | 'create' | 'stats' | 'save' | 'import'>('create');
  const [queryText, setQueryText] = useState('MATCH (p:Person) RETURN p');
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
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: boolean }>({});

  // CSV Import State
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [importSettings, setImportSettings] = useState<CSVImportSettings>({
    nodeColumns: [],
    nodeTypeColumn: '',
    nodeIdColumn: '',
    relationshipMode: 'none',
    relationshipType: 'RELATED_TO',
    sourceColumn: '',
    targetColumn: '',
    skipFirstRow: true
  });
  const [importPreview, setImportPreview] = useState<{
    nodes: ImportNode[];
    relationships: ImportRelationship[];
  }>({ nodes: [], relationships: [] });
  const [isImporting, setIsImporting] = useState(false);

  // Define updateState function
  const updateState = useCallback(() => {
    const { nodes, relationships } = graphService.getAllData();
    const stats = graphService.getGraphStats();
    setState(prev => ({
      ...prev,
      nodes,
      relationships,
      stats
    }));
  }, [graphService]);

  // Initialize graph service
  useEffect(() => {
    updateState();
    console.log('📋 Graph editor initialized. Click "Create Sample Graph" to see visualization.');
  }, [updateState]);

  // Define onClickNode function before updateVisualization
  const onClickNode = useCallback((nodeId: string) => {
    const node = graphService.getNode(nodeId);
    setState(prev => ({ ...prev, selectedNode: node }));
  }, [graphService]);

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
      .text(d => String(d.properties.name || d.id.slice(0, 6)));

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
      setState(prev => ({ ...prev, isLoading: true, error: null, queryResult: null }));

      // Parse and execute simple commands
      const commands = queryText.split('\n').filter(line => line.trim());
      const results: QueryCommand[] = [];
      let executedCommands = 0;
      let totalNodes = 0;
      let totalRelationships = 0;

      commands.forEach(command => {
        const cmd = command.trim();
        console.log('🔄 Executing command:', cmd);

        if (cmd.startsWith('CREATE (')) {
          const result = executeCreateCommand(cmd);
          if (result) {
            results.push({
              command: cmd,
              type: 'CREATE',
              result: result,
              success: true
            });
            executedCommands++;
            totalNodes++;
          }
        } else if (cmd.startsWith('MATCH')) {
          const result = executeMatchCommand(cmd);
          results.push({
            command: cmd,
            type: 'MATCH',
            result: result,
            success: true
          });
          executedCommands++;
          if (result.matchedNodes) totalNodes += result.matchedNodes.length;
          if (result.matchedRelationships) totalRelationships += result.matchedRelationships.length;
        } else if (cmd.toUpperCase().startsWith('CLEAR')) {
          graphService.clearGraph();
          results.push({
            command: cmd,
            type: 'CLEAR',
            result: 'Graph cleared successfully',
            success: true
          });
          executedCommands++;
        } else if (cmd) {
          results.push({
            command: cmd,
            type: 'UNKNOWN',
            result: `Unknown command: ${cmd}`,
            success: false
          });
        }
      });

      // Create a proper QueryResult object
      const aggregations: QueryAggregations = {
        executedCommands,
        commands: results,
        timestamp: new Date().toISOString(),
        graphStats: graphService.getGraphStats()
      };

      const finalResult: QueryResult = {
        nodes: [],
        relationships: [],
        executionTime: Date.now(),
        totalResults: totalNodes + totalRelationships,
        aggregations
      };

      setState(prev => ({ ...prev, queryResult: finalResult }));
      updateState();
      
      if (executedCommands > 0) {
        showSuccess(`Query executed successfully: ${executedCommands} commands processed`);
      } else {
        showError('No valid commands found to execute');
      }
    } catch (error) {
      const errorAggregations: QueryAggregations = {
        error: String(error),
        timestamp: new Date().toISOString(),
        originalQuery: queryText
      };

      const errorResult: QueryResult = {
        nodes: [],
        relationships: [],
        executionTime: Date.now(),
        totalResults: 0,
        aggregations: errorAggregations
      };
      setState(prev => ({ ...prev, queryResult: errorResult }));
      showError(`Query execution failed: ${error}`);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const executeCreateCommand = (command: string): CreateCommandResult | null => {
    try {
      // Improved CREATE parser: CREATE (n:Type {prop: value})
      const match = command.match(/CREATE \s*\(\s*(\w+)?\s*:?\s*(\w+)\s*(\{[^}]*\})?\s*\)/i);
      if (match) {
        const [, variable, type, propsStr] = match;
        let properties = {};
        
        if (propsStr) {
          try {
            // More robust property parsing
            properties = parseProperties(propsStr);
          } catch (parseError) {
            console.warn('Property parsing failed, using empty properties:', parseError);
            properties = {};
          }
        }
        
        const nodeId = graphService.createNode(type, properties);
        return {
          nodeId,
          type,
          properties,
          variable: variable || 'n'
        };
      } else {
        throw new Error(`Invalid CREATE syntax: ${command}`);
      }
    } catch (error) {
      throw new Error(`CREATE command failed: ${error}`);
    }
  };

  // Helper function to parse Cypher property syntax
  const parseProperties = (propsStr: string): Record<string, unknown> => {
    // Remove outer braces
    const content = propsStr.trim().slice(1, -1).trim();
    
    if (!content) {
      return {};
    }

    const properties: Record<string, unknown> = {};
    
    // Split by commas, but be careful about quoted strings
    const pairs = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (char === ',' && !inQuotes) {
        pairs.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      pairs.push(current.trim());
    }

    // Parse each key-value pair
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = pair.substring(0, colonIndex).trim();
      const valueStr = pair.substring(colonIndex + 1).trim();
      
      // Parse the value
      let value: unknown = valueStr;
      
      // Handle quoted strings
      if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
          (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
        value = valueStr.slice(1, -1);
      }
      // Handle numbers
      else if (/^\d+$/.test(valueStr)) {
        value = parseInt(valueStr, 10);
      }
      else if (/^\d+\.\d+$/.test(valueStr)) {
        value = parseFloat(valueStr);
      }
      // Handle booleans
      else if (valueStr === 'true') {
        value = true;
      }
      else if (valueStr === 'false') {
        value = false;
      }
      // Handle null
      else if (valueStr === 'null') {
        value = null;
      }
      // Everything else as string (unquoted)
      else {
        value = valueStr;
      }
      
      properties[key] = value;
    }
    
    return properties;
  };

  const executeMatchCommand = (command: string): MatchCommandResult => {
    try {
      // Simple MATCH implementation
      console.log('🔍 MATCH command:', command);
      
      // Basic pattern: MATCH (n:Type) RETURN n
      const simpleMatch = command.match(/MATCH \s*\(\s*(\w+)\s*:?\s*(\w+)?\s*\)\s*RETURN\s+(\w+)/i);
      if (simpleMatch) {
        const [, variable, type, returnVar] = simpleMatch;
        
        let matchedNodes = state.nodes;
        if (type) {
          matchedNodes = state.nodes.filter(node => node.type === type);
        }
        
        return {
          pattern: `(${variable}${type ? ':' + type : ''})`,
          matchedNodes: matchedNodes.map(node => ({
            id: node.id,
            type: node.type,
            properties: node.properties
          })),
          count: matchedNodes.length,
          returnVariable: returnVar
        };
      }
      
      // MATCH all nodes
      if (command.match(/MATCH \s*\(\s*\w*\s*\)\s*RETURN/i)) {
        return {
          pattern: '()',
          matchedNodes: state.nodes.map(node => ({
            id: node.id,
            type: node.type,
            properties: node.properties
          })),
          count: state.nodes.length,
          returnVariable: 'all'
        };
      }
      
      // MATCH relationships
      const relMatch = command.match(/MATCH \s*\(\s*\w*\s*\)\s*-\s*\[\s*\w*\s*:?\s*(\w+)?\s*\]\s*-\s*\(\s*\w*\s*\)/i);
      if (relMatch) {
        const [, relType] = relMatch;
        let matchedRels = state.relationships;
        if (relType) {
          matchedRels = state.relationships.filter(rel => rel.type === relType);
        }
        
        return {
          pattern: `()-[${relType || ''}]-()`,
          matchedRelationships: matchedRels.map(rel => ({
            id: rel.id,
            type: rel.type,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
            properties: rel.properties
          })),
          count: matchedRels.length,
          returnVariable: 'relationships'
        };
      }
      
      throw new Error(`Unsupported MATCH pattern: ${command}`);
    } catch (error) {
      throw new Error(`MATCH command failed: ${error}`);
    }
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

      // Create a wrapper to capture transaction info
      let transactionDigest = '';
      const signAndExecuteWithCapture = async (params: unknown): Promise<unknown> => {
        const result = await signAndExecute(params);
        // Capture the transaction digest from the result
        if (result && typeof result === 'object' && 'digest' in result) {
          transactionDigest = (result as { digest: string }).digest;
        }
        return result;
      };

      const result = await graphService.saveGraph({
        name: saveForm.name,
        description: saveForm.description,
        isPublic: saveForm.isPublic,
        tags
      }, 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signAndExecuteWithCapture as any);

      console.log('🎉 Graph save completed:', result);
      showSuccess(`Graph saved! Blob ID: ${result.blobId}`);

      setState(prev => ({
        ...prev,
        savedGraphInfo: {
          blobId: result.blobId,
          transactionDigest: transactionDigest,
          timestamp: new Date().toISOString(),
          name: saveForm.name
        }
      }));

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

  // Helper functions to safely access aggregations
  const getAggregationValue = (aggregations: QueryAggregations | undefined, key: string, defaultValue: unknown = null): unknown => {
    return aggregations?.[key] ?? defaultValue;
  };

  const getAggregationNumber = (aggregations: QueryAggregations | undefined, key: string, defaultValue: number = 0): number => {
    const value = aggregations?.[key];
    return typeof value === 'number' ? value : defaultValue;
  };

  const hasAggregationError = (aggregations: QueryAggregations | undefined): boolean => {
    return Boolean(aggregations?.error);
  };

  const getCommands = (aggregations: QueryAggregations | undefined): QueryCommand[] => {
    const commands = getAggregationValue(aggregations, 'commands', []);
    return Array.isArray(commands) ? commands as QueryCommand[] : [];
  };

  const getGraphStatsFromAggregations = (aggregations: QueryAggregations | undefined): GraphStats | null => {
    const stats = getAggregationValue(aggregations, 'graphStats');
    return stats as GraphStats | null;
  };

  const showSuccess = (message: string) => {
    console.log('✅', message);
    // You could replace this with a toast notification
  };

  const showError = (message: string) => {
    console.error('❌', message);
    setState(prev => ({ ...prev, error: message }));
    // You could replace this with a toast notification
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
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

  // CSV Import Functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showError('Please select a CSV file');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        handleCSVData(results as CSVData);
      },
      error: (error) => {
        showError(`CSV parsing error: ${error.message}`);
      }
    });
  };

  const handleCSVData = (results: CSVData) => {
    console.log('📄 CSV Data loaded:', results);
    setCsvData(results);
    
    // Auto-detect column settings with better type checking
    let headers: string[] = [];
    
    if (results.meta.fields && Array.isArray(results.meta.fields)) {
      headers = results.meta.fields;
    } else if (results.data && results.data.length > 0 && Array.isArray(results.data[0])) {
      headers = results.data[0] as string[];
    }
    
    console.log('📋 Detected headers:', headers);
    
    if (headers.length > 0) {
      const nodeIdColumn = headers.find(h => 
        typeof h === 'string' && (h.toLowerCase().includes('id') || h.toLowerCase().includes('name'))
      ) || headers[0] || '';
      
      setImportSettings(prev => ({
        ...prev,
        nodeColumns: headers,
        nodeTypeColumn: headers[0] || '',
        nodeIdColumn: nodeIdColumn,
        sourceColumn: headers[0] || '',
        targetColumn: headers[1] || ''
      }));
      
      generateImportPreview(results, {
        ...importSettings,
        nodeColumns: headers,
        nodeTypeColumn: headers[0] || '',
        nodeIdColumn: nodeIdColumn
      });
    } else {
      console.warn('⚠️ No headers detected in CSV file');
      showError('Could not detect column headers in CSV file. Please ensure your file has headers.');
    }
  };

  const generateImportPreview = (data: CSVData, settings: CSVImportSettings) => {
    console.log('🔍 Generating import preview with:');
    console.log('📊 Data:', data);
    console.log('⚙️ Settings:', settings);
    
    if (!data.data || data.data.length === 0) {
      console.warn('⚠️ No data found for preview generation');
      return;
    }

    // Safely get headers with type checking
    let headers: string[] = [];
    if (data.meta.fields && Array.isArray(data.meta.fields)) {
      headers = data.meta.fields;
      console.log('📋 Headers from meta.fields:', headers);
    } else if (data.data.length > 0 && Array.isArray(data.data[0])) {
      headers = data.data[0] as string[];
      console.log('📋 Headers from first row:', headers);
    }
    
    if (headers.length === 0) {
      console.error('❌ No headers found for preview generation');
      showError('Could not detect column headers in CSV file. Please ensure your file has headers.');
      return;
    }
    
    // Get data rows - Papa Parse with header:true returns objects, not arrays
    const dataRows = data.data;
    console.log('📊 Data rows to process:', dataRows.length);
    console.log('📝 First few data rows:', dataRows.slice(0, 3));
    
    // Generate node preview with detailed logging
    const nodeIdIndex = headers.indexOf(settings.nodeIdColumn);
    const nodeTypeIndex = headers.indexOf(settings.nodeTypeColumn);
    
    console.log('🔗 Looking for columns:');
    console.log('  - Node ID Column:', settings.nodeIdColumn, '-> Index:', nodeIdIndex);
    console.log('  - Node Type Column:', settings.nodeTypeColumn, '-> Index:', nodeTypeIndex);
    console.log('🗂️ Available headers:', headers);
    
    if (nodeIdIndex === -1) {
      console.error(`❌ Node ID column "${settings.nodeIdColumn}" not found in headers:`, headers);
      showError(`Node ID column "${settings.nodeIdColumn}" not found. Available columns: ${headers.join(', ')}`);
      return;
    }
    
    if (nodeTypeIndex === -1) {
      console.error(`❌ Node Type column "${settings.nodeTypeColumn}" not found in headers:`, headers);
      showError(`Node Type column "${settings.nodeTypeColumn}" not found. Available columns: ${headers.join(', ')}`);
      return;
    }
    
    // Process rows - Papa Parse with header:true returns objects
    const nodes: ImportNode[] = dataRows
      .filter((row, index) => {
        const isValid = row && typeof row === 'object' && !Array.isArray(row);
        if (!isValid) {
          console.warn(`⚠️ Skipping invalid row ${index}:`, row);
        }
        return isValid;
      })
      .map((row: CSVRowData, index: number) => {
        console.log(`🔄 Processing row ${index}:`, row);
        
        // Row is an object, so access properties directly
        const nodeId = String(row[settings.nodeIdColumn] || `node_${index}`);
        const nodeType = String(row[settings.nodeTypeColumn] || 'Unknown');
        
        // Use the entire row as properties
        const properties = { ...row };
        
        console.log(`✅ Created node: ID="${nodeId}", Type="${nodeType}", Properties:`, properties);
        
        return {
          id: nodeId,
          type: nodeType,
          properties
        };
      });

    console.log(`🎯 Generated ${nodes.length} nodes:`, nodes);

    // Generate relationship preview
    let relationships: ImportRelationship[] = [];
    if (settings.relationshipMode === 'sequential' && nodes.length > 1) {
      relationships = nodes.slice(0, -1).map((node, index) => {
        const rel: ImportRelationship = {
          type: settings.relationshipType,
          sourceId: node.id,
          targetId: nodes[index + 1].id,
          properties: {}
        };
        console.log(`🔗 Created relationship: ${rel.sourceId} -[${rel.type}]-> ${rel.targetId}`);
        return rel;
      });
    } else if (settings.relationshipMode === 'properties' && settings.sourceColumn && settings.targetColumn) {
      console.log(`🔗 Relationship columns: Source="${settings.sourceColumn}", Target="${settings.targetColumn}"`);
      
      relationships = dataRows
        .filter(row => row && typeof row === 'object')
        .map((row: CSVRowData) => {
          const sourceId = row[settings.sourceColumn];
          const targetId = row[settings.targetColumn];
          
          if (sourceId && targetId && sourceId !== targetId) {
            const rel: ImportRelationship = {
              type: settings.relationshipType,
              sourceId: String(sourceId),
              targetId: String(targetId),
              properties: {}
            };
            console.log(`🔗 Created relationship from columns: ${rel.sourceId} -[${rel.type}]-> ${rel.targetId}`);
            return rel;
          }
          return null;
        })
        .filter((rel): rel is ImportRelationship => rel !== null);
    }

    console.log(`🎉 Final result: ${nodes.length} nodes, ${relationships.length} relationships`);
    console.log('📋 Nodes:', nodes);
    console.log('🔗 Relationships:', relationships);
    
    setImportPreview({ nodes, relationships });
  };

  const executeImport = async () => {
    if (!csvData || importPreview.nodes.length === 0) {
      showError('No data to import');
      return;
    }

    setIsImporting(true);

    try {
      // Create nodes
      const nodeMap = new Map<string, string>();
      for (const nodeData of importPreview.nodes) {
        const nodeId = graphService.createNode(nodeData.type, nodeData.properties);
        nodeMap.set(nodeData.id, nodeId);
      }

      // Create relationships
      for (const relData of importPreview.relationships) {
        const sourceId = nodeMap.get(relData.sourceId);
        const targetId = nodeMap.get(relData.targetId);
        
        if (sourceId && targetId) {
          graphService.createRelationship(relData.type, sourceId, targetId, relData.properties);
        }
      }

      updateState();
      showSuccess(`Imported ${importPreview.nodes.length} nodes and ${importPreview.relationships.length} relationships`);
      
      // Clear import data
      setCsvData(null);
      setImportPreview({ nodes: [], relationships: [] });
      
    } catch (error) {
      showError(`Import failed: ${error}`);
    } finally {
      setIsImporting(false);
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
              WalGraph Editor
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <ConnectButton />
            {state.savedGraphInfo && (
              <div className="text-xs glass p-2 rounded border border-green-600">
                <div className="text-green-300 font-medium">✅ Saved to Walrus</div>
                <div className="text-gray-300">Blob: <span className="font-mono text-cyan-300">{state.savedGraphInfo.blobId.slice(0, 8)}...</span></div>
              </div>
            )}
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
              className={`py-2 px-4 text-sm font-medium ${activeTab === 'import' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('import')}
            >
              <Upload className="inline-block w-4 h-4 mr-1" /> Import
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
                      {String(node.properties.name || node.id)} ({node.type})
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
                      {String(node.properties.name || node.id)} ({node.type})
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
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Graph Query (Cypher-like)</h2>
              <div className="h-48 mb-4 overflow-hidden rounded-lg border border-gray-700">
                <Editor
                  height="200px"
                  language="cypher"
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
                  }}
                />
              </div>
              <button
                onClick={executeQuery}
                className="btn-primary w-full flex items-center justify-center mb-4"
                disabled={state.isLoading}
              >
                {state.isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Execute Query
              </button>

              {/* Query Results Section */}
              {state.queryResult && (
                <div className="space-y-4 mb-6">
                  {/* Summary Section */}
                  <div className="p-4 bg-gray-900 bg-opacity-70 rounded-lg border border-gray-700">
                    <h3 className="text-white font-semibold mb-3 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-cyan-400" />
                      Query Execution Summary
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Commands Executed:</span>
                        <span className="text-cyan-400 font-medium ml-2">
                          {getAggregationNumber(state.queryResult.aggregations, 'executedCommands', 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Total Results:</span>
                        <span className="text-green-400 font-medium ml-2">
                          {state.queryResult.totalResults}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Execution Time:</span>
                        <span className="text-purple-400 font-medium ml-2">
                          {new Date(state.queryResult.executionTime).toLocaleTimeString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <span className={`font-medium ml-2 ${hasAggregationError(state.queryResult.aggregations) ? 'text-red-400' : 'text-green-400'}`}>
                          {hasAggregationError(state.queryResult.aggregations) ? 'Error' : 'Success'}
                        </span>
                      </div>
                    </div>

                    {hasAggregationError(state.queryResult.aggregations) && (
                      <div className="mt-4 p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded">
                        <h4 className="text-red-300 font-medium mb-2">Error Details:</h4>
                        <p className="text-red-200 text-sm font-mono">
                          {String(getAggregationValue(state.queryResult.aggregations, 'error'))}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Command Results Section */}
                  {getCommands(state.queryResult.aggregations).length > 0 && (
                    <div className="p-4 bg-gray-900 bg-opacity-70 rounded-lg border border-gray-700">
                      <h3 className="text-white font-semibold mb-3 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-green-400" />
                        Command Results ({getCommands(state.queryResult.aggregations).length})
                      </h3>
                      
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {getCommands(state.queryResult.aggregations).map((cmd, index: number) => (
                          <div key={index} className={`p-3 rounded border-l-4 ${
                            cmd.success 
                              ? 'bg-green-900 bg-opacity-30 border-green-400' 
                              : 'bg-red-900 bg-opacity-30 border-red-400'
                          }`}>
                            {/* Command Header */}
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-medium ${
                                cmd.success ? 'text-green-300' : 'text-red-300'
                              }`}>
                                {cmd.type} Command
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                cmd.success 
                                  ? 'bg-green-700 text-green-200' 
                                  : 'bg-red-700 text-red-200'
                              }`}>
                                {cmd.success ? '✓ Success' : '✗ Failed'}
                              </span>
                            </div>

                            {/* Original Command */}
                            <div className="mb-3">
                              <span className="text-gray-400 text-xs block mb-1">Command:</span>
                              <code className="text-cyan-300 text-sm bg-gray-800 px-2 py-1 rounded font-mono block">
                                {cmd.command}
                              </code>
                            </div>

                            {/* Results */}
                            <div>
                              <span className="text-gray-400 text-xs block mb-1">Result:</span>
                              <div className="text-sm">
                                {(() => {
                                  if (cmd.type === 'CREATE' && cmd.result && typeof cmd.result === 'object' && 'nodeId' in cmd.result) {
                                    const createResult = cmd.result as CreateCommandResult;
                                    return (
                                      <div className="space-y-1">
                                        <p className="text-white">
                                          ✅ Created <span className="text-cyan-400 font-medium">{createResult.type}</span> node
                                        </p>
                                        <p className="text-gray-300">
                                          ID: <span className="text-purple-300 font-mono">{createResult.nodeId}</span>
                                        </p>
                                        {Object.keys(createResult.properties || {}).length > 0 && (
                                          <div>
                                            <span className="text-gray-400">Properties:</span>
                                            <div className="ml-4 mt-1">
                                              {Object.entries(createResult.properties || {}).map(([key, value]) => (
                                                <div key={key} className="text-gray-300 text-xs">
                                                  <span className="text-orange-300">{key}:</span> <span className="text-white">{String(value)}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else if (cmd.type === 'MATCH' && cmd.result && typeof cmd.result === 'object' && 'count' in cmd.result) {
                                    const matchResult = cmd.result as MatchCommandResult;
                                    return (
                                      <div className="space-y-2">
                                        <p className="text-white">
                                          🔍 Matched <span className="text-cyan-400 font-medium">{matchResult.count}</span> items
                                        </p>
                                        <p className="text-gray-300">
                                          Pattern: <span className="text-orange-300 font-mono">{matchResult.pattern}</span>
                                        </p>
                                        
                                        {matchResult.matchedNodes && matchResult.matchedNodes.length > 0 && (
                                          <div>
                                            <span className="text-gray-400">Nodes ({matchResult.matchedNodes.length}):</span>
                                            <div className="ml-4 mt-1 space-y-1">
                                              {matchResult.matchedNodes.slice(0, 5).map((node, nodeIndex: number) => (
                                                <div key={nodeIndex} className="text-xs">
                                                  <span className="text-cyan-300">{node.type}</span>
                                                  <span className="text-gray-400 mx-1">•</span>
                                                  <span className="text-purple-300 font-mono">{node.id}</span>
                                                  {Boolean(node.properties?.name) && (
                                                    <>
                                                      <span className="text-gray-400 mx-1">•</span>
                                                      <span className="text-white">{String(node.properties.name)}</span>
                                                    </>
                                                  )}
                                                </div>
                                              ))}
                                              {matchResult.matchedNodes.length > 5 && (
                                                <div className="text-xs text-gray-500">
                                                  ... and {matchResult.matchedNodes.length - 5} more
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {matchResult.matchedRelationships && matchResult.matchedRelationships.length > 0 && (
                                          <div>
                                            <span className="text-gray-400">Relationships ({matchResult.matchedRelationships.length}):</span>
                                            <div className="ml-4 mt-1 space-y-1">
                                              {matchResult.matchedRelationships.slice(0, 5).map((rel, relIndex: number) => (
                                                <div key={relIndex} className="text-xs">
                                                  <span className="text-cyan-300">{rel.sourceId}</span>
                                                  <span className="text-purple-400 mx-1">-[{rel.type}]-&gt;</span>
                                                  <span className="text-cyan-300">{rel.targetId}</span>
                                                </div>
                                              ))}
                                              {matchResult.matchedRelationships.length > 5 && (
                                                <div className="text-xs text-gray-500">
                                                  ... and {matchResult.matchedRelationships.length - 5} more
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else if (cmd.type === 'CLEAR') {
                                    return <p className="text-green-300">🧹 {String(cmd.result)}</p>;
                                  } else if (cmd.type === 'UNKNOWN') {
                                    return <p className="text-red-300">❌ {String(cmd.result)}</p>;
                                  } else if (!cmd.success && typeof cmd.result === 'string') {
                                    return <p className="text-red-300">❌ {cmd.result}</p>;
                                  }
                                  return null; // Default return if no conditions are met
                                })()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Graph State */}
                  {state.queryResult && getGraphStatsFromAggregations(state.queryResult.aggregations) && (
                    <div className="p-4 bg-gray-900 bg-opacity-70 rounded-lg border border-gray-700">
                      <h3 className="text-white font-semibold mb-3 flex items-center">
                        <Database className="w-5 h-5 mr-2 text-blue-400" />
                        Current Graph State
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Total Nodes:</span>
                          <span className="text-cyan-400 font-medium ml-2">
                            {getGraphStatsFromAggregations(state.queryResult.aggregations)?.nodeCount || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Total Relationships:</span>
                          <span className="text-purple-400 font-medium ml-2">
                            {getGraphStatsFromAggregations(state.queryResult.aggregations)?.relationshipCount || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Node Types:</span>
                          <span className="text-orange-400 font-medium ml-2">
                            {Object.keys(getGraphStatsFromAggregations(state.queryResult.aggregations)?.nodeTypes || {}).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Relationship Types:</span>
                          <span className="text-green-400 font-medium ml-2">
                            {Object.keys(getGraphStatsFromAggregations(state.queryResult.aggregations)?.relationshipTypes || {}).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw JSON Output */}
                  {state.queryResult && (
                  <details className="p-4 bg-gray-900 bg-opacity-70 rounded-lg border border-gray-700">
                    <summary className="text-white font-semibold cursor-pointer hover:text-cyan-300 transition-colors">
                      🔧 Raw JSON Output (Click to expand)
                    </summary>
                    <div className="mt-3 p-3 bg-gray-800 rounded border max-h-64 overflow-auto">
                      <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono">
                        {JSON.stringify(state.queryResult, null, 2)}
                      </pre>
                    </div>
                  </details>
                  )}
                </div>
              )}

              {/* Example Queries Section */}
              <div className="mt-6 p-4 border border-blue-700 rounded-lg bg-blue-900 bg-opacity-30">
                <h4 className="text-blue-300 font-medium mb-3">📚 Example Queries</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <button 
                      onClick={() => setQueryText('CREATE (alice:Person {name: "Alice", age: 30})')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-cyan-300">CREATE (alice:Person {`{name: "Alice", age: 30}`})</code>
                      <p className="text-gray-400 mt-1">Create a new person node</p>
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => setQueryText('MATCH (p:Person) RETURN p')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-cyan-300">MATCH (p:Person) RETURN p</code>
                      <p className="text-gray-400 mt-1">Find all person nodes</p>
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => setQueryText('CREATE (company:Company {name: "TechCorp", founded: 2020})\nCREATE (product:Product {name: "SuperApp", version: "1.0"})')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-cyan-300">CREATE (company:Company {`{name: "TechCorp", founded: 2020}`})<br />CREATE (product:Product {`{name: "SuperApp", version: "1.0"}`})</code>
                      <p className="text-gray-400 mt-1">Create company and product nodes</p>
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => setQueryText('MATCH (c:Company) RETURN c')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-cyan-300">MATCH (c:Company) RETURN c</code>
                      <p className="text-gray-400 mt-1">Find all company nodes</p>
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => setQueryText('MATCH ()-[r:KNOWS]-() RETURN r')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-cyan-300">MATCH ()-[r:KNOWS]-() RETURN r</code>
                      <p className="text-gray-400 mt-1">Find all KNOWS relationships</p>
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => setQueryText('CREATE (alice:Person {name: "Alice", role: "Engineer"})\nCREATE (bob:Person {name: "Bob", role: "Designer"})\nCREATE (acme:Company {name: "ACME Corp", industry: "Tech"})')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-cyan-300">CREATE (alice:Person {`{name: "Alice", role: "Engineer"}`})<br />CREATE (bob:Person {`{name: "Bob", role: "Designer"}`})<br />CREATE (acme:Company {`{name: "ACME Corp", industry: "Tech"}`})</code>
                      <p className="text-gray-400 mt-1">Create a complete team structure</p>
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => setQueryText('CLEAR')}
                      className="text-left w-full p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                    >
                      <code className="text-red-300">CLEAR</code>
                      <p className="text-gray-400 mt-1">Clear all graph data</p>
                    </button>
                  </div>
                </div>
              </div>
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

          {activeTab === 'import' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Import CSV/Excel Data</h2>
              
              {/* File Upload Section */}
              <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                <h3 className="text-lg font-medium mb-3 text-white flex items-center">
                  <Upload className="w-5 h-5 mr-2" /> Upload File
                </h3>
                
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <div className="space-y-4">
                    <Upload className="w-8 h-8 mx-auto text-gray-400" />
                    <div>
                      <p className="text-gray-300 mb-2">Upload CSV File</p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-gray-300
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-semibold
                          file:bg-cyan-600 file:text-white
                          hover:file:bg-cyan-700 file:cursor-pointer"
                      />
                    </div>
                    <p className="text-gray-500 text-sm">Supports CSV files with headers</p>
                  </div>
                </div>
              </div>

              {/* Import Settings */}
              {csvData && (
                <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                  <h3 className="text-lg font-medium mb-3 text-white">Import Settings</h3>
                  
                  <div className="space-y-4">
                    {/* Node Configuration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Node Configuration</label>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Node Type Column</label>
                          <select 
                            value={importSettings.nodeTypeColumn}
                            onChange={(e) => {
                              const newSettings = { ...importSettings, nodeTypeColumn: e.target.value };
                              setImportSettings(newSettings);
                              if (csvData) generateImportPreview(csvData, newSettings);
                            }}
                            className="input text-sm"
                          >
                            <option value="">Select column...</option>
                            {(csvData.meta.fields || []).map(field => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Node ID Column</label>
                          <select 
                            value={importSettings.nodeIdColumn}
                            onChange={(e) => {
                              const newSettings = { ...importSettings, nodeIdColumn: e.target.value };
                              setImportSettings(newSettings);
                              if (csvData) generateImportPreview(csvData, newSettings);
                            }}
                            className="input text-sm"
                          >
                            <option value="">Select column...</option>
                            {(csvData.meta.fields || []).map(field => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Relationship Configuration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Relationship Configuration</label>
                      
                      <div className="space-y-3">
                        <select 
                          value={importSettings.relationshipMode}
                          onChange={(e) => {
                            const newSettings = { ...importSettings, relationshipMode: e.target.value as 'none' | 'sequential' | 'properties' };
                            setImportSettings(newSettings);
                            if (csvData) generateImportPreview(csvData, newSettings);
                          }}
                          className="input text-sm"
                        >
                          <option value="none">No relationships</option>
                          <option value="sequential">Sequential (each row connects to next)</option>
                          <option value="properties">From columns (source/target)</option>
                        </select>
                        
                        {importSettings.relationshipMode !== 'none' && (
                          <>
                            <input 
                              type="text"
                              placeholder="Relationship type (e.g., RELATED_TO)"
                              value={importSettings.relationshipType}
                              onChange={(e) => {
                                const newSettings = { ...importSettings, relationshipType: e.target.value };
                                setImportSettings(newSettings);
                                if (csvData) generateImportPreview(csvData, newSettings);
                              }}
                              className="input text-sm"
                            />
                            
                            {importSettings.relationshipMode === 'properties' && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Source Column</label>
                                  <select 
                                    value={importSettings.sourceColumn}
                                    onChange={(e) => {
                                      const newSettings = { ...importSettings, sourceColumn: e.target.value };
                                      setImportSettings(newSettings);
                                      if (csvData) generateImportPreview(csvData, newSettings);
                                    }}
                                    className="input text-sm"
                                  >
                                    <option value="">Select column...</option>
                                    {(csvData.meta.fields || []).map(field => (
                                      <option key={field} value={field}>{field}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">Target Column</label>
                                  <select 
                                    value={importSettings.targetColumn}
                                    onChange={(e) => {
                                      const newSettings = { ...importSettings, targetColumn: e.target.value };
                                      setImportSettings(newSettings);
                                      if (csvData) generateImportPreview(csvData, newSettings);
                                    }}
                                    className="input text-sm"
                                  >
                                    <option value="">Select column...</option>
                                    {(csvData.meta.fields || []).map(field => (
                                      <option key={field} value={field}>{field}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Options */}
                    <div>
                      <label className="flex items-center text-sm text-gray-300">
                        <input 
                          type="checkbox"
                          checked={importSettings.skipFirstRow}
                          onChange={(e) => {
                            const newSettings = { ...importSettings, skipFirstRow: e.target.checked };
                            setImportSettings(newSettings);
                            if (csvData) generateImportPreview(csvData, newSettings);
                          }}
                          className="mr-2"
                        />
                        Skip first row (if not using headers)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Section */}
              {importPreview.nodes.length > 0 && (
                <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900 bg-opacity-50">
                  <h3 className="text-lg font-medium mb-3 text-white">Import Preview</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-cyan-300 font-medium mb-2">
                        Nodes ({importPreview.nodes.length})
                      </h4>
                      <div className="bg-gray-800 rounded p-3 max-h-32 overflow-y-auto">
                        {importPreview.nodes.slice(0, 5).map((node, idx) => (
                          <div key={idx} className="text-xs text-gray-300 mb-1">
                            <span className="text-cyan-400">{node.type}</span>: {node.id}
                            {Object.keys(node.properties).length > 0 && (
                              <span className="text-gray-500 ml-2">
                                ({Object.keys(node.properties).join(', ')})
                              </span>
                            )}
                          </div>
                        ))}
                        {importPreview.nodes.length > 5 && (
                          <div className="text-xs text-gray-500">
                            ...and {importPreview.nodes.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {importPreview.relationships.length > 0 && (
                      <div>
                        <h4 className="text-purple-300 font-medium mb-2">
                          Relationships ({importPreview.relationships.length})
                        </h4>
                        <div className="bg-gray-800 rounded p-3 max-h-32 overflow-y-auto">
                          {importPreview.relationships.slice(0, 5).map((rel, idx) => (
                            <div key={idx} className="text-xs text-gray-300 mb-1">
                              <span className="text-cyan-400">{rel.sourceId}</span>
                              <span className="text-purple-400 mx-2">-[{rel.type}]-&gt;</span>
                              <span className="text-cyan-400">{rel.targetId}</span>
                            </div>
                          ))}
                          {importPreview.relationships.length > 5 && (
                            <div className="text-xs text-gray-500">
                              ...and {importPreview.relationships.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Button and Status */}
              {csvData && (
                <div className="mb-6 p-4 border border-cyan-600 rounded-lg bg-cyan-900 bg-opacity-30">
                  <h3 className="text-lg font-medium mb-3 text-cyan-300 flex items-center">
                    <FileText className="w-5 h-5 mr-2" /> CSV Data Loaded
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="text-sm text-gray-300">
                      <span className="font-medium">File Info:</span> {csvData.data.length} rows, {csvData.meta.fields?.length || 0} columns
                    </div>
                    
                    {csvData.meta.fields && (
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">Columns:</span> {csvData.meta.fields.join(', ')}
                      </div>
                    )}
                    
                    {importPreview.nodes.length > 0 ? (
                      <div className="bg-green-900 bg-opacity-50 border border-green-600 rounded p-3">
                        <div className="text-green-300 font-medium mb-2">✅ Preview Generated</div>
                        <div className="text-sm text-gray-300">
                          Ready to import: <span className="text-cyan-400">{importPreview.nodes.length} nodes</span>
                          {importPreview.relationships.length > 0 && (
                            <span>, <span className="text-purple-400">{importPreview.relationships.length} relationships</span></span>
                          )}
                        </div>
                        
                        <button
                          onClick={executeImport}
                          disabled={isImporting}
                          className="btn-primary w-full flex items-center justify-center mt-3"
                        >
                          {isImporting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Import {importPreview.nodes.length} Nodes
                          {importPreview.relationships.length > 0 && (
                            <span> &amp; {importPreview.relationships.length} Relationships</span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded p-3">
                        <div className="text-yellow-300 font-medium mb-2">⚠️ Configure Import Settings</div>
                        <div className="text-sm text-gray-300 mb-3">
                          Please configure the import settings above to generate a preview.
                        </div>
                        
                        <button
                          onClick={() => {
                            if (csvData && importSettings.nodeTypeColumn && importSettings.nodeIdColumn) {
                              generateImportPreview(csvData, importSettings);
                            } else {
                              showError('Please select node type and ID columns first');
                            }
                          }}
                          className="btn-secondary w-full flex items-center justify-center"
                        >
                          <Search className="w-4 h-4 mr-2" /> Generate Preview
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Legacy Import Button (keeping for backwards compatibility) */}
              {importPreview.nodes.length > 0 && !csvData && (
                <div className="mb-4">
                  <button
                    onClick={executeImport}
                    disabled={isImporting}
                    className="btn-primary w-full flex items-center justify-center"
                  >
                    {isImporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Import {importPreview.nodes.length} Nodes
                    {importPreview.relationships.length > 0 && (
                      <span> &amp; {importPreview.relationships.length} Relationships</span>
                    )}
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 border border-blue-700 rounded-lg bg-blue-900 bg-opacity-30">
                <h4 className="text-blue-300 font-medium mb-2">📋 How to Use CSV Import</h4>
                <div className="text-xs text-blue-200 space-y-1">
                  <p>• <strong>Upload:</strong> Select a CSV file with column headers</p>
                  <p>• <strong>Configure:</strong> Choose which columns represent node types, IDs, and relationships</p>
                  <p>• <strong>Preview:</strong> Review the data that will be imported before proceeding</p>
                  <p>• <strong>Import:</strong> Click the import button to add nodes and relationships to your graph</p>
                  <p>• <strong>Relationships:</strong> Choose &apos;Sequential&apos; to connect each row to the next, or &apos;From columns&apos; to specify source/target columns</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'save' && (
            <div className="flex-1 overflow-y-auto pr-2">
              <h2 className="text-xl font-semibold mb-3 text-cyan-300">Save / Load Graph</h2>
              
              {/* Display Saved Graph Info */}
              {state.savedGraphInfo && (
                <div className="mb-6 p-4 border border-green-600 rounded-lg bg-green-900 bg-opacity-30">
                  <h3 className="text-lg font-medium mb-2 text-green-300 flex items-center">
                    ✅ Graph Successfully Saved
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-300">Name:</span> 
                      <span className="text-white font-medium ml-2">{state.savedGraphInfo.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Blob ID:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="font-mono text-cyan-300 bg-gray-800 p-2 rounded flex-1 break-all">
                          {state.savedGraphInfo.blobId}
                        </div>
                        <button
                          onClick={() => copyToClipboard(state.savedGraphInfo!.blobId, 'blobId')}
                          className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                          title="Copy Blob ID"
                        >
                          {copyStatus.blobId ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-300">Transaction Digest:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="font-mono text-purple-300 bg-gray-800 p-2 rounded flex-1 break-all">
                          {state.savedGraphInfo.transactionDigest}
                        </div>
                        <button
                          onClick={() => copyToClipboard(state.savedGraphInfo!.transactionDigest, 'txDigest')}
                          className="p-2 text-gray-400 hover:text-purple-300 transition-colors"
                          title="Copy Transaction Digest"
                        >
                          {copyStatus.txDigest ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-300">Saved At:</span>
                      <span className="text-white ml-2">
                        {new Date(state.savedGraphInfo.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-700">
                      <h4 className="text-green-200 font-medium mb-2">🔍 Verification Instructions:</h4>
                      <div className="text-xs text-gray-300 space-y-1">
                        <p>• <strong>SUI Explorer:</strong> Visit <a href={`https://suiscan.xyz/testnet/tx/${state.savedGraphInfo.transactionDigest}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">https://suiscan.xyz/testnet/tx/{state.savedGraphInfo.transactionDigest}</a></p>
                        <p>• <strong>Walrus Storage:</strong> Your graph data is permanently stored in Walrus Blob: <span className="font-mono text-cyan-300">{state.savedGraphInfo.blobId}</span></p>
                        <p>• <strong>Immutable Proof:</strong> The transaction on SUI blockchain proves the ownership and timestamp of your graph</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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