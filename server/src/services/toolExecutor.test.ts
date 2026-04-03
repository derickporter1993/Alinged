import { describe, it, expect } from 'vitest';
import { executeCodeExec, executeTool } from './toolExecutor.js';

describe('toolExecutor', () => {
  describe('executeCodeExec', () => {
    it('executes simple math', async () => {
      const result = await executeCodeExec({}, '2 + 2');
      expect(result.success).toBe(true);
      expect(result.output).toBe('4');
    });

    it('executes string operations', async () => {
      const result = await executeCodeExec({}, '"hello".toUpperCase()');
      expect(result.success).toBe(true);
      expect(result.output).toBe('HELLO');
    });

    it('handles JSON operations', async () => {
      const result = await executeCodeExec({}, 'JSON.stringify({a: 1, b: 2})');
      expect(result.success).toBe(true);
      expect(result.output).toBe('{"a":1,"b":2}');
    });

    it('catches syntax errors', async () => {
      const result = await executeCodeExec({}, 'this is not valid js }{');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Code execution failed');
    });

    it('catches runtime errors', async () => {
      const result = await executeCodeExec({}, 'undefined.property');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Code execution failed');
    });

    it('handles undefined results', async () => {
      const result = await executeCodeExec({}, 'let x = 5');
      expect(result.success).toBe(true);
      expect(result.output).toBe('undefined');
    });
  });

  describe('executeTool', () => {
    it('routes to code_exec', async () => {
      const result = await executeTool('code_exec', {}, '1 + 1');
      expect(result.success).toBe(true);
      expect(result.output).toBe('2');
    });

    it('returns error for unknown tool type', async () => {
      const result = await executeTool('unknown_tool', {}, 'input');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool type');
    });

    it('routes to file_io (disabled)', async () => {
      const result = await executeTool('file_io', {}, '/etc/passwd');
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled for security');
    });
  });
});
