"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { SuiGraphService } from '@/services/sui-service';
import { WalrusService } from '@/services/walrus-service';
import { CONSTANTS } from '../../constants';
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
  Download,
  Share2,
  Users,
  Globe,
  Tag,
  TrendingUp,
  GitBranch,
  Eye,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

// Dynamically import Monaco Editor
const Editor = dynamic(() => import('@monaco-editor/react'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-48 bg-gray-800 border border-gray-700 rounded flex items-center justify-center">
      <div className="text-gray-400">Loading editor...</div>
    </div>
  )
});

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

interface GraphAnalysisResult {
  centrality: Array<{ nodeId: string; degree: number; betweenness?: number; closeness?: number; pagerank?: number }>;
  components: string[][];
  pagerank: Array<{ nodeId: string; degree: number; betweenness?: number; closeness?: number; pagerank?: number }>;
  shortestPaths?: Array<{ source: string; target: string; path: string[]; length: number }>;
}

interface BrowsedGraph {
  id: string;
  name: string;
  description: string;
  blobId: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  relationshipCount: number;
  isPublic: boolean;
  tags: string[];
  version: number;
}

interface ShareGraphState {
  graphId: string | null;
  recipientAddress: string;
  isSharing: boolean;
}

interface UpdateGraphState {
  graphId: string | null;
  currentMetadata: BrowsedGraph | null;
  name: string;
  description: string;
  tags: string;
  isPublic: boolean;
  isUpdating: boolean;
}

interface DownloadFormat {
  type: 'json' | 'csv' | 'cypher' | 'graphml';
  name: string;
  description: string;
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
  const [activeTab, setActiveTab] = useState<'query' | 'create' | 'stats' | 'save' | 'import' | 'browse'>('create');
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

  // Selected graph for editing/sharing
  const [selectedGraph, setSelectedGraph] = useState<BrowsedGraph | null>(null);
  const [editMode, setEditMode] = useState<'save' | 'update' | 'share'>('save');

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

  // Add new state for enhanced features
  const [analysisResult, setAnalysisResult] = useState<GraphAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [browsedGraphs, setBrowsedGraphs] = useState<{
    public: BrowsedGraph[];
    owned: BrowsedGraph[];
    shared: BrowsedGraph[];
    byTag: Record<string, BrowsedGraph[]>;
  }>({
    public: [],
    owned: [],
    shared: [],
    byTag: {}
  });
  const [browseLoading, setBrowseLoading] = useState(false);
  const [shareState, setShareState] = useState<ShareGraphState>({
    graphId: null,
    recipientAddress: '',
    isSharing: false
  });
  const [graphUpdateState, setGraphUpdateState] = useState<UpdateGraphState>({
    graphId: null,
    currentMetadata: null,
    name: '',
    description: '',
    tags: '',
    isPublic: false,
    isUpdating: false
  });
  const [pathAnalysisForm, setPathAnalysisForm] = useState({
    sourceId: '',
    targetId: '',
    maxDepth: 5
  });
  const [graphHistory, setGraphHistory] = useState<Array<{
    version: number;
    changedAt: number;
    changes: string;
    transactionDigest: string;
    eventType: string;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTag, setSearchTag] = useState('');
  const [eventSubscription, setEventSubscription] = useState<(() => void) | null>(null);
  const [enableRealTimeUpdates, setEnableRealTimeUpdates] = useState(false);

  // Initialize services with useMemo to prevent recreation on every render
  const suiService = useMemo(() => new SuiGraphService(), []);
  const walrusService = useMemo(() => new WalrusService(), []);

  // Add state for load graph form
  const [loadForm, setLoadForm] = useState({
    blobId: ''
  });

  const showSuccess = useCallback((message: string) => {
    console.log('✅', message);
    // You could replace this with a toast notification
  }, []);

  const showError = useCallback((message: string) => {
    console.error('❌', message);
    setState(prev => ({ ...prev, error: message }));
    // You could replace this with a toast notification
  }, []);

