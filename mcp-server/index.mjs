#!/usr/bin/env node
/**
 * ABAP AI Studio — MCP Server for Claude Code
 * Provides SAP ABAP tools directly in the terminal.
 *
 * Install: npm install -g abap-ai-studio-mcp
 * Or run: npx abap-ai-studio-mcp
 *
 * Configure in Claude Code:
 *   claude mcp add abap-studio -- npx abap-ai-studio-mcp
 *
 * Environment variables:
 *   ABAP_STUDIO_TOKEN  — JWT token from ABAP AI Studio login
 *   ABAP_STUDIO_API    — API base URL (default: https://abap-ai-studio.akash-bab.workers.dev)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = process.env.ABAP_STUDIO_API || "https://abap-ai-studio.akash-bab.workers.dev";
const TOKEN = process.env.ABAP_STUDIO_TOKEN || "";

async function apiCall(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json();
}

const server = new Server(
  { name: "abap-ai-studio", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "sap_connect",
      description: "Test connection to SAP HANA Dev system (S4D, Client 210)",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "sap_query",
      description: "Execute SQL query against SAP tables (uses Z_RFC_READ_TABLE). Supports SELECT with TOP, FROM, WHERE. Example: SELECT TOP 20 NAME,CNAM FROM TRDIR WHERE NAME LIKE 'Z%'",
      inputSchema: {
        type: "object",
        properties: { sql: { type: "string", description: "SQL query" } },
        required: ["sql"],
      },
    },
    {
      name: "sap_source",
      description: "Read ABAP program source code from SAP. Returns full source of a report/program.",
      inputSchema: {
        type: "object",
        properties: { program: { type: "string", description: "Program name e.g. ZGATE_ENTRY_5_CHANGE_NEW" } },
        required: ["program"],
      },
    },
    {
      name: "sap_tables",
      description: "Search SAP ABAP Dictionary tables by prefix. Returns table names and descriptions.",
      inputSchema: {
        type: "object",
        properties: { prefix: { type: "string", description: "Table name prefix e.g. VBAK, Z" } },
        required: ["prefix"],
      },
    },
    {
      name: "sap_describe",
      description: "Describe fields of an SAP table. Returns column names, types, lengths, key flags.",
      inputSchema: {
        type: "object",
        properties: { table: { type: "string", description: "Table name e.g. VBAK" } },
        required: ["table"],
      },
    },
    {
      name: "sap_programs",
      description: "Search SAP repository for programs/reports by prefix.",
      inputSchema: {
        type: "object",
        properties: { prefix: { type: "string", description: "Program name prefix e.g. Z, ZGATE" } },
        required: ["prefix"],
      },
    },
    {
      name: "abap_generate",
      description: "Generate ABAP code using Claude AI. Supports templates: abap_class, cds_view, amdp, alv_report, badi, function_module, bapi_wrapper, rap_bo",
      inputSchema: {
        type: "object",
        properties: {
          template: { type: "string", description: "Template type" },
          description: { type: "string", description: "What to generate" },
          table: { type: "string", description: "Optional SAP table name" },
        },
        required: ["template", "description"],
      },
    },
    {
      name: "abap_review",
      description: "AI code review of ABAP source code. Rates quality, finds issues, suggests improvements.",
      inputSchema: {
        type: "object",
        properties: { program: { type: "string", description: "Program name to review" } },
        required: ["program"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "sap_connect": {
        const data = await apiCall("/sap/connect", {});
        return { content: [{ type: "text", text: `Connected to SAP ${data.system_id || "S4D"} successfully.` }] };
      }

      case "sap_query": {
        const data = await apiCall("/sap/query", { sql: args.sql });
        if (data.error) return { content: [{ type: "text", text: `Error: ${data.error}` }] };
        const header = (data.columns || Object.keys(data.rows?.[0] || {})).join(" | ");
        const rows = (data.rows || []).map((r) =>
          (data.columns || Object.keys(r)).map((c) => r[c] ?? "NULL").join(" | ")
        );
        return {
          content: [{ type: "text", text: `${data.row_count} row(s)\n\n${header}\n${"─".repeat(header.length)}\n${rows.join("\n")}` }],
        };
      }

      case "sap_source": {
        const data = await apiCall("/sap/source", { program: args.program.toUpperCase() });
        if (data.error) return { content: [{ type: "text", text: `Error: ${data.error || data.detail}` }] };
        return { content: [{ type: "text", text: `Program: ${data.program} (${data.lines} lines)\n\n\`\`\`abap\n${data.source}\n\`\`\`` }] };
      }

      case "sap_tables": {
        const data = await apiCall("/sap/query", {
          sql: `SELECT TOP 50 TABNAME,DDTEXT,TABCLASS FROM DD02L WHERE TABNAME LIKE '${args.prefix.toUpperCase()}%' AND TABCLASS = 'TRANSP'`,
        });
        const lines = (data.rows || []).map((r) => `${r.TABNAME} — ${r.DDTEXT || ""}`);
        return { content: [{ type: "text", text: lines.join("\n") || "No tables found." }] };
      }

      case "sap_describe": {
        const data = await apiCall("/sap/query", {
          sql: `SELECT TOP 200 FIELDNAME,ROLLNAME,INTTYPE,INTLEN,KEYFLAG FROM DD03L WHERE TABNAME = '${args.table.toUpperCase()}'`,
        });
        const lines = (data.rows || []).map(
          (r) => `${r.KEYFLAG === "X" ? "KEY " : "    "}${r.FIELDNAME} — ${r.ROLLNAME || ""} (${r.INTTYPE}/${r.INTLEN})`
        );
        return { content: [{ type: "text", text: `Table: ${args.table.toUpperCase()}\n\n${lines.join("\n")}` }] };
      }

      case "sap_programs": {
        const data = await apiCall("/sap/query", {
          sql: `SELECT TOP 40 NAME,CNAM,UNAM,UDAT FROM TRDIR WHERE NAME LIKE '${args.prefix.toUpperCase()}%'`,
        });
        const lines = (data.rows || []).map((r) => `${r.NAME} — by ${r.CNAM || "?"}, last: ${r.UDAT || "?"}`);
        return { content: [{ type: "text", text: lines.join("\n") || "No programs found." }] };
      }

      case "abap_generate": {
        const prompt = `Generate complete ${args.template} for: ${args.description}. ${args.table ? "Table: " + args.table : ""}. Modern ABAP 7.4+, production-ready.`;
        const data = await apiCall("/claude", {
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: "You are an expert SAP ABAP developer. Generate production-ready modern ABAP 7.4+ code.",
          messages: [{ role: "user", content: prompt }],
        });
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "abap_review": {
        const srcData = await apiCall("/sap/source", { program: args.program.toUpperCase() });
        if (!srcData.source) return { content: [{ type: "text", text: `Could not load program ${args.program}` }] };
        const prompt = `Code review this ABAP program:\n\`\`\`abap\n${srcData.source.substring(0, 3000)}\n\`\`\`\nRate out of 10. Review quality, error handling, security, performance, S/4HANA compatibility.`;
        const data = await apiCall("/claude", {
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: "You are an expert SAP ABAP code reviewer.",
          messages: [{ role: "user", content: prompt }],
        });
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
        return { content: [{ type: "text", text }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ABAP AI Studio MCP server running on stdio");
}

main().catch(console.error);
