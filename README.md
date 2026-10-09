# Devsense' PHP MCP Server

Standalone MCP Server built on `devsense-php-ls`, the DEVSENSE PHP Language Server.

## Installation

Install `devsense-php-mcp` package as a global command line tool:

> npm install -g devsense-php-mcp

## Sample usage

### Run via HTTP port

```bash
devsense-php-mcp -p 9101 .
```

### Run via STDIO (for Antigravity, Claude Desktop, Cursor, etc.)

```bash
devsense-php-mcp --stdio .
```

#### Antigravity CLI

When added without a path, it automatically indexes the current working directory of the workspace where Antigravity is running:

Using npm/npx:
```bash
agy mcp add devsense-php-mcp npx -y devsense-php-mcp --stdio
```

Or using a local build:
```bash
agy mcp add devsense-php-mcp-server /path/to/devsense-php-mcp/dist/index.js --stdio
```

> **Note:** If you want to restrict or target a specific project path explicitly, you can append the path or pass `-r /path/to/project`:
> ```bash
> agy mcp add devsense-php-mcp npx -y devsense-php-mcp --stdio /path/to/php-project
> ```

#### Configuration file (`mcpServers`)

```json
{
  "mcpServers": {
    "php": {
      "command": "npx",
      "args": ["-y", "devsense-php-mcp", "--stdio"]
    }
  }
}
```

## Available options

```
Usage: devsense-php-mcp [options] [path...]

Arguments:
  path                      Files or directories to be indexed. `**/*.php` by default.

Options:
  --stdio                   Communicate with MCP client using standard input and output (STDIO).
  -p, --mcp-port <N>        Specify the MCP server port number. If --stdio is used without --mcp-port, a random available port is used.
  -r, --root <path>         Root PHP workspace directory. Current directory by default.
  -x, --exclude <path...>   Files or directories to be excluded from indexing.
  -h, --help                Display help for command
```

## Background

The tool uses [PHP Tools](https://www.devsense.com/)' language server which provides MCP Server functionality.