  // Load graph history
  const loadGraphHistory = async (graphId: string) => {
    setHistoryLoading(true);
    try {
      const history = await suiService.getGraphHistory(graphId);
      setGraphHistory(history);
      showSuccess(`Loaded ${history.length} history entries`);
    } catch (error) {
      showError(`Failed to load graph history: ${error}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Define updateState function
  const updateState = useCallback(() => {
    const data = graphService.getAllData();
    setState({
      nodes: data.nodes,
      relationships: data.relationships,
      selectedNode: null,
      selectedRelationship: null,
      queryResult: null,
      isLoading: false,
      error: null,
      stats: graphService.getGraphStats(),
      savedGraphInfo: null
    });
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
    console.log('🚀 STARTING QUERY EXECUTION');
    console.log('📊 Current graph state:', {
      nodeCount: state.nodes.length,
      relationshipCount: state.relationships.length,
      nodeTypes: state.nodes.map(n => n.type),
      nodes: state.nodes
    });

    // Set loading state
    setState(prev => ({ ...prev, isLoading: true, error: null, queryResult: null }));

    try {
      // Parse and execute simple commands
      const commands = queryText.split('\n').filter(line => line.trim());
      const results: QueryCommand[] = [];
      let executedCommands = 0;
      let totalNodes = 0;
      let totalRelationships = 0;

      console.log('📝 Commands to execute:', commands);

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
        } else if (cmd.toUpperCase().startsWith('MATCH')) {
          console.log('🎯 MATCH command detected:', cmd);
          try {
            const result = executeMatchCommand(cmd);
            console.log('✅ MATCH result:', result);
            results.push({
              command: cmd,
              type: 'MATCH',
              result: result,
              success: true
            });
            executedCommands++;
            if (result.matchedNodes) totalNodes += result.matchedNodes.length;
            if (result.matchedRelationships) totalRelationships += result.matchedRelationships.length;
          } catch (matchError) {
            console.error('❌ MATCH command failed:', matchError);
            results.push({
              command: cmd,
              type: 'MATCH',
              result: `Error: ${matchError}`,
              success: false
            });
          }
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

      console.log('🎉 FINAL QUERY RESULT:', finalResult);
      console.log('🔍 Results breakdown:', {
        executedCommands,
        results,
        totalNodes,
        totalRelationships
      });

      // Get the latest graph data from graphService (for CREATE/CLEAR commands)
      const latestGraphData = graphService.getAllData();
      
      // Update state with result, latest graph data, and loading=false in single call
      setState(prev => ({ 
        ...prev, 
        nodes: latestGraphData.nodes,           // Update nodes from graphService
        relationships: latestGraphData.relationships, // Update relationships from graphService  
        stats: graphService.getGraphStats(),   // Update stats
        queryResult: finalResult,              // Keep the query result
        isLoading: false,
        error: null
      }));
      
      if (executedCommands > 0) {
        showSuccess(`Query executed successfully: ${executedCommands} commands processed, ${totalNodes} nodes, ${totalRelationships} relationships found`);
      } else {
        showError('No valid commands found to execute');
      }
    } catch (error) {
      console.error('💥 Query execution error:', error);
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
      
      // Update state with error result and loading=false in single call
      setState(prev => ({ 
        ...prev, 
        queryResult: errorResult,
        isLoading: false,
        error: `Query execution failed: ${error}`
      }));
      
      showError(`Query execution failed: ${error}`);
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
      console.log('🔍 Available nodes:', state.nodes.length);
      console.log('🔍 Node types:', state.nodes.map(n => n.type));
      
      // Basic pattern: MATCH (n:Type) RETURN n or MATCH (n) RETURN n
      const simpleMatch = command.match(/MATCH\s*\(\s*(\w+)(?:\s*:\s*(\w+))?\s*\)\s*RETURN\s+(\w+)/i);
      if (simpleMatch) {
        const [, variable, type, returnVar] = simpleMatch;
        console.log('🔍 Parsed:', { variable, type, returnVar });
        
        let matchedNodes = state.nodes;
        if (type) {
          matchedNodes = state.nodes.filter(node => node.type === type);
          console.log(`🔍 Filtered by type "${type}":`, matchedNodes.length, 'nodes');
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
      if (command.match(/MATCH\s*\(\s*\w*\s*\)\s*RETURN/i)) {
        console.log('🔍 Matching all nodes:', state.nodes.length);
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
      const relMatch = command.match(/MATCH\s*\(\s*\w*\s*\)\s*-\s*\[\s*\w*\s*:?\s*(\w+)?\s*\]\s*-\s*\(\s*\w*\s*\)/i);
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

  const analyzeGraph = async () => {
    if (state.nodes.length === 0) {
      showError('No graph data to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const centrality = graphService.calculateDegreeCentrality();
      const components = graphService.findConnectedComponents();
      const pagerank = graphService.calculatePageRank();

      const result: GraphAnalysisResult = {
        centrality,
        components,
        pagerank
      };

      setAnalysisResult(result);
      showSuccess(`Analysis complete: Found ${components.length} connected components`);
    } catch (error) {
      showError(`Analysis failed: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Path analysis function
  const analyzeShortestPath = async () => {
    if (!pathAnalysisForm.sourceId || !pathAnalysisForm.targetId) {
      showError('Please specify both source and target nodes');
      return;
    }

    setIsAnalyzing(true);
    try {
      const path = graphService.findShortestPath(
        pathAnalysisForm.sourceId, 
        pathAnalysisForm.targetId
      );
      
      if (path) {
        const allPaths = graphService.findAllPaths(
          pathAnalysisForm.sourceId,
          pathAnalysisForm.targetId,
          pathAnalysisForm.maxDepth
        );

        setAnalysisResult(prev => ({
          ...prev!,
          shortestPaths: [
            {
              source: pathAnalysisForm.sourceId,
              target: pathAnalysisForm.targetId,
              path: path.nodes.map(n => n.id),
              length: path.length
            },
            ...allPaths.slice(0, 5).map(p => ({
              source: pathAnalysisForm.sourceId,
              target: pathAnalysisForm.targetId,
              path: p.nodes.map(n => n.id),
              length: p.length
            }))
          ]
        }));

        // Highlight path in visualization (future feature)
        showSuccess(`Found shortest path with ${path.length} steps`);
      } else {
        showError('No path found between specified nodes');
      }
    } catch (error) {
      showError(`Path analysis failed: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Browse graphs functions
  const loadPublicGraphs = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const publicGraphIds = await suiService.getPublicGraphs();
      const graphs = await Promise.all(
        publicGraphIds.map((id: string) => suiService.getGraphMetadata(id))
      );
      const validGraphs = graphs.filter(g => g !== null) as BrowsedGraph[];
      
      setBrowsedGraphs(prev => ({ ...prev, public: validGraphs }));
      showSuccess(`Loaded ${validGraphs.length} public graphs`);
    } catch (error) {
      console.error('Error loading public graphs:', error);
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        showError('Unable to connect to Sui network. Please check your internet connection and try again.');
      } else if (error instanceof Error && error.message.includes('Failed to fetch')) {
        showError('Sui network is currently unavailable. Please try again later.');
      } else {
        showError(`Failed to load public graphs: ${error}`);
      }
      // Set empty array so UI shows "no graphs" instead of loading forever
      setBrowsedGraphs(prev => ({ ...prev, public: [] }));
    } finally {
      setBrowseLoading(false);
    }
  }, [suiService, showError, showSuccess]);

  const loadMyGraphs = useCallback(async () => {
    if (!currentAccount) {
      showError('Connect wallet to load your graphs');
      return;
    }

    setBrowseLoading(true);
    try {
      const graphs = await suiService.getUserGraphs(currentAccount.address);
      setBrowsedGraphs(prev => ({ ...prev, owned: graphs }));
      if (graphs.length === 0) {
        console.log('ℹ️ No graphs found for user:', currentAccount.address);
      } else {
        showSuccess(`Loaded ${graphs.length} of your graphs`);
      }
    } catch (error) {
      console.error('Error loading user graphs:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        showError('Unable to connect to Sui network. Please check your internet connection.');
      } else if (error instanceof Error && error.message.includes('Failed to fetch')) {
        showError('Sui network is currently unavailable. Your graphs will load when connection is restored.');
      } else if (error instanceof Error && error.message.includes('Unexpected object content')) {
        console.warn('⚠️ Graph objects may have unexpected structure:', error.message);
        showError('Some graph data could not be loaded due to format issues. Please try refreshing.');
        // Set empty array to prevent UI issues
        setBrowsedGraphs(prev => ({ ...prev, owned: [] }));
      } else {
        showError(`Failed to load your graphs: ${error}`);
      }
      setBrowsedGraphs(prev => ({ ...prev, owned: [] }));
    } finally {
      setBrowseLoading(false);
    }
  }, [currentAccount, suiService, showError, showSuccess]);

  const loadGraphsByTag = async (tag: string) => {
    setBrowseLoading(true);
    try {
      const graphIds = await suiService.getGraphsByTag(tag);
      const graphs = await Promise.all(
        graphIds.map((id: string) => suiService.getGraphMetadata(id))
      );
      const validGraphs = graphs.filter(g => g !== null) as BrowsedGraph[];
      
      setBrowsedGraphs(prev => ({ 
        ...prev, 
        byTag: { ...prev.byTag, [tag]: validGraphs }
      }));
      showSuccess(`Found ${validGraphs.length} graphs with tag "${tag}"`);
    } catch (error) {
      console.error('Error searching by tag:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        showError('Unable to connect to Sui network. Please check your internet connection.');
      } else {
        showError(`Failed to search by tag: ${error}`);
      }
    } finally {
      setBrowseLoading(false);
    }
  };

  // Share graph function
  const shareGraphWithUser = async () => {
    if (!shareState.graphId || !shareState.recipientAddress) {
      showError('Please specify graph and recipient address');
      return;
    }

    if (!currentAccount) {
      showError('Connect wallet to share graphs');
      return;
    }

    setShareState(prev => ({ ...prev, isSharing: true }));
    try {
      // First get the graph metadata to verify ownership
      const graphMetadata = await suiService.getGraphMetadata(shareState.graphId);
      if (!graphMetadata || graphMetadata.owner !== currentAccount.address) {
        throw new Error('You can only share graphs that you own');
      }

      // Execute share transaction via Move contract
      const tx = new Transaction();
      tx.moveCall({
        target: `${CONSTANTS.packageId}::graph_metadata::share_graph`,
        arguments: [
          tx.object(shareState.graphId),
          tx.object(CONSTANTS.registryId),
          tx.pure.address(shareState.recipientAddress),
        ],
      });

      await signAndExecute({
        transaction: tx,
        options: { showEffects: true, showEvents: true }
      });

      showSuccess(`Graph shared successfully with ${shareState.recipientAddress}`);
      setShareState({ graphId: null, recipientAddress: '', isSharing: false });
    } catch (error) {
      showError(`Failed to share graph: ${error}`);
    } finally {
      setShareState(prev => ({ ...prev, isSharing: false }));
    }
  };

  // Update graph metadata function
  const updateGraphMetadata = async () => {
    if (!graphUpdateState.graphId || !graphUpdateState.currentMetadata) {
      showError('No graph selected for update');
      return;
    }

    if (!currentAccount) {
      showError('Connect wallet to update graphs');
      return;
    }

    setGraphUpdateState(prev => ({ ...prev, isUpdating: true }));
    try {
      // Verify ownership
      if (graphUpdateState.currentMetadata.owner !== currentAccount.address) {
        throw new Error('You can only update graphs that you own');
      }

      // Parse tags
      const tags = graphUpdateState.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

      // Get current graph data to re-save to Walrus if needed
      const currentData = graphService.getAllData();
      let blobId = graphUpdateState.currentMetadata.blobId;

      // If graph data changed, save to Walrus again
      if (currentData.nodes.length > 0) {
        const walrusResult = await walrusService.storeGraph(
          currentData.nodes,
          currentData.relationships,
          {
            name: graphUpdateState.name,
            description: graphUpdateState.description
          }
        );
        blobId = walrusResult.blobId;
      }

      // Update metadata on blockchain
      await suiService.updateGraphMetadata(
        graphUpdateState.graphId,
        {
          name: graphUpdateState.name,
          description: graphUpdateState.description,
          blobId,
          nodeCount: currentData.nodes.length,
          relationshipCount: currentData.relationships.length,
          isPublic: graphUpdateState.isPublic,
          tags
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signAndExecute as any
      );

      showSuccess('Graph metadata updated successfully');
      setGraphUpdateState({
        graphId: null,
        currentMetadata: null,
        name: '',
        description: '',
        tags: '',
        isPublic: false,
        isUpdating: false
      });

      // Refresh owned graphs
      loadMyGraphs();
    } catch (error) {
      showError(`Failed to update graph: ${error}`);
    } finally {
      setGraphUpdateState(prev => ({ ...prev, isUpdating: false }));
    }
  };

  // Function to select graph for editing
  const selectGraphForEdit = (graph: BrowsedGraph) => {
    setSelectedGraph(graph);
    setGraphUpdateState({
      graphId: graph.id,
      currentMetadata: graph,
      name: graph.name,
      description: graph.description,
      tags: graph.tags.join(', '),
      isPublic: graph.isPublic,
      isUpdating: false
    });
    setEditMode('update');
    setActiveTab('save');
  };

  // Function to select graph for sharing
  const selectGraphForShare = (graph: BrowsedGraph) => {
    setSelectedGraph(graph);
    setShareState({
      graphId: graph.id,
      recipientAddress: '',
      isSharing: false
    });
    setEditMode('share');
    setActiveTab('save');
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

  // Download formats configuration
  const downloadFormats: DownloadFormat[] = [
    { type: 'json', name: 'JSON', description: 'Complete graph structure' },
    { type: 'csv', name: 'CSV', description: 'Tabular format (nodes + relationships)' },
    { type: 'cypher', name: 'Cypher', description: 'Executable Cypher statements' },
    { type: 'graphml', name: 'GraphML', description: 'Standard graph format' }
  ];

  // CSV generation helper functions
  const generateNodesCsv = (nodes: GraphNode[]): string => {
    if (nodes.length === 0) return 'id,type';
    
    // Get all unique property keys
    const allProps = new Set<string>();
    nodes.forEach(node => Object.keys(node.properties).forEach(key => allProps.add(key)));
    const propKeys = Array.from(allProps).sort();
    
    const headers = ['id', 'type', ...propKeys];
    const rows = nodes.map(node => {
      const row = [
        `"${node.id}"`,
        `"${node.type}"`,
        ...propKeys.map(key => {
          const value = node.properties[key];
          return value !== undefined ? `"${String(value).replace(/"/g, '""')}"` : '';
        })
      ];
      return row.join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  };

