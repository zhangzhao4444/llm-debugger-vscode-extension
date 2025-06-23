import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock vscode module
vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn().mockReturnValue({
      appendLine: vi.fn(),
      info: vi.fn()
    })
  }
}));

// Mock the OpenAI client
vi.mock("openai", () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Test response from DeepSeek",
                role: "assistant"
              }
            }
          ]
        })
      }
    }
  }))
}));

// Mock fs and os modules
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    writeFileSync: vi.fn()
  }
}));

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn().mockReturnValue("/home/test")
  }
}));

vi.mock("node:path", () => ({
  default: {
    join: vi.fn().mockReturnValue("/home/test/.llm-debugger-prompt-cache.json")
  }
}));

describe("DeepSeek API Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable
    process.env.DEEPSEEK_API_KEY = "test-api-key";
  });

  it("should use DeepSeek API configuration", async () => {
    const { OpenAI } = await import("openai");
    const { callLlm } = await import("../src/ai/Chat");
    
    await callLlm("Test message");
    
    // Verify OpenAI client was initialized with correct config
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      baseURL: "https://api.deepseek.com"
    });
    
    // Verify the model is set to deepseek-chat
    const mockCreate = vi.mocked(OpenAI).mock.results[0].value.chat.completions.create;
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-chat"
      })
    );
  });

  it("should fallback to OPENAI_API_KEY if DEEPSEEK_API_KEY is not set", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.OPENAI_API_KEY = "fallback-api-key";
    
    const { OpenAI } = await import("openai");
    const { callLlm } = await import("../src/ai/Chat");
    
    await callLlm("Test message");
    
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: "fallback-api-key",
      baseURL: "https://api.deepseek.com"
    });
  });
}); 