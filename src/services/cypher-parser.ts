/**
 * Cypher Query Parser - Converts Cypher text queries to GraphQuery objects
 * Supports: MATCH, WHERE, RETURN, ORDER BY, LIMIT, SKIP, CREATE
 */

import { 
  GraphQuery, 
  MatchPattern, 
  WhereClause, 
  ReturnClause, 
  OrderByClause,
  ComparisonOperator,
  QueryParseError 
} from './types';

interface ParseContext {
  input: string;
  position: number;
  tokens: Token[];
  current: number;
}

interface Token {
  type: 'KEYWORD' | 'IDENTIFIER' | 'OPERATOR' | 'NUMBER' | 'STRING' | 'SYMBOL' | 'WHITESPACE';
  value: string;
  position: number;
}

export class CypherParser {
  
  /**
   * Main parsing entry point
   */
  parse(query: string): GraphQuery {
    try {
      const tokens = this.tokenize(query);
      const context: ParseContext = {
        input: query,
        position: 0,
        tokens: tokens.filter(t => t.type !== 'WHITESPACE'), // Filter out whitespace
        current: 0
      };

      return this.parseQuery(context);
    } catch (error) {
      if (error instanceof QueryParseError) {
        throw error;
      }
      throw new QueryParseError(`Failed to parse query: ${error}`, query);
    }
  }

  /**
   * Tokenize the input string
   */
  private tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;