  const generateRelationshipsCsv = (relationships: GraphRelationship[]): string => {
    if (relationships.length === 0) return 'id,type,sourceId,targetId';
    
    // Get all unique property keys
    const allProps = new Set<string>();
    relationships.forEach(rel => Object.keys(rel.properties).forEach(key => allProps.add(key)));
    const propKeys = Array.from(allProps).sort();
    
    const headers = ['id', 'type', 'sourceId', 'targetId', ...propKeys];
    const rows = relationships.map(rel => {
      const row = [
        `"${rel.id}"`,
        `"${rel.type}"`,
        `"${rel.sourceId}"`,
        `"${rel.targetId}"`,
        ...propKeys.map(key => {
          const value = rel.properties[key];
          return value !== undefined ? `"${String(value).replace(/"/g, '""')}"` : '';
        })
      ];
      return row.join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  };

  // Cypher generation helper function
  const generateCypherStatements = (nodes: GraphNode[], relationships: GraphRelationship[]): string => {
    const statements: string[] = [];
    
    // Add header comment
    statements.push('// Graph Export - Generated Cypher Statements');
    statements.push(`// Exported at: ${new Date().toISOString()}`);
    statements.push(`// Nodes: ${nodes.length}, Relationships: ${relationships.length}`);
    statements.push('');
    
    // Clear existing data
    statements.push('// Clear existing data');
    statements.push('MATCH (n) DETACH DELETE n;');
    statements.push('');
    
    // Create nodes
    statements.push('// Create nodes');
    nodes.forEach(node => {
      const propsStr = Object.keys(node.properties).length > 0 
        ? ' ' + JSON.stringify(node.properties).replace(/"/g, '"')
        : '';
      statements.push(`CREATE (${node.id.replace(/[^a-zA-Z0-9]/g, '_')}:${node.type}${propsStr});`);
    });
    statements.push('');
    
    // Create relationships
    if (relationships.length > 0) {
      statements.push('// Create relationships');
      relationships.forEach(rel => {
        const propsStr = Object.keys(rel.properties).length > 0 
          ? ' ' + JSON.stringify(rel.properties).replace(/"/g, '"')
          : '';
        statements.push(`MATCH (source {id: "${rel.sourceId}"}), (target {id: "${rel.targetId}"}) CREATE (source)-[:${rel.type}${propsStr}]->(target);`);
      });
    }
    
    return statements.join('\n');
  };

  // GraphML generation helper function
  const generateGraphML = (nodes: GraphNode[], relationships: GraphRelationship[]): string => {
    const xml: string[] = [];
    
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">');
    
    // Define attribute keys
    xml.push('  <key id="type" for="node" attr.name="type" attr.type="string"/>');
    xml.push('  <key id="name" for="node" attr.name="name" attr.type="string"/>');
    xml.push('  <key id="relType" for="edge" attr.name="type" attr.type="string"/>');
    
    xml.push('  <graph id="G" edgedefault="directed">');
    
    // Add nodes
    nodes.forEach(node => {
      xml.push(`    <node id="${node.id}">`);
      xml.push(`      <data key="type">${node.type}</data>`);
      if (node.properties.name) {
        xml.push(`      <data key="name">${String(node.properties.name)}</data>`);
      }
      xml.push(`    </node>`);
    });
    
    // Add edges
    relationships.forEach((rel, index) => {
      xml.push(`    <edge id="e${index}" source="${rel.sourceId}" target="${rel.targetId}">`);
      xml.push(`      <data key="relType">${rel.type}</data>`);
      xml.push(`    </edge>`);
    });
    
    xml.push('  </graph>');
    xml.push('</graphml>');
    
    return xml.join('\n');
  };

  // Main download content generation function
  const generateDownloadContent = (nodes: GraphNode[], relationships: GraphRelationship[], format: string, queryContext?: string) => {
    switch (format) {
      case 'json':
        return {
          content: JSON.stringify({
            metadata: {
              exportedAt: new Date().toISOString(),
              queryContext: queryContext || 'Full graph export',
              nodeCount: nodes.length,
              relationshipCount: relationships.length
            },
            nodes,
            relationships
          }, null, 2),
          filename: `graph-export-${Date.now()}.json`,
          mimeType: 'application/json'
        };

      case 'csv':
        // Create separate CSV content for nodes and relationships
        const nodesCsv = generateNodesCsv(nodes);
        const relsCsv = generateRelationshipsCsv(relationships);
        const combinedCsv = `# Nodes\n${nodesCsv}\n\n# Relationships\n${relsCsv}`;
        return {
          content: combinedCsv,
          filename: `graph-export-${Date.now()}.csv`,
          mimeType: 'text/csv'
        };

      case 'cypher':
        const cypherStatements = generateCypherStatements(nodes, relationships);
        return {
          content: cypherStatements,
          filename: `graph-export-${Date.now()}.cypher`,
          mimeType: 'text/plain'
        };

      case 'graphml':
        const graphmlContent = generateGraphML(nodes, relationships);
        return {
          content: graphmlContent,
          filename: `graph-export-${Date.now()}.graphml`,
          mimeType: 'application/xml'
        };

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  };

  // Download query result function
  const downloadQueryResult = (format: string) => {
    let nodes: GraphNode[] = [];
    let relationships: GraphRelationship[] = [];
    let queryContext = '';
    
    if (state.queryResult && state.queryResult.aggregations) {
      const commands = getCommands(state.queryResult.aggregations);
      const matchCommands = commands.filter(cmd => cmd.type === 'MATCH' && cmd.success);
      
      if (matchCommands.length > 0) {
        // Get nodes and relationships from successful MATCH commands
        matchCommands.forEach(cmd => {
          const result = cmd.result as MatchCommandResult;
          if (result.matchedNodes) {
            result.matchedNodes.forEach(node => {
              if (!nodes.find(n => n.id === node.id)) {
                nodes.push({
                  id: node.id,
                  type: node.type,
                  properties: node.properties
                } as GraphNode);
              }
            });
          }
          if (result.matchedRelationships) {
            result.matchedRelationships.forEach(rel => {
              if (!relationships.find(r => r.id === rel.id)) {
                relationships.push({
                  id: rel.id,
                  type: rel.type,
                  sourceId: rel.sourceId,
                  targetId: rel.targetId,
                  properties: rel.properties
                } as GraphRelationship);
              }
            });
          }
        });
        queryContext = `Query results: ${matchCommands.map(c => c.command).join('; ')}`;
      }
    }
    
    // Fallback to full graph if no query results
    if (nodes.length === 0 && relationships.length === 0) {
      nodes = state.nodes;
      relationships = state.relationships;
      queryContext = 'Full graph export';
    }
    
    try {
      const { content, filename, mimeType } = generateDownloadContent(nodes, relationships, format, queryContext);
      const blob = new Blob([content], { type: mimeType });
      saveAs(blob, filename);
      showSuccess(`Downloaded ${nodes.length} nodes and ${relationships.length} relationships as ${format.toUpperCase()}`);
    } catch (error) {
      showError(`Download failed: ${error}`);
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

  // Auto-load browse data when tab is selected
  useEffect(() => {
    if (activeTab === 'browse' && browsedGraphs.public.length === 0) {
      // Add a small delay to avoid immediate network calls on mount
      const timer = setTimeout(() => {
        loadPublicGraphs();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeTab, browsedGraphs.public.length, loadPublicGraphs]);

  useEffect(() => {
    if (activeTab === 'browse' && currentAccount && browsedGraphs.owned.length === 0) {
      // Add a small delay to avoid immediate network calls on mount
      const timer = setTimeout(() => {
        loadMyGraphs();
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [activeTab, currentAccount, browsedGraphs.owned.length, loadMyGraphs]);

  // Event subscription setup
  useEffect(() => {
    // DISABLED: Automatic event subscription causes continuous WebSocket failures
    // Only enable if explicitly requested by user
    return;
  }, []);

  // Manual event subscription function (opt-in)
  const enableEventSubscription = useCallback(async () => {
    if (!currentAccount) {
      showError('Connect wallet to enable real-time updates');
      return;
    }

    try {
      console.log('🔔 Manually enabling event subscription for user:', currentAccount.address);
      
      const unsubscribe = await suiService.subscribeToGraphEvents(
        (event) => {
          console.log('📧 Graph event received:', event);
          
          // Show notification to user
          if (event.type === 'GraphCreated') {
            showSuccess(`New graph created: ${event.data.name || 'Unknown'}`);
          } else if (event.type === 'GraphUpdated') {
            showSuccess(`Graph updated: ${event.data.name || 'Unknown'}`);
          } else if (event.type === 'GraphShared') {
            showSuccess(`Graph shared with you!`);
          }
          
          // Refresh browse data
          if (activeTab === 'browse') {
            loadMyGraphs();
            loadPublicGraphs();
          }
        },
        { owner: currentAccount.address }
      );
      
      setEventSubscription(() => unsubscribe);
      setEnableRealTimeUpdates(true);
      showSuccess('Real-time updates enabled');
    } catch (error) {
      console.error('❌ Failed to setup event subscription:', error);
      showError('Failed to enable real-time updates. This may be due to network connectivity.');
    }
  }, [currentAccount, activeTab, loadMyGraphs, loadPublicGraphs, showError, showSuccess, suiService]);

  const disableEventSubscription = useCallback(() => {
    if (eventSubscription) {
      eventSubscription();
      setEventSubscription(null);
    }
    setEnableRealTimeUpdates(false);
    console.log('📵 Real-time updates disabled');
  }, [eventSubscription]);

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            <span className="text-sm text-gray-400 hover:text-white transition-colors">Back to Home</span>
          </Link>
          <div className="h-6 w-px bg-gray-700"></div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            WalGraph Editor
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <ConnectButton />
          {state.savedGraphInfo && (
            <div className="text-xs bg-gray-800 border border-green-700 px-3 py-2 rounded-lg">
              <div className="text-green-400 font-medium">✅ Saved to Walrus</div>
              <div className="text-gray-400">Blob: <span className="font-mono text-cyan-400">{state.savedGraphInfo.blobId.slice(0, 8)}...</span></div>
            </div>
          )}
          <div className="text-sm bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg">
            <div className="flex space-x-4">
              <span>Nodes: <span className="text-cyan-400 font-medium">{state.stats?.nodeCount || 0}</span></span>
              <span>Relationships: <span className="text-purple-400 font-medium">{state.stats?.relationshipCount || 0}</span></span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          {/* Navigation Header */}
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Graph Tools</h2>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-2">
            <div className="space-y-1">
              <button
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'create' 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setActiveTab('create')}
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Create</span>
              </button>

              <button
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'query' 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setActiveTab('query')}
              >
                <Search className="w-5 h-5" />
                <span className="font-medium">Query</span>
              </button>

              <button
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'stats' 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setActiveTab('stats')}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">Analytics</span>
              </button>

              <button
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'import' 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setActiveTab('import')}
              >
                <Upload className="w-5 h-5" />
                <span className="font-medium">Import</span>
              </button>

              <button
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'save' 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setActiveTab('save')}
              >
                <Database className="w-5 h-5" />
                <span className="font-medium">Save & Share</span>
              </button>

              <button
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === 'browse' 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                onClick={() => setActiveTab('browse')}
              >
                <Globe className="w-5 h-5" />
                <span className="font-medium">Browse</span>
              </button>
            </div>

            {/* Quick Actions Section */}
            <div className="mt-8 pt-4 border-t border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={createSampleData}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Database className="w-4 h-4" />
                  <span>Sample Data</span>
                </button>
                <button
                  onClick={analyzeGraph}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Run Analysis</span>
                </button>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Active Panel Content */}
          <div className="w-80 bg-gray-950 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {activeTab === 'create' && 'Create Elements'}
                {activeTab === 'query' && 'Graph Query'}
                {activeTab === 'stats' && 'Graph Analytics'}
                {activeTab === 'import' && 'Data Import'}
                {activeTab === 'save' && 'Save & Share'}
                {activeTab === 'browse' && 'Browse Graphs'}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'create' && (
                <div className="space-y-6">
                  {/* Create Node Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Node
                    </h3>
                    <label htmlFor="nodeType" className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                    <input
                      type="text"
                      id="nodeType"
                      value={createForm.nodeType}
                      onChange={(e) => setCreateForm({ ...createForm, nodeType: e.target.value })}
                      placeholder="e.g., Person, Company"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3"
                    />
                    <label htmlFor="nodeProps" className="block text-sm font-medium text-gray-300 mb-1">Properties (JSON)</label>
                    <textarea
                      id="nodeProps"
                      value={createForm.nodeProps}
                      onChange={(e) => setCreateForm({ ...createForm, nodeProps: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3 resize-y"
                      placeholder='{"name": "Jane Doe", "age": 42}'
                    ></textarea>
                    <button
                      onClick={createNode}
                      className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Create Node
                    </button>
                  </div>

                  {/* Create Relationship Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Relationship
                    </h3>
                    <label htmlFor="relType" className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                    <input
                      type="text"
                      id="relType"
                      value={createForm.relType}
                      onChange={(e) => setCreateForm({ ...createForm, relType: e.target.value })}
                      placeholder="e.g., KNOWS, WORKS_AT"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3"
                    />

                    <label htmlFor="sourceNode" className="block text-sm font-medium text-gray-300 mb-1">Source Node</label>
                    <select
                      id="sourceNode"
                      value={createForm.sourceNodeId}
                      onChange={(e) => setCreateForm({ ...createForm, sourceNodeId: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3"
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
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3"
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
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3 resize-y"
                      placeholder='{"since": "2023-01-01"}'
                    ></textarea>
                    <button
                      onClick={createRelationship}
                      className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Create Relationship
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
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 flex items-center justify-center"
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

                      {/* Download Results Section */}
                      {!hasAggregationError(state.queryResult.aggregations) && (
                        <div className="p-4 bg-gray-900 bg-opacity-70 rounded-lg border border-gray-700">
                          <h3 className="text-white font-semibold mb-3 flex items-center">
                            <Download className="w-5 h-5 mr-2 text-cyan-400" />
                            Download Results
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {downloadFormats.map(format => (
                              <button
                                key={format.type}
                                onClick={() => downloadQueryResult(format.type)}
                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded text-sm transition-colors flex items-center justify-center"
                                title={format.description}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                {format.name}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Download query results or full graph in various formats
                          </p>
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
                <div className="space-y-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4">Overview</h3>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-300">Total Nodes: <span className="text-cyan-400 font-medium">{state.stats?.nodeCount || 0}</span></p>
                      <p className="text-gray-300">Total Relationships: <span className="text-purple-400 font-medium">{state.stats?.relationshipCount || 0}</span></p>
                      <p className="text-gray-300">Node Types: <span className="text-orange-400 font-medium">{Object.keys(state.stats?.nodeTypes || {}).length}</span></p>
                      <p className="text-gray-300">Relationship Types: <span className="text-green-400 font-medium">{Object.keys(state.stats?.relationshipTypes || {}).length}</span></p>
                    </div>
                  </div>

                  {/* Graph Analysis Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Graph Analysis
                    </h3>
                    <div className="space-y-3">
                      <button
                        onClick={analyzeGraph}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center"
                        disabled={isAnalyzing || state.nodes.length === 0}
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <BarChart3 className="w-4 h-4 mr-2" />
                        )}
                        Analyze Graph Structure
                      </button>

                      {/* Path Analysis */}
                      <div className="border-t border-gray-700 pt-3">
                        <h4 className="text-white font-medium mb-2">Path Analysis</h4>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Source node ID"
                            value={pathAnalysisForm.sourceId}
                            onChange={(e) => setPathAnalysisForm({...pathAnalysisForm, sourceId: e.target.value})}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Target node ID"
                            value={pathAnalysisForm.targetId}
                            onChange={(e) => setPathAnalysisForm({...pathAnalysisForm, targetId: e.target.value})}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                          />
                          <button
                            onClick={analyzeShortestPath}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center text-sm"
                            disabled={isAnalyzing || !pathAnalysisForm.sourceId || !pathAnalysisForm.targetId}
                          >
                            {isAnalyzing ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <GitBranch className="w-4 h-4 mr-2" />
                            )}
                            Find Shortest Path
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Results */}
                  {analysisResult && (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                      <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analysis Results
                      </h3>
                      
                      {/* Centrality Results */}
                      {analysisResult.centrality && (
                        <div className="mb-4">
                          <h4 className="text-white font-medium mb-2">Node Centrality (Top 5)</h4>
                          <div className="space-y-1 text-sm">
                            {analysisResult.centrality.slice(0, 5).map((node) => (
                              <div key={node.nodeId} className="flex justify-between items-center">
                                <span className="text-gray-300">{node.nodeId}</span>
                                <span className="text-cyan-400 font-medium">Degree: {node.degree}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Connected Components */}
                      {analysisResult.components && (
                        <div className="mb-4">
                          <h4 className="text-white font-medium mb-2">Connected Components</h4>
                          <p className="text-gray-300 text-sm">
                            Found <span className="text-orange-400 font-medium">{analysisResult.components.length}</span> connected components
                          </p>
                          <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                            {analysisResult.components.map((component, i) => (
                              <div key={i} className="text-gray-400">
                                Component {i + 1}: {component.length} nodes
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* PageRank Results */}
                      {analysisResult.pagerank && (
                        <div className="mb-4">
                          <h4 className="text-white font-medium mb-2">PageRank (Top 5)</h4>
                          <div className="space-y-1 text-sm">
                            {analysisResult.pagerank.slice(0, 5).map((node) => (
                              <div key={node.nodeId} className="flex justify-between items-center">
                                <span className="text-gray-300">{node.nodeId}</span>
                                <span className="text-purple-400 font-medium">PR: {node.pagerank?.toFixed(4) || 'N/A'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shortest Path Results */}
                      {analysisResult.shortestPaths && (
                        <div className="mb-4">
                          <h4 className="text-white font-medium mb-2">Path Analysis</h4>
                          <div className="space-y-2 text-sm">
                            {analysisResult.shortestPaths.map((pathInfo, i) => (
                              <div key={i} className="bg-gray-800 p-2 rounded">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-gray-300">Path {i + 1}</span>
                                  <span className="text-green-400 font-medium">Length: {pathInfo.length}</span>
                                </div>
                                <div className="text-gray-400 text-xs font-mono">
                                  {pathInfo.path.join(' → ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4">Node Type Distribution</h3>
                    <div className="space-y-1 text-sm">
                      {state.stats?.nodeTypes && Object.entries(state.stats.nodeTypes).map(([type, count]) => (
                        <p key={type} className="text-gray-300">{type}: <span className="text-cyan-400 font-medium">{count}</span></p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4">Relationship Type Distribution</h3>
                    <div className="space-y-1 text-sm">
                      {state.stats?.relationshipTypes && Object.entries(state.stats.relationshipTypes).map(([type, count]) => (
                        <p key={type} className="text-gray-300">{type}: <span className="text-purple-400 font-medium">{count}</span></p>
                      ))}
                    </div>
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
                            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 file:cursor-pointer"
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
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                              >
                                <option value="">Select column...</option>
                                {(csvData.meta.fields || []).map((field) => (
                                  <option key={field} value={field}>
                                    {field}
                                  </option>
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
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                              >
                                <option value="">Select column...</option>
                                {(csvData.meta.fields || []).map((field) => (
                                  <option key={field} value={field}>
                                    {field}
                                  </option>
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
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
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
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
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
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                                      >
                                        <option value="">Select column...</option>
                                        {(csvData.meta.fields || []).map((field) => (
                                          <option key={field} value={field}>
                                            {field}
                                          </option>
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
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                                      >
                                        <option value="">Select column...</option>
                                        {(csvData.meta.fields || []).map((field) => (
                                          <option key={field} value={field}>
                                            {field}
                                          </option>
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
                              className="mr-2 h-4 w-4 text-cyan-400"
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
                          <h4 className="text-cyan-300 font-medium mb-2">Nodes ({importPreview.nodes.length})</h4>
                          <div className="bg-gray-800 rounded p-3 max-h-32 overflow-y-auto">
                            {importPreview.nodes.slice(0, 5).map((node, idx) => (
                              <div key={idx} className="text-xs text-gray-300 mb-1">
                                <span className="text-cyan-400">{node.type}</span>: {node.id}
                                {Object.keys(node.properties).length > 0 && (
                                  <span className="text-gray-500 ml-2">({Object.keys(node.properties).join(', ')})</span>
                                )}
                              </div>
                            ))}
                            {importPreview.nodes.length > 5 && (
                              <div className="text-xs text-gray-500">...and {importPreview.nodes.length - 5} more</div>
                            )}
                          </div>
                        </div>
                        {importPreview.relationships.length > 0 && (
                          <div>
                            <h4 className="text-purple-300 font-medium mb-2">Relationships ({importPreview.relationships.length})</h4>
                            <div className="bg-gray-800 rounded p-3 max-h-32 overflow-y-auto">
                              {importPreview.relationships.slice(0, 5).map((rel, idx) => (
                                <div key={idx} className="text-xs text-gray-300 mb-1">
                                  <span className="text-cyan-400">{rel.sourceId}</span>
                                  <span className="text-purple-400 mx-2">-[{rel.type}]-&gt;</span>
                                  <span className="text-cyan-400">{rel.targetId}</span>
                                </div>
                              ))}
                              {importPreview.relationships.length > 5 && (
                                <div className="text-xs text-gray-500">...and {importPreview.relationships.length - 5} more</div>
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
                              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center mt-3 disabled:opacity-50"
                            >
                              {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Import {importPreview.nodes.length} Nodes
                              {importPreview.relationships.length > 0 && <span>&nbsp;&amp; {importPreview.relationships.length} Relationships</span>}
                            </button>
                          </div>
                        ) : (
                          <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded p-3">
                            <div className="text-yellow-300 font-medium mb-2">⚠️ Configure Import Settings</div>
                            <div className="text-sm text-gray-300 mb-3">Please configure the import settings above to generate a preview.</div>
                            <button
                              onClick={() => {
                                if (csvData && importSettings.nodeTypeColumn && importSettings.nodeIdColumn) {
                                  generateImportPreview(csvData, importSettings);
                                } else {
                                  showError('Please select node type and ID columns first');
                                }
                              }}
                              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center text-sm"
                            >
                              <Search className="w-4 h-4 mr-2" /> Generate Preview
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy import button for backwards compatibility */}
                  {importPreview.nodes.length > 0 && !csvData && (
                    <div className="mb-4">
                      <button
                        onClick={executeImport}
                        disabled={isImporting}
                        className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center disabled:opacity-50"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Import {importPreview.nodes.length} Nodes
                        {importPreview.relationships.length > 0 && <span>&nbsp;&amp; {importPreview.relationships.length} Relationships</span>}
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
                <div className="space-y-6">
                  {/* Mode Switcher */}
                  <div className="flex bg-gray-800 rounded-lg p-1">
                    <button
                      onClick={() => setEditMode('save')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        editMode === 'save' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Save New
                    </button>
                    <button
                      onClick={() => setEditMode('update')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        editMode === 'update' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Update
                    </button>
                    <button
                      onClick={() => setEditMode('share')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        editMode === 'share' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Share
                    </button>
                  </div>

                  {state.savedGraphInfo && (
                    <div className="bg-green-950 border border-green-800 rounded-lg p-4">
                      <h3 className="text-md font-semibold text-green-300 mb-4 flex items-center">
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
                      </div>
                    </div>
                  )}

                  {/* Save New Graph */}
                  {editMode === 'save' && (
                    <div className="space-y-4">
                      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                          <Save className="w-4 h-4 mr-2" />
                          Save Current Graph
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="graphName" className="block text-sm font-medium text-gray-300 mb-1">Graph Name</label>
                            <input
                              type="text"
                              id="graphName"
                              value={saveForm.name}
                              onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                              placeholder="e.g., My Project Graph"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="graphDescription" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                            <textarea
                              id="graphDescription"
                              value={saveForm.description}
                              onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3 resize-y"
                              placeholder="Enter a brief description of your graph"
                            ></textarea>
                          </div>
                          <div>
                            <label htmlFor="graphTags" className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
                            <input
                              type="text"
                              id="graphTags"
                              value={saveForm.tags}
                              onChange={(e) => setSaveForm({ ...saveForm, tags: e.target.value })}
                              placeholder="e.g., graph, demo, analysis"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="isPublic"
                              checked={saveForm.isPublic}
                              onChange={(e) => setSaveForm({ ...saveForm, isPublic: e.target.checked })}
                              className="w-4 h-4 text-cyan-400"
                            />
                            <label htmlFor="isPublic" className="ml-2 text-sm font-medium text-gray-300">Make this graph public</label>
                          </div>
                          <button
                            onClick={saveGraph}
                            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 flex items-center justify-center"
                            disabled={state.isLoading || !currentAccount}
                          >
                            {state.isLoading ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Save Graph to Walrus
                          </button>
                          {!currentAccount && (
                            <p className="text-red-400 text-xs">Connect your wallet to save graphs.</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                        <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                          <Download className="w-4 h-4 mr-2" />
                          Load Graph from Walrus
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="loadBlobId" className="block text-sm font-medium text-gray-300 mb-1">Graph Blob ID</label>
                            <input
                              type="text"
                              id="loadBlobId"
                              value={loadForm.blobId}
                              onChange={(e) => setLoadForm({ blobId: e.target.value })}
                              placeholder="Paste Blob ID here"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (loadForm.blobId.trim()) {
                                loadGraph(loadForm.blobId.trim());
                                setLoadForm({ blobId: '' });
                              }
                            }}
                            disabled={!loadForm.blobId.trim() || state.isLoading}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                          >
                            {state.isLoading ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            Load Graph
                          </button>
                          <p className="text-sm text-gray-400">
                            Enter a Blob ID and click the button to load the graph.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Update Existing Graph */}
                  {editMode === 'update' && (
                    <div className="space-y-4">
                      {!selectedGraph ? (
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                          <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                            <Edit className="w-4 h-4 mr-2" />
                            Select Graph to Update
                          </h3>
                          <p className="text-gray-400 text-sm mb-3">
                            Go to the Browse tab and select a graph you own to update its metadata here.
                          </p>
                          <button
                            onClick={() => setActiveTab('browse')}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center"
                          >
                            <Globe className="w-4 h-4 mr-2" />
                            Go to Browse Graphs
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                          <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                            <Edit className="w-4 h-4 mr-2" />
                            Update: {selectedGraph.name}
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <label htmlFor="updateGraphName" className="block text-sm font-medium text-gray-300 mb-1">Graph Name</label>
                              <input
                                type="text"
                                id="updateGraphName"
                                value={graphUpdateState.name}
                                onChange={(e) => setGraphUpdateState({ ...graphUpdateState, name: e.target.value })}
                                placeholder="e.g., My Project Graph"
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label htmlFor="updateDescription" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                              <textarea
                                id="updateDescription"
                                value={graphUpdateState.description}
                                onChange={(e) => setGraphUpdateState({ ...graphUpdateState, description: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none mb-3 resize-y"
                                placeholder="Enter a brief description of your graph"
                              ></textarea>
                            </div>
                            <div>
                              <label htmlFor="updateTags" className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
                              <input
                                type="text"
                                id="updateTags"
                                value={graphUpdateState.tags}
                                onChange={(e) => setGraphUpdateState({ ...graphUpdateState, tags: e.target.value })}
                                placeholder="e.g., graph, demo, analysis"
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="updateIsPublic"
                                checked={graphUpdateState.isPublic}
                                onChange={(e) => setGraphUpdateState({ ...graphUpdateState, isPublic: e.target.checked })}
                                className="w-4 h-4 text-cyan-400"
                              />
                              <label htmlFor="updateIsPublic" className="ml-2 text-sm font-medium text-gray-300">Make this graph public</label>
                            </div>
                            <button
                              onClick={updateGraphMetadata}
                              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-green-500/30 flex items-center justify-center"
                              disabled={graphUpdateState.isUpdating || !currentAccount}
                            >
                              {graphUpdateState.isUpdating ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                              )}
                              Update Graph Metadata
                            </button>
                            <button
                              onClick={() => setSelectedGraph(null)}
                              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            {!currentAccount && (
                              <p className="text-red-400 text-xs">Connect your wallet to update graphs.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Share Graph */}
                  {editMode === 'share' && (
                    <div className="space-y-4">
                      {!selectedGraph ? (
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                          <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                            <Share2 className="w-4 h-4 mr-2" />
                            Select Graph to Share
                          </h3>
                          <p className="text-gray-400 text-sm mb-3">
                            Go to the Browse tab and select a graph you own to share it with others.
                          </p>
                          <button
                            onClick={() => setActiveTab('browse')}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg flex items-center justify-center"
                          >
                            <Globe className="w-4 h-4 mr-2" />
                            Go to Browse Graphs
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                          <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                            <Share2 className="w-4 h-4 mr-2" />
                            Share: {selectedGraph.name}
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <label htmlFor="recipientAddress" className="block text-sm font-medium text-gray-300 mb-1">Recipient Address</label>
                              <input
                                type="text"
                                id="recipientAddress"
                                value={shareState.recipientAddress}
                                onChange={(e) => setShareState({ ...shareState, recipientAddress: e.target.value })}
                                placeholder="Enter recipient's Sui address"
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg transition-all duration-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
                              />
                            </div>
                            <button
                              onClick={shareGraphWithUser}
                              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/30 flex items-center justify-center"
                              disabled={shareState.isSharing || !currentAccount || !shareState.recipientAddress}
                            >
                              {shareState.isSharing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Share2 className="w-4 h-4 mr-2" />
                              )}
                              Share Graph
                            </button>
                            <button
                              onClick={() => setSelectedGraph(null)}
                              className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            {!currentAccount && (
                              <p className="text-red-400 text-xs">Connect your wallet to share graphs.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'browse' && (
                <div className="space-y-6">
                  {/* Network Status Indicator */}
                  {state.error && (state.error.includes('network') || state.error.includes('connect') || state.error.includes('fetch')) && (
                    <div className="bg-red-950 border border-red-800 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-400 rounded-full mr-3 animate-pulse"></div>
                        <div>
                          <h4 className="text-red-300 font-medium">Network Connection Issue</h4>
                          <p className="text-red-200 text-sm mt-1">{state.error}</p>
                          <div className="mt-2 flex space-x-2">
                            <button
                              onClick={() => {
                                loadPublicGraphs();
                                if (currentAccount) loadMyGraphs();
                              }}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                              disabled={browseLoading}
                            >
                              {browseLoading ? 'Retrying...' : 'Retry Connection'}
                            </button>
                            <button
                              onClick={() => setState(prev => ({ ...prev, error: null }))}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Public Graphs Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-semibold text-white flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        Public Graphs
                      </h3>
                      <button
                        onClick={loadPublicGraphs}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm flex items-center"
                        disabled={browseLoading}
                      >
                        {browseLoading ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Refresh
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">Explore public graphs shared by other users.</p>
                    {browseLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                        <span className="text-gray-500">Loading public graphs...</span>
                      </div>
                    ) : browsedGraphs.public.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Globe className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                        <p>No public graphs found</p>
                        {state.error && state.error.includes('network') && (
                          <div className="mt-4">
                            <p className="text-red-400 text-sm mb-2">Connection failed</p>
                            <button
                              onClick={loadPublicGraphs}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm"
                              disabled={browseLoading}
                            >
                              {browseLoading ? 'Retrying...' : 'Retry'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {browsedGraphs.public.map(graph => (
                          <div key={graph.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="text-gray-200 font-medium">{graph.name}</h4>
                                <p className="text-gray-400 text-sm mt-1">{graph.description}</p>
                                <div className="flex items-center mt-2 text-xs text-gray-500">
                                  <span>{graph.nodeCount} nodes</span>
                                  <span className="mx-2">•</span>
                                  <span>{graph.relationshipCount} relationships</span>
                                  <span className="mx-2">•</span>
                                  <span>v{graph.version}</span>
                                </div>
                                {graph.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {graph.tags.map(tag => (
                                      <span key={tag} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2 ml-3">
                                <button
                                  onClick={() => loadGraph(graph.blobId)}
                                  className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="Load Graph"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => loadGraphHistory(graph.id)}
                                  className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="View History"
                                >
                                  <GitBranch className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* My Graphs Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-semibold text-white flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        My Graphs
                      </h3>
                      <button
                        onClick={loadMyGraphs}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm flex items-center"
                        disabled={browseLoading || !currentAccount}
                      >
                        {browseLoading ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Refresh
                      </button>
                    </div>
                    {!currentAccount ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                        <p>Connect your wallet to view your graphs</p>
                      </div>
                    ) : browseLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                        <span className="text-gray-500">Loading your graphs...</span>
                      </div>
                    ) : browsedGraphs.owned.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                        <p>You haven&apos;t created any graphs yet</p>
                        {state.error && state.error.includes('network') && (
                          <div className="mt-4">
                            <p className="text-red-400 text-sm mb-2">Connection failed</p>
                            <button
                              onClick={loadMyGraphs}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm"
                              disabled={browseLoading}
                            >
                              {browseLoading ? 'Retrying...' : 'Retry'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {browsedGraphs.owned.map(graph => (
                          <div key={graph.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="text-gray-200 font-medium">{graph.name}</h4>
                                <p className="text-gray-400 text-sm mt-1">{graph.description}</p>
                                <div className="flex items-center mt-2 text-xs text-gray-500">
                                  <span>{graph.nodeCount} nodes</span>
                                  <span className="mx-2">•</span>
                                  <span>{graph.relationshipCount} relationships</span>
                                  <span className="mx-2">•</span>
                                  <span>v{graph.version}</span>
                                  {graph.isPublic && (
                                    <>
                                      <span className="mx-2">•</span>
                                      <span className="text-green-400">Public</span>
                                    </>
                                  )}
                                </div>
                                {graph.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {graph.tags.map(tag => (
                                      <span key={tag} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2 ml-3">
                                <button
                                  onClick={() => loadGraph(graph.blobId)}
                                  className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="Load Graph"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => selectGraphForEdit(graph)}
                                  className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="Edit Graph"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => selectGraphForShare(graph)}
                                  className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="Share Graph"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => loadGraphHistory(graph.id)}
                                  className="p-2 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="View History"
                                >
                                  <GitBranch className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Search by Tag Section */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                      <Tag className="w-4 h-4 mr-2" />
                      Search by Tag
                    </h3>
                    <div className="flex space-x-2 mb-3">
                      <input
                        type="text"
                        placeholder="Enter tag name"
                        value={searchTag}
                        onChange={(e) => setSearchTag(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm"
                      />
                      <button
                        onClick={() => loadGraphsByTag(searchTag)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm flex items-center"
                        disabled={!searchTag.trim() || browseLoading}
                      >
                        <Search className="w-4 h-4 mr-1" />
                        Search
                      </button>
                    </div>
                    {Object.keys(browsedGraphs.byTag).length > 0 && (
                      <div className="space-y-2">
                        {Object.entries(browsedGraphs.byTag).map(([tag, graphs]) => (
                          <div key={tag} className="bg-gray-800 border border-gray-700 rounded p-2">
                            <h4 className="text-gray-300 font-medium">#{tag}</h4>
                            <p className="text-gray-500 text-sm">{graphs.length} graphs</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Real-time Updates Toggle */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Real-time Updates
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-sm">Get notifications for new graphs and updates</p>
                        <p className="text-gray-500 text-xs mt-1">Requires WebSocket connection to Sui network</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={enableRealTimeUpdates ? disableEventSubscription : enableEventSubscription}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            enableRealTimeUpdates 
                              ? 'bg-red-600 hover:bg-red-700 text-white' 
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                          disabled={!currentAccount}
                        >
                          {enableRealTimeUpdates ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                    {!currentAccount && (
                      <p className="text-red-400 text-xs mt-2">Connect your wallet to enable real-time updates</p>
                    )}
                  </div>

                  {/* Graph History Viewer */}
                  {graphHistory.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                      <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                        <GitBranch className="w-4 h-4 mr-2" />
                        Graph History
                      </h3>
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                          <span className="text-gray-500">Loading history...</span>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {graphHistory.map((entry, i) => (
                            <div key={i} className="bg-gray-800 border border-gray-700 rounded p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-gray-200 text-sm">{entry.changes}</p>
                                  <div className="flex items-center mt-1 text-xs text-gray-500">
                                    <span>{entry.eventType}</span>
                                    <span className="mx-2">•</span>
                                    <span>v{entry.version}</span>
                                    <span className="mx-2">•</span>
                                    <span>{new Date(entry.changedAt).toLocaleString()}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(entry.transactionDigest, `tx-${i}`)}
                                  className="p-1 text-gray-400 hover:text-cyan-300 transition-colors"
                                  title="Copy Transaction ID"
                                >
                                  {copyStatus[`tx-${i}`] ? 
                                    <Check className="w-3 h-3 text-green-400" /> : 
                                    <Copy className="w-3 h-3" />
                                  }
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Graph Visualization */}
          <div ref={containerRef} className="flex-1 bg-gray-950 relative overflow-hidden">
            {state.nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <Database className="w-12 h-12 mb-4 text-gray-600" />
                <div className="text-lg font-medium text-gray-400">No Graph Data</div>
                <div className="text-sm text-gray-500 mt-1">Create nodes or import data to get started</div>
              </div>
            )}
            <svg ref={svgRef} className="w-full h-full"></svg>
          </div>

          {/* Right Details Panel */}
          <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Properties</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {state.selectedNode ? (
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                    <Edit className="w-4 h-4 mr-2" />
                    Node Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-300">ID: <span className="font-mono text-purple-300">{state.selectedNode.id}</span></p>
                    <p className="text-gray-300">Type: <span className="font-medium text-cyan-300">{state.selectedNode.type}</span></p>
                    <div>
                      <h4 className="text-white font-medium mt-3 mb-2">Properties:</h4>
                      <pre className="bg-gray-800 p-3 rounded text-xs text-gray-200 overflow-auto max-h-32">
                        {JSON.stringify(state.selectedNode.properties, null, 2)}
                      </pre>
                    </div>
                    <button
                      onClick={() => deleteNode(state.selectedNode!.id)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center mt-4"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Node
                    </button>
                  </div>
                </div>
              ) : state.selectedRelationship ? (
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-md font-semibold text-white mb-4 flex items-center">
                    <Edit className="w-4 h-4 mr-2" />
                    Relationship Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-300">ID: <span className="font-mono text-purple-300">{state.selectedRelationship.id}</span></p>
                    <p className="text-gray-300">Type: <span className="font-medium text-cyan-300">{state.selectedRelationship.type}</span></p>
                    <p className="text-gray-300">Source: <span className="font-mono text-orange-300">{state.selectedRelationship.sourceId}</span></p>
                    <p className="text-gray-300">Target: <span className="font-mono text-orange-300">{state.selectedRelationship.targetId}</span></p>
                    <div>
                      <h4 className="text-white font-medium mt-3 mb-2">Properties:</h4>
                      <pre className="bg-gray-800 p-3 rounded text-xs text-gray-200 overflow-auto max-h-32">
                        {JSON.stringify(state.selectedRelationship.properties, null, 2)}
                      </pre>
                    </div>
                    <button
                      onClick={() => deleteRelationship(state.selectedRelationship!.id)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center mt-4"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Relationship
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Search className="w-8 h-8 mb-3 text-gray-600" />
                  <div className="text-center">
                    <div className="font-medium text-gray-400">Select a Node or Relationship</div>
                    <div className="text-sm text-gray-500 mt-1">Click on graph elements to view properties</div>
                  </div>
                </div>
              )}

              {state.error && (
                <div className="mt-4 bg-red-950 border border-red-800 rounded-lg p-4">
                  <h3 className="font-medium text-red-400 mb-2">Error</h3>
                  <p className="text-sm text-red-300">{state.error}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}