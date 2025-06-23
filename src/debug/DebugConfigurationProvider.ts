import * as vscode from "vscode";
import { DebugLoopController } from "./DebugLoopController";
import logger from "../logger";

const log = logger.createSubLogger("DebugConfigurationProvider");

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly debugLoopController: DebugLoopController,
  ) {}

  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    // Get the current debug enabled state from workspace state
    const debugEnabled = this.context.workspaceState.get<boolean>(
      "llmDebuggerEnabled",
      false,
    );

    log.debug(`Debug configuration requested for type: ${config.type}, debugEnabled: ${debugEnabled}`);

    // LLDB specific
    config.stopOnTerminate = false;

    // Store the AI debug state in the config for the debug adapter
    config.llmDebuggerEnabled = debugEnabled;

    if (debugEnabled) {
      // Configure the debugger to stop on uncaught exceptions
      config.breakOnUncaughtExceptions = true;
      config.stopOnEntry = true;
      log.debug("LLM Debugger enabled - configured breakOnUncaughtExceptions and stopOnEntry");
    } else {
      log.debug("LLM Debugger disabled");
    }

    return config;
  }
}