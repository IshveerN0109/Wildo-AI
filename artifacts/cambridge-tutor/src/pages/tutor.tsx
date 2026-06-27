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
import { O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS, LEVELS } from "@/lib/constants";

export default function Tutor() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  
  const [newSubject, setNewSubject] = useState("");
  const [newLevel, setNewLevel] = useState("");

  const { data: conversations, isLoading: loadingConvos } = useListOpenaiConversations();
  const createConvo = useCreateOpenaiConversation();

  const { data: conversation } = useGetOpenaiConversation(activeConversationId!, {
    query: { enabled: !!activeConversationId, queryKey: getGetOpenaiConversationQueryKey(activeConversationId!) }
  });

  const { data: messages } = useListOpenaiMessages(activeConversationId!, {
    query: { enabled: !!activeConversationId, queryKey: getListOpenaiMessagesQueryKey(activeConversationId!) }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedResponse]);

  const handleStartNew = () => {
    if (!newSubject || !newLevel) return;
    createConvo.mutate({ data: { title: `${newSubject} Chat`, subject: newSubject, level: newLevel } }, {
      onSuccess: (data) => {
        setActiveConversationId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
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

    // Optimistically update UI
    const tempMessage = {
      id: Date.now(),
      conversationId: activeConversationId,
      role: "user",
      content: messageContent,
      createdAt: new Date().toISOString()
    };
    
    queryClient.setQueryData(getListOpenaiMessagesQueryKey(activeConversationId), (old: any) => {
      return old ? [...old, tempMessage] : [tempMessage];
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
        const lines = chunk.split("\n").filter(line => line.trim().startsWith("data: "));
        
        for (const line of lines) {
          const dataStr = line.replace("data: ", "").trim();
          try {
            const data = JSON.parse(dataStr);
            if (data.content) {
              setStreamedResponse(prev => prev + data.content);
            }
            if (data.done) {
              queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(activeConversationId) });
              setIsStreaming(false);
              setStreamedResponse("");
            }
          } catch (e) {
            // Ignore parse errors on chunks
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
      setStreamedResponse("");
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">AI Tutor</h1>
          <p className="text-muted-foreground">Your Cambridge academic companion.</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden">
        {/* Sidebar */}
        <div className="col-span-1 border rounded-lg bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b space-y-4">
            <h2 className="font-medium">New Session</h2>
            <div className="space-y-2">
              <Select value={newLevel} onValueChange={setNewLevel}>
                <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newSubject} onValueChange={setNewSubject} disabled={!newLevel}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {(newLevel === "O Level" ? O_LEVEL_SUBJECTS : A_LEVEL_SUBJECTS).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleStartNew} disabled={!newSubject || !newLevel} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Start
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations?.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConversationId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeConversationId === c.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                <div className="font-medium truncate">{c.title}</div>
                <div className="text-xs opacity-80">{c.subject}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="col-span-1 md:col-span-3 border rounded-lg bg-card flex flex-col overflow-hidden">
          {!activeConversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <Brain className="w-12 h-12 mb-4 opacity-20" />
              <p>Select or start a conversation to begin studying.</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-muted/50">
                <h3 className="font-medium">{conversation?.title}</h3>
                <p className="text-xs text-muted-foreground">{conversation?.subject} • {conversation?.level}</p>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isStreaming && streamedResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                      <p className="text-sm whitespace-pre-wrap">{streamedResponse}</p>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="p-4 border-t bg-card flex gap-2">
                <Input 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder="Ask a question about the syllabus..."
                  disabled={isStreaming}
                />
                <Button type="submit" disabled={isStreaming || !input.trim()}>
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
