// Simple test script for Cypher Parser
// Run this with: node test-cypher-parser.js

const { CypherParser } = require('./src/services/cypher-parser.ts');

console.log('🧪 Testing Cypher Parser...');

const parser = new CypherParser();

const testQueries = [
  'MATCH (n) RETURN n',
  'MATCH (p:Person) WHERE p.age > 25 RETURN p',
  'MATCH (a:Person)-[r:KNOWS]->(b:Person) RETURN a, r, b',
  'MATCH (n) WHERE n.name = "Alice" RETURN n ORDER BY n.age DESC LIMIT 10',
  'MATCH (p:Person) WHERE p.name CONTAINS "Al" RETURN p',
  'MATCH (p:Person) WHERE p.age >= 18 AND p.age <= 65 RETURN p'
];

testQueries.forEach((query, index) => {
  try {
    console.log(`\n📝 Test ${index + 1}: ${query}`);
    const result = parser.parse(query);
    console.log('✅ Parsed successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`❌ Test ${index + 1} failed:`, error.message);
  }
});

console.log('\n🎉 Cypher Parser tests completed!'); 