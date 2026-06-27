import { useState, useRef, useEffect } from "react";
import { 
  useListOpenaiConversations, 
  useCreateOpenaiConversation, 
  useGetOpenaiConversation,
  useListOpenaiMessages,
  getGetOpenaiConversationQueryKey,
  getListOpenaiMessagesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Plus, Brain } from "lucide-react";
import { SUBJECT_EMOJIS } from "@/lib/constants";
import { useStudent } from "@/contexts/StudentContext";

export default function Tutor() {
  const queryClient = useQueryClient();
  const { level, subjects } = useStudent();

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [newSubject, setNewSubject] = useState("");

  const { data: conversations } = useListOpenaiConversations();
  const createConvo = useCreateOpenaiConversation();

  const { data: conversation } = useGetOpenaiConversation(activeConversationId!, {
    query: { enabled: !!activeConversationId, queryKey: getGetOpenaiConversationQueryKey(activeConversationId!) }
  });

  const { data: messages } = useListOpenaiMessages(activeConversationId!, {
    query: { enabled: !!activeConversationId, queryKey: getListOpenaiMessagesQueryKey(activeConversationId!) }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedResponse]);

  const levelConvos = conversations?.filter(c => !c.level || c.level === level);

  const handleStartNew = () => {
    if (!newSubject || !level) return;
    createConvo.mutate({ data: { title: `${newSubject} — ${level}`, subject: newSubject, level } }, {
      onSuccess: (data) => {
        setActiveConversationId(data.id);
        setNewSubject("");
        queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId || isStreaming) return;

    const messageContent = input;
    setInput("");
    setIsStreaming(true);
    setStreamedResponse("");

    queryClient.setQueryData(getListOpenaiMessagesQueryKey(activeConversationId), (old: any) => {
      const tempMsg = { id: Date.now(), conversationId: activeConversationId, role: "user", content: messageContent, createdAt: new Date().toISOString() };
      return old ? [...old, tempMsg] : [tempMsg];
    });

    try {
      const response = await fetch(`/api/openai/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent })
      });

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.trim().startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.replace("data: ", "").trim());
            if (data.content) setStreamedResponse(prev => prev + data.content);
            if (data.done) {
              queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(activeConversationId) });
              setIsStreaming(false);
              setStreamedResponse("");
            }
          } catch {}
        }
      }
    } catch {
      setIsStreaming(false);
      setStreamedResponse("");
    }
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-bold font-serif text-foreground">AI Tutor</h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary">{level}</span>
        </div>
        <p className="text-muted-foreground">Your Cambridge {level} academic companion — ask anything about your syllabus.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-5 overflow-hidden">
        {/* Sidebar */}
        <div className="col-span-1 border rounded-xl bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">New Session</h2>
            <Select value={newSubject} onValueChange={setNewSubject}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s} value={s}>{SUBJECT_EMOJIS[s] ?? "📚"} {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleStartNew} disabled={!newSubject || createConvo.isPending} className="w-full" size="sm">
              <Plus className="w-4 h-4 mr-2" /> Start Chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {levelConvos && levelConvos.length > 0 ? (
              <div className="p-2 space-y-1">
                <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Recent</p>
                {levelConvos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConversationId(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${activeConversationId === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                  >
                    <div className="font-medium truncate">{SUBJECT_EMOJIS[c.subject ?? ""] ?? "📚"} {c.subject}</div>
                    <div className={`text-xs truncate mt-0.5 ${activeConversationId === c.id ? "opacity-80" : "text-muted-foreground"}`}>{c.title}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No sessions yet. Start one above!
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="col-span-1 md:col-span-3 border rounded-xl bg-card flex flex-col overflow-hidden">
          {!activeConversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary opacity-60" />
              </div>
              <div>
                <p className="font-medium text-foreground">Ready to study {level}?</p>
                <p className="text-sm mt-1">Pick a subject and start a session — ask about any topic, past paper question, or concept.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs text-xs">
                {["Explain a concept", "Check my answer", "Past paper help", "Revision summary"].map(s => (
                  <div key={s} className="bg-muted rounded-lg px-3 py-2 text-center text-muted-foreground">{s}</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-base">
                  {SUBJECT_EMOJIS[conversation?.subject ?? ""] ?? "📚"}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{conversation?.subject}</h3>
                  <p className="text-xs text-muted-foreground">Cambridge {conversation?.level}</p>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages?.length === 0 && !isStreaming && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <p>Session started! Ask any {conversation?.subject} question.</p>
                    <p className="text-xs mt-2 opacity-70">Try: "Explain [topic]", "Give me a practice question", "What does [command word] mean?"</p>
                  </div>
                )}
                {messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">
                        🎓
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}>
                      <p
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                      />
                    </div>
                  </div>
                ))}
                {isStreaming && streamedResponse && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">
                      🎓
                    </div>
                    <div className="max-w-[78%] rounded-2xl rounded-bl-sm px-4 py-3 bg-muted">
                      <p
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatMessage(streamedResponse) }}
                      />
                      <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded" />
                    </div>
                  </div>
                )}
                {isStreaming && !streamedResponse && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-sm mr-2 flex-shrink-0">🎓</div>
                    <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-muted flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="p-4 border-t bg-card flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask about ${conversation?.subject ?? 'your subject'}...`}
                  disabled={isStreaming}
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }}}
                />
                <Button type="submit" disabled={isStreaming || !input.trim()} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
