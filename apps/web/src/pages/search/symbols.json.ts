import index from '@data/unicode/out/search.json';

/** Static search index for the symbol catalog, fetched by SymbolSearch on first use. */
export function GET() {
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
