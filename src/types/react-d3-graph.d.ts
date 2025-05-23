declare module 'react-d3-graph' {
  import { ComponentType } from 'react';

  export interface GraphData {
    nodes: Array<{
      id: string;
      [key: string]: any;
    }>;
    links: Array<{
      source: string;
      target: string;
      [key: string]: any;
    }>;
  }

  export interface GraphProps {
    id: string;
    data: GraphData;
    config?: any;
    onClickNode?: (nodeId: string) => void;
    onClickLink?: (source: string, target: string) => void;
    [key: string]: any;
  }

  export const Graph: ComponentType<GraphProps>;
} 