export function TestTailwind() {
  return (
    <div className="p-4 bg-red-500 text-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-2">Tailwind Test</h2>
      <p className="text-gray-100">If you can see this styled component, Tailwind is working!</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="bg-blue-500 p-2 rounded">Blue</div>
        <div className="bg-green-500 p-2 rounded">Green</div>
        <div className="bg-purple-500 p-2 rounded">Purple</div>
      </div>
    </div>
  );
} 