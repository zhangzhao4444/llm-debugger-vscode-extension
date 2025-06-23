import * as vscode from "vscode";
import { DebugLoopController } from "./DebugLoopController";
import logger from "../logger";

const log = logger.createSubLogger("DebugAdapterTracker");
// log.disable();

interface ThreadInfo {
  id: number;
  name: string;
}

interface DebugMessage {
  type: string;
  command?: string;
  event?: string;
  body?: {
    reason?: string;
    threadId?: number;
    allThreadsStopped?: boolean;
    threads?: ThreadInfo[];
    text?: string; // Added to capture output event text
    output?: string; // Capture output content
    category?: string;
  };
}

export class DebugAdapterTracker implements vscode.DebugAdapterTracker {
  private session: vscode.DebugSession;
  private controller: DebugLoopController;
  private threadId: number | undefined;
  private stderr: string = ""; // Accumulate error output
  private stdout: string = ""; // Accumulate standard output
  private hasRetriedThreads: boolean = false; // Track if we've retried getting threads

  constructor(session: vscode.DebugSession, controller: DebugLoopController) {
    this.session = session;
    this.controller = controller;
  }

  // async onWillReceiveMessage(message: DebugMessage) {
  //   log.debug(`onWillReceiveMessage: ${message.type} - ${JSON.stringify(message)}`);
  // }

  async onWillStartSession(): Promise<void> {
    try {
      log.debug(`onWillStartSession - Session ID: ${this.session.id}, Type: ${this.session.type}`);
      await this.controller.clear();
      this.controller.setSession(this.session);

      // Wait a bit for the debug server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // check if session has thread 
      try {
        const threadsResponse = await this.session.customRequest('threads');
        const threads = threadsResponse?.threads || [];

        log.debug(`Found ${threads.length} threads in session`);

        if (threads.length > 0 && !this.threadId) {
          this.threadId = threads[0].id;
          this.controller.setThreadId(this.threadId);
          log.debug(`Set thread ID: ${this.threadId}`);
        } else {
          log.debug('onWillStartSession: No thread found in session');
          return;
        }

        await this.controller.start();
        log.debug('Started controller for session', this.session.id);
      } catch (threadError) {
        log.error(`Error getting threads: ${String(threadError)}`);
        // If we can't get threads, the debug server might not be ready yet
        // We'll wait and try again when we receive the first message
        log.debug('Will retry when first debug message is received');
      }
    } catch (error) {
      log.error(`Error in onWillStartSession: ${String(error)}`);
      log.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
      
      // Don't throw the error, just log it and continue
      // The debug session might still work even if we can't get threads initially
      log.debug('Continuing despite error, will retry when messages are received');
    }
  }



  async onDidSendMessage(message: DebugMessage) {
    try {
      if (message.event !== 'loadedSource') {
        log.debug("onDidSendMessage", JSON.stringify(message));
      }

      // If we don't have a thread ID yet and haven't retried, try to get threads
      if (!this.threadId && !this.hasRetriedThreads && message.type === "event") {
        try {
          log.debug("Retrying to get threads...");
          const threadsResponse = await this.session.customRequest('threads');
          const threads = threadsResponse?.threads || [];
          
          if (threads.length > 0) {
            this.threadId = threads[0].id;
            this.controller.setThreadId(this.threadId);
            log.debug(`Retry successful - Set thread ID: ${this.threadId}`);
            
            // Start the controller if we haven't started it yet
            if (!this.controller['live']) {
              await this.controller.start();
              log.debug('Started controller after retry');
            }
          }
        } catch (retryError) {
          log.error(`Retry failed: ${String(retryError)}`);
        } finally {
          this.hasRetriedThreads = true;
        }
      }

      // Track thread creation
      if (message.type === "response" && message.command === "threads") {
        const threads = message.body?.threads || [];

        // We are ignoreing other threads that are created since we don't support multi-threaded 
        // debugging just yet
        if (threads.length > 0 && !this.threadId) {
          this.threadId = threads[0].id;
          this.controller.setThreadId(this.threadId);
        }
      }

      // Handle stopped events
      if (message.type === "event" && message.event === "stopped") {
        const threadId = message.body?.threadId || this.threadId;
        const allThreadsStopped = message.body?.allThreadsStopped || false;

        if (threadId) {
          this.threadId = threadId;
          this.controller.setThreadId(threadId);
        }
        if (message.body?.reason === "exception") {
          log.debug('stopped due to exception');
          await this.controller.handleException(this.session, this.stderr, this.stdout);
        }
        else {
          // Emit threadStopped before calling loop
          this.controller.emit("threadStopped", { threadId, allThreadsStopped });
          await this.controller.loop(); // not sure if we need to loop manually from here, controller should handle looping state
        }
      }

      // Handle thread exit
      if (message.type === "event" && message.event === "thread" && message.body?.reason === "exited") {
        this.threadId = undefined;
        this.controller.setThreadId(undefined);
      }

      // Accumulate error output
      if (message.type === "event" && message.event === "output") {
        if (message.body?.category === "stderr") {
          this.stderr += message.body.output || "";
        }
        if (message.body?.category === 'stdout') {
          this.stdout += message.body.output || ''
        }
      }

      if (message.type === "response" && message.command === "disconnect") {
        log.debug("onDidSendMessage: disconnect");
        this.controller.finish([
          '# stdout',
          this.stdout,
          '# stderr',
          this.stderr
        ].join('\n\n'));
      }
    } catch (error) {
      log.error(`Error in onDidSendMessage: ${String(error)}`);
      log.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
      log.error(`Message that caused error: ${JSON.stringify(message)}`);
    }
  }


  onError(error: Error) {
    log.error(`DebugAdapterTracker Error: ${error.message}`);
    log.error(`Error stack: ${error.stack}`);
    log.error(`Session ID: ${this.session?.id}`);
    log.error(`Session type: ${this.session?.type}`);
    this.stderr += `DebugAdapterTracker Error: ${error.message}\n`;
  }

}