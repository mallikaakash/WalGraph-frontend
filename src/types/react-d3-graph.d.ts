declare module 'react-d3-graph' {
  import { ComponentType } from 'react';

  export interface GraphData {
    nodes: Array<{
      id: string;
      [key: string]: unknown;
    }>;
    links: Array<{
      source: string;
      target: string;
      [key: string]: unknown;
    }>;
  }

  export interface GraphConfig {
    [key: string]: unknown;
  }

  export interface GraphProps {
    id: string;
    data: GraphData;
    config?: GraphConfig;
    onClickNode?: (nodeId: string) => void;
    onClickLink?: (source: string, target: string) => void;
    [key: string]: unknown;
  }

  export const Graph: ComponentType<GraphProps>;
} 