    // Token patterns (order matters - longer patterns first)
    const patterns: Array<{ type: Token['type']; regex: RegExp }> = [
      { type: 'KEYWORD', regex: /^(MATCH|WHERE|RETURN|ORDER|BY|LIMIT|SKIP|CREATE|AND|OR|NOT|AS|ASC|DESC|DISTINCT)\b/i },
      { type: 'OPERATOR', regex: /^(<=|>=|<>|!=|=|<|>|CONTAINS|STARTS\s+WITH|ENDS\s+WITH|IN|NOT\s+IN)/i },
      { type: 'STRING', regex: /^(['"])((?:\\.|(?!\1)[^\\])*)\1/ },
      { type: 'NUMBER', regex: /^-?\d+(\.\d+)?/ },
      { type: 'IDENTIFIER', regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
      { type: 'SYMBOL', regex: /^[(){}[\],:.\-<>]/ },
      { type: 'WHITESPACE', regex: /^\s+/ }
    ];

    while (position < input.length) {
      let matched = false;

      for (const pattern of patterns) {
        const match = input.slice(position).match(pattern.regex);
        if (match) {
          tokens.push({
            type: pattern.type,
            value: match[0],
            position
          });
          position += match[0].length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        throw new QueryParseError(`Unexpected character at position ${position}: '${input[position]}'`, input, position);
      }
    }

    return tokens;
  }

  /**
   * Parse the complete query
   */
  private parseQuery(context: ParseContext): GraphQuery {
    const query: GraphQuery = {};

    while (!this.isAtEnd(context)) {
      const token = this.peek(context);
      
      if (this.matchKeyword(context, 'MATCH')) {
        if (!query.match) query.match = [];
        query.match.push(this.parseMatchClause(context));
      } else if (this.matchKeyword(context, 'WHERE')) {
        if (!query.where) query.where = [];
        query.where.push(...this.parseWhereClause(context));
      } else if (this.matchKeyword(context, 'RETURN')) {
        query.return = this.parseReturnClause(context);
      } else if (this.matchKeyword(context, 'ORDER')) {
        query.orderBy = this.parseOrderByClause(context);
      } else if (this.matchKeyword(context, 'LIMIT')) {
        query.limit = this.parseLimitClause(context);
      } else if (this.matchKeyword(context, 'SKIP')) {
        query.skip = this.parseSkipClause(context);
      } else if (this.matchKeyword(context, 'CREATE')) {
        // CREATE is handled separately in the editor for now
        this.advance(context); // Skip CREATE for now
        break;
      } else {
        throw new QueryParseError(`Unexpected token: ${token.value}`, context.input, token.position);
      }
    }

    return query;
  }

  /**
   * Parse MATCH clause: (n:Label {prop: value})-[r:TYPE]->(m)
   * Note: MATCH keyword is already consumed by matchKeyword() in parseQuery()
   */
  private parseMatchClause(context: ParseContext): MatchPattern {
    const pattern: MatchPattern = {};

    // Expect opening parenthesis for node pattern
    if (this.check(context, 'SYMBOL', '(')) {
      pattern.nodePattern = this.parseNodePattern(context);
    }

    // Check for relationship pattern
    if (this.check(context, 'SYMBOL', '-') || this.check(context, 'SYMBOL', '<')) {
      pattern.relationshipPattern = this.parseRelationshipPattern(context);
      
      // After relationship, expect target node
      if (this.check(context, 'SYMBOL', '(')) {
        // We can extend this later to handle target nodes
      }
    }

    return pattern;
  }

  /**
   * Parse node pattern: (variable:Label {property: value})
   */
  private parseNodePattern(context: ParseContext) {
    this.consume(context, 'SYMBOL', '(');
    
    let variable: string | undefined;
    const labels: string[] = [];
    const properties: Record<string, unknown> = {};

    // Parse variable (optional)
    if (this.check(context, 'IDENTIFIER')) {
      variable = this.advance(context).value;
    }

    // Parse labels (optional)
    while (this.check(context, 'SYMBOL', ':')) {
      this.advance(context); // consume ':'
      if (this.check(context, 'IDENTIFIER')) {
        labels.push(this.advance(context).value);
      }
    }

    // Parse properties (optional)
    if (this.check(context, 'SYMBOL', '{')) {
      Object.assign(properties, this.parsePropertyMap(context));
    }

    this.consume(context, 'SYMBOL', ')');

    return {
      variable,
      labels: labels.length > 0 ? labels : undefined,
      properties: Object.keys(properties).length > 0 ? properties : undefined
    };
  }

  /**
   * Parse relationship pattern: -[r:TYPE]->
   */
  private parseRelationshipPattern(context: ParseContext) {
    let direction: 'in' | 'out' | 'both' = 'both';
    
    // Check for incoming relationship
    if (this.check(context, 'SYMBOL', '<')) {
      this.advance(context); // consume '<'
      this.consume(context, 'SYMBOL', '-'); // consume '-'
      direction = 'in';
    } else {
      this.consume(context, 'SYMBOL', '-'); // consume '-'
    }
    
    let variable: string | undefined;
    let type: string | undefined;
    const properties: Record<string, unknown> = {};

    // Check for relationship details [r:TYPE]
    if (this.check(context, 'SYMBOL', '[')) {
      this.advance(context); // consume '['
      
      // Parse variable (optional)
      if (this.check(context, 'IDENTIFIER')) {
        variable = this.advance(context).value;
      }

      // Parse type (optional)
      if (this.check(context, 'SYMBOL', ':')) {
        this.advance(context); // consume ':'
        if (this.check(context, 'IDENTIFIER')) {
          type = this.advance(context).value;
        }
      }

      // Parse properties (optional)
      if (this.check(context, 'SYMBOL', '{')) {
        Object.assign(properties, this.parsePropertyMap(context));
      }

      this.consume(context, 'SYMBOL', ']');
    }

    // Parse outgoing direction
    if (this.check(context, 'SYMBOL', '-')) {
      this.advance(context); // consume '-'
      if (this.check(context, 'SYMBOL', '>')) {
        this.advance(context); // consume '>'
        direction = direction === 'in' ? 'both' : 'out';
      }
    }

    return {
      variable,
      type,
      direction,
      properties: Object.keys(properties).length > 0 ? properties : undefined
    };
  }

  /**
   * Parse WHERE clause: WHERE n.prop = value AND m.prop > 10
   * Note: WHERE keyword is already consumed by matchKeyword() in parseQuery()
   */
  private parseWhereClause(context: ParseContext): WhereClause[] {
    const clauses: WhereClause[] = [];
    
    do {
      const clause = this.parseWhereCondition(context);
      clauses.push(clause);
      
      // Check for AND/OR (we'll treat all as AND for simplicity)
      if (this.matchKeyword(context, 'AND') || this.matchKeyword(context, 'OR')) {
        continue; // Parse next condition
      } else {
        break; // No more conditions
      }
    } while (!this.isAtEnd(context));

    return clauses;
  }

  /**
   * Parse single WHERE condition: n.prop = value
   */
  private parseWhereCondition(context: ParseContext): WhereClause {
    // Parse property reference (variable.property)
    const variable = this.consume(context, 'IDENTIFIER').value;
    this.consume(context, 'SYMBOL', '.');
    const property = this.consume(context, 'IDENTIFIER').value;

    // Parse operator
    const operatorToken = this.advance(context);
    const operator = this.normalizeOperator(operatorToken.value) as ComparisonOperator;

    // Parse value
    const value = this.parseValue(context);

    return {
      property: `${variable}.${property}`,
      operator,
      value
    };
  }

  /**
   * Parse RETURN clause: RETURN n, m.prop AS alias
   * Note: RETURN keyword is already consumed by matchKeyword() in parseQuery()
   */
  private parseReturnClause(context: ParseContext): ReturnClause[] {
    const returnClauses: ReturnClause[] = [];
    
    do {
      const variable = this.consume(context, 'IDENTIFIER').value;
      let property: string | undefined;
      let alias: string | undefined;

      // Check for property access
      if (this.check(context, 'SYMBOL', '.')) {
        this.advance(context); // consume '.'
        property = this.consume(context, 'IDENTIFIER').value;
      }

      // Check for alias
      if (this.matchKeyword(context, 'AS')) {
        alias = this.consume(context, 'IDENTIFIER').value;
      }

      returnClauses.push({
        variable,
        property,
        alias
      });

      // Check for comma (more return items)
      if (this.check(context, 'SYMBOL', ',')) {
        this.advance(context); // consume ','
        continue;
      } else {
        break;
      }
    } while (!this.isAtEnd(context));

    return returnClauses;
  }

  /**
   * Parse ORDER BY clause: ORDER BY n.prop ASC
   */
  private parseOrderByClause(context: ParseContext): OrderByClause[] {
    this.consume(context, 'KEYWORD', 'BY');
    
    const orderClauses: OrderByClause[] = [];
    
    do {
      const variable = this.consume(context, 'IDENTIFIER').value;
      this.consume(context, 'SYMBOL', '.');
      const property = this.consume(context, 'IDENTIFIER').value;
      
      let direction: 'ASC' | 'DESC' = 'ASC';
      if (this.matchKeyword(context, 'DESC')) {
        direction = 'DESC';
      } else if (this.matchKeyword(context, 'ASC')) {
        direction = 'ASC';
      }

      orderClauses.push({
        property: `${variable}.${property}`,
        direction
      });

      // Check for comma (more order items)
      if (this.check(context, 'SYMBOL', ',')) {
        this.advance(context); // consume ','
        continue;
      } else {
        break;
      }
    } while (!this.isAtEnd(context));

    return orderClauses;
  }

  /**
   * Parse LIMIT clause: LIMIT 10
   */
  private parseLimitClause(context: ParseContext): number {
    return parseInt(this.consume(context, 'NUMBER').value);
  }

  /**
   * Parse SKIP clause: SKIP 5
   */
  private parseSkipClause(context: ParseContext): number {
    return parseInt(this.consume(context, 'NUMBER').value);
  }

  /**
   * Parse property map: {key: value, key2: "string"}
   */
  private parsePropertyMap(context: ParseContext): Record<string, unknown> {
    this.consume(context, 'SYMBOL', '{');
    
    const properties: Record<string, unknown> = {};
    
    if (!this.check(context, 'SYMBOL', '}')) {
      do {
        const key = this.consume(context, 'IDENTIFIER').value;
        this.consume(context, 'SYMBOL', ':');
        const value = this.parseValue(context);
        properties[key] = value;

        if (this.check(context, 'SYMBOL', ',')) {
          this.advance(context); // consume ','
        } else {
          break;
        }
      } while (!this.check(context, 'SYMBOL', '}'));
    }

    this.consume(context, 'SYMBOL', '}');
    return properties;
  }

  /**
   * Parse a value (string, number, identifier)
   */
  private parseValue(context: ParseContext): unknown {
    const token = this.advance(context);
    
    switch (token.type) {
      case 'STRING':
        return token.value.slice(1, -1); // Remove quotes
      case 'NUMBER':
        return parseFloat(token.value);
      case 'IDENTIFIER':
        return token.value;
      default:
        throw new QueryParseError(`Expected value, got: ${token.value}`, context.input, token.position);
    }
  }

  /**
   * Normalize operator strings
   */
  private normalizeOperator(op: string): string {
    const normalized = op.toUpperCase().replace(/\s+/g, '_');
    switch (normalized) {
      case '<>':
      case '!=': return '!=';
      case 'STARTS_WITH': return 'STARTS_WITH';
      case 'ENDS_WITH': return 'ENDS_WITH';
      case 'NOT_IN': return 'NOT_IN';
      default: return op;
    }
  }

  // Utility methods for token navigation
  private isAtEnd(context: ParseContext): boolean {
    return context.current >= context.tokens.length;
  }

  private peek(context: ParseContext): Token {
    if (this.isAtEnd(context)) {
      return { type: 'SYMBOL', value: 'EOF', position: context.input.length };
    }
    return context.tokens[context.current];
  }

  private advance(context: ParseContext): Token {
    if (!this.isAtEnd(context)) {
      context.current++;
    }
    return context.tokens[context.current - 1];
  }

  private check(context: ParseContext, type: Token['type'], value?: string): boolean {
    if (this.isAtEnd(context)) return false;
    const token = this.peek(context);
    return token.type === type && (value === undefined || token.value === value);
  }

  private matchKeyword(context: ParseContext, keyword: string): boolean {
    if (this.check(context, 'KEYWORD', keyword)) {
      this.advance(context);
      return true;
    }
    return false;
  }

  private consume(context: ParseContext, type: Token['type'], value?: string): Token {
    if (this.check(context, type, value)) {
      return this.advance(context);
    }
    
    const current = this.peek(context);
    const expected = value ? `'${value}'` : type;
    throw new QueryParseError(
      `Expected ${expected}, got '${current.value}'`, 
      context.input, 
      current.position
    );
  }

  /**
   * Test the parser with sample queries
   */
  static test(): void {
    const parser = new CypherParser();
    
    const testQueries = [
      'MATCH (n) RETURN n',
      'MATCH (p:Person) WHERE p.age > 25 RETURN p',
      'MATCH (a:Person)-[r:KNOWS]->(b:Person) RETURN a, r, b',
      'MATCH (n) WHERE n.name = "Alice" RETURN n ORDER BY n.age DESC LIMIT 10'
    ];

    console.log('🧪 Testing Cypher Parser...');
    
    testQueries.forEach((query, index) => {
      try {
        const result = parser.parse(query);
        console.log(`✅ Test ${index + 1} passed:`, query);
        console.log('   Result:', result);
      } catch (error) {
        console.error(`❌ Test ${index + 1} failed:`, query);
        if (error instanceof Error) {
          console.error('   Error:', error.message);
        }
      }
    });
  }
} 