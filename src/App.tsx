/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  PlusCircle, 
  Trash2, 
  MessageSquare,
  Sparkles,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  // Load chats from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("gemini_chats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Fix dates
        const formatted = parsed.map((c: any) => ({
          ...c,
          updatedAt: new Date(c.updatedAt),
          messages: c.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }));
        setChats(formatted);
        if (formatted.length > 0) {
          setActiveChatId(formatted[0].id);
        }
      } catch (e) {
        console.error("Failed to load chats", e);
      }
    }
  }, []);

  // Save chats to local storage
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem("gemini_chats", JSON.stringify(chats));
    }
  }, [chats]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat?.messages, isLoading]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Conversation",
      messages: [],
      updatedAt: new Date()
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chats.filter(c => c.id !== id);
    setChats(updated);
    if (activeChatId === id) {
      setActiveChatId(updated.length > 0 ? updated[0].id : null);
    }
    if (updated.length === 0) {
      localStorage.removeItem("gemini_chats");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let chatId = activeChatId;
    let currentChats = [...chats];

    // Create chat if none exists
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: input.slice(0, 30) + (input.length > 30 ? "..." : ""),
        messages: [],
        updatedAt: new Date()
      };
      currentChats = [newChat, ...chats];
      chatId = newChat.id;
      setChats(currentChats);
      setActiveChatId(chatId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    // Update state immediately for user message
    const updatedChats = currentChats.map(c => {
      if (c.id === chatId) {
        // Update title if it's the first message
        const title = c.messages.length === 0 ? input.slice(0, 40) + (input.length > 40 ? "..." : "") : c.title;
        return {
          ...c,
          title,
          messages: [...c.messages, userMessage],
          updatedAt: new Date()
        };
      }
      return c;
    });

    setChats(updatedChats);
    setInput("");
    setIsLoading(true);

    try {
      const chatContext = updatedChats.find(c => c.id === chatId);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: input, 
          history: chatContext?.messages.slice(0, -1).map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        content: data.text,
        timestamp: new Date()
      };

      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, messages: [...c.messages, aiMessage], updatedAt: new Date() } 
          : c
      ));
    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "model",
        content: "Draft: " + error.message || "I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, messages: [...c.messages, errorMessage], updatedAt: new Date() } 
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#fafaf9] text-[#1c1917] font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Sidebar */}
      <aside className="w-72 border-r border-[#e7e5e4] flex flex-col bg-white overflow-hidden shrink-0">
        <div className="p-4 border-bottom border-[#e7e5e4]">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1c1917] text-white rounded-xl hover:bg-[#292524] transition-all font-medium text-sm shadow-sm active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`w-full group text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-colors ${
                activeChatId === chat.id 
                  ? "bg-[#f5f5f4] text-[#1c1917]" 
                  : "text-[#57534e] hover:bg-[#fafaf9] hover:text-[#1c1917]"
              }`}
            >
              <MessageSquare className={`w-4 h-4 shrink-0 ${activeChatId === chat.id ? "text-orange-500" : "text-[#d6d3d1]"}`} />
              <span className="truncate text-sm font-medium flex-1">{chat.title}</span>
              <Trash2 
                onClick={(e) => deleteChat(chat.id, e)}
                className="w-4 h-4 text-[#d6d3d1] opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all shrink-0" 
              />
            </button>
          ))}
          {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="w-8 h-8 text-[#e7e5e4] mb-3" />
              <p className="text-xs text-[#a8a29e] font-medium uppercase tracking-wider">No history found</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#e7e5e4] bg-[#fafaf9]/50">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs">
              M
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[#44403c]">Free User</span>
              <span className="text-[10px] text-[#a8a29e] font-bold uppercase tracking-widest">Flash Lite</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col bg-white relative">
        {/* Header */}
        <header className="h-16 border-b border-[#e7e5e4] flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-200">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#1c1917]">Gemini Flash</h1>
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Operational
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-100 rounded-full">
              <Sparkles className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] font-bold text-orange-700 uppercase tracking-widest">Free Tier</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-8"
        >
          <div className="max-w-3xl mx-auto space-y-8">
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mb-6 animate-bounce-subtle">
                  <Bot className="w-10 h-10 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#1c1917] mb-2">How can I help you today?</h2>
                <p className="text-[#a8a29e] max-w-sm mx-auto text-sm leading-relaxed">
                  Start a conversation with Gemini Flash. It's fast, smart, and ready to assist with your questions.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {activeChat.messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                      message.role === "user" ? "bg-[#1c1917]" : "bg-orange-500"
                    }`}>
                      {message.role === "user" ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                    </div>
                    <div className={`flex flex-col max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed ${
                        message.role === "user" 
                          ? "bg-[#1c1917] text-white rounded-tr-none" 
                          : "bg-[#f5f5f4] text-[#1c1917] rounded-tl-none border border-[#e7e5e4]"
                      }`}>
                        <div className="prose prose-sm max-w-none prose-stone dark:prose-invert">
                          <Markdown>{message.content}</Markdown>
                        </div>
                      </div>
                      <span className="mt-1.5 text-[10px] text-[#a8a29e] font-medium tracking-wide">
                        {new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(message.timestamp)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="px-5 py-3 rounded-2xl bg-[#f5f5f4] border border-[#e7e5e4] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span className="text-sm text-[#78716c] font-medium">Generating response...</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="p-6 border-t border-[#e7e5e4] bg-white">
          <div className="max-w-3xl mx-auto relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
              className="w-full bg-[#f5f5f4] text-[#1c1917] text-sm rounded-2xl px-5 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-orange-200 border-none transition-all resize-none min-h-[56px] max-h-32 scrollbar-none"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`absolute right-2 top-[50%] -translate-y-[50%] w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading
                  ? "bg-[#1c1917] text-white hover:bg-orange-500 hover:scale-105"
                  : "bg-[#d6d3d1] text-white cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-center mt-3 text-[10px] text-[#a8a29e] font-medium tracking-wide">
            Powered by Gemini 3 Flash Preview &bull; Free Tier AI
          </p>
        </div>
      </main>
      
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
