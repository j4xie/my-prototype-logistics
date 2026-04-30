package com.cretas.aims.ai.client;

import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.ai.dto.Tool;
import com.cretas.aims.ai.dto.ToolCall;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Consumer;

/**
 * Backward-compat shim — delegates all LLM calls to PythonLLMClient.
 *
 * Previously called DashScope directly (689 lines, single provider).
 * Now delegates to PythonLLMClient → Python /api/llm/* → llm_router.py
 * (4-provider fallback + circuit breaker).
 *
 * The 38 callers that inject DashScopeClient need zero changes.
 * Cleanup: once callers are updated to inject PythonLLMClient directly
 * (Phase 3 follow-up), this class can be deleted.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DashScopeClient {

    private final PythonLLMClient delegate;

    public ChatCompletionResponse chatCompletion(ChatCompletionRequest request) {
        return delegate.chatCompletion(request);
    }

    public String chat(String systemPrompt, String userInput) {
        return delegate.chat(systemPrompt, userInput);
    }

    public String chatFast(String systemPrompt, String userInput) {
        return delegate.chatFast(systemPrompt, userInput);
    }

    public String chatLowTemp(String systemPrompt, String userInput) {
        return delegate.chatLowTemp(systemPrompt, userInput);
    }

    public ChatCompletionResponse chatWithThinking(String systemPrompt, String userInput, int thinkingBudget) {
        return delegate.chatWithThinking(systemPrompt, userInput, thinkingBudget);
    }

    public void chatCompletionStream(ChatCompletionRequest request,
                                     Consumer<String> onToken,
                                     Consumer<ChatCompletionResponse> onComplete) {
        delegate.chatCompletionStream(request, onToken, onComplete);
    }

    public String classifyIntent(String systemPrompt, String userInput) {
        return delegate.classifyIntent(systemPrompt, userInput);
    }

    public static boolean shouldEnableThinking(String userInput) {
        return PythonLLMClient.shouldEnableThinking(userInput);
    }

    public boolean isAvailable() {
        return delegate.isAvailable();
    }

    public ChatCompletionResponse chatCompletionWithTools(
            List<ChatMessage> messages,
            List<Tool> tools,
            String toolChoice) {
        return delegate.chatCompletionWithTools(messages, tools, toolChoice);
    }

    public ChatCompletionResponse chatWithTools(
            String systemPrompt,
            String userInput,
            List<Tool> tools) {
        return delegate.chatWithTools(systemPrompt, userInput, tools);
    }

    public boolean hasToolCalls(ChatCompletionResponse response) {
        return delegate.hasToolCalls(response);
    }

    public ToolCall getFirstToolCall(ChatCompletionResponse response) {
        return delegate.getFirstToolCall(response);
    }

    public List<ToolCall> getAllToolCalls(ChatCompletionResponse response) {
        return delegate.getAllToolCalls(response);
    }
}
