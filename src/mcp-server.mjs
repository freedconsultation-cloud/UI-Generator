// Standalone MCP server — spawned as a subprocess by the chat API route.
// Exposes two tools to the model: fetch_url and search_npm.
// Communicates over stdio using the MCP JSON-RPC protocol.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'uigen-tools', version: '1.0.0' });

// Fetch the text content of any URL.
// Useful for reading npm package READMEs, component library docs, Tailwind/Radix references, etc.
server.tool(
  'fetch_url',
  'Fetch the text content of a URL. Use this to read npm README files, component library documentation, or any reference material before writing code.',
  { url: z.string().url().describe('The URL to fetch') },
  async ({ url }) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'UIGen/1.0' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const raw = await res.text();
      // Strip <script> and <style> blocks, then strip remaining tags for readability
      const stripped = raw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const text = stripped.length > 20_000
        ? stripped.slice(0, 20_000) + '\n...[truncated]'
        : stripped;

      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to fetch ${url}: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// Search the npm registry for packages matching a query.
// Useful for discovering packages, checking if a package exists, or finding alternatives.
server.tool(
  'search_npm',
  'Search the npm registry for packages. Use this to find available libraries, check if a specific package exists, or discover alternatives to a package.',
  {
    query: z.string().describe('Search query, e.g. "react date picker" or "tailwind animation"'),
    limit: z.number().int().min(1).max(10).optional().default(5).describe('Number of results to return'),
  },
  async ({ query, limit }) => {
    try {
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`npm registry returned HTTP ${res.status}`);

      const data = await res.json();
      if (!data.objects?.length) {
        return { content: [{ type: 'text', text: 'No packages found.' }] };
      }

      const lines = data.objects.map(({ package: pkg }) => {
        const weekly = pkg.downloads?.monthly ?? '?';
        return `${pkg.name}@${pkg.version} — ${pkg.description ?? 'no description'} (${weekly} weekly downloads)`;
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to search npm: ${err.message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
