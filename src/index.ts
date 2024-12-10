import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types';
import fetch from 'node-fetch';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const server = new Server(
  {
    name: 'github-mcp-server',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN environment variable not set');
  process.exit(1);
}

async function listIssues(owner: string, repo: string, options: any) {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);

  if (options.state) url.searchParams.append('state', options.state);
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-mcp-server'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

const ListIssuesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(['open', 'closed', 'all']).optional()
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'list_issues',
    description: 'List issues in a GitHub repository',
    inputSchema: zodToJsonSchema(ListIssuesSchema)
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!request.params.arguments) {
    throw new Error('Arguments are required');
  }

  switch (request.params.name) {
    case 'list_issues': {
      const args = ListIssuesSchema.parse(request.params.arguments);
      const issues = await listIssues(args.owner, args.repo, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }]
      };
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub MCP Server running on stdio');
}

runServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});