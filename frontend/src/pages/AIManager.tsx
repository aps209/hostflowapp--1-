import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, Check, Lightbulb, Send, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

const insightClass = {
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
  info: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export default function AIManager() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [actionStatuses, setActionStatuses] = useState({});
  const actionStatusRef = useRef({});
  const conversationId = useMemo(() => crypto.randomUUID?.() || String(Date.now()), []);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["ai-manager-suggestions"],
    queryFn: () => base44.aiManager.suggestions(),
  });

  const chatMutation = useMutation({
    mutationFn: (message) => base44.aiManager.chat(message, conversationId),
    onSuccess: (response) => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.answer,
          insights: response.insights || [],
          actions: response.recommended_actions || [],
        },
      ]);
    },
    onError: (error) => {
      const detail = error?.data?.detail || error?.message || "No se pudo consultar AI Manager";
      setMessages((current) => [...current, { role: "assistant", text: detail }]);
      toast.error(detail);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (action) =>
      base44.aiManager.confirmAction(action.id, action.payload),
    onSuccess: (response, action) => {
      if (response?.success === false || response?.result?.success === false) {
        actionStatusRef.current[action.actionKey] = "failed";
        setActionStatuses((current) => ({ ...current, [action.actionKey]: "failed" }));
        toast.error(response?.result?.error || "No se pudo confirmar la accion");
        return;
      }
      actionStatusRef.current[action.actionKey] = "confirmed";
      setActionStatuses((current) => ({ ...current, [action.actionKey]: "confirmed" }));
      toast.success("Accion confirmada");
    },
    onError: (_error, action) => {
      actionStatusRef.current[action.actionKey] = "failed";
      setActionStatuses((current) => ({ ...current, [action.actionKey]: "failed" }));
      toast.error("No se pudo confirmar la accion");
    },
  });

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          text: "Estoy listo para revisar reservas, ventas, costes, stock y clientes con herramientas internas seguras.",
        },
      ]);
    }
  }, [messages.length]);

  const sendMessage = (value = input) => {
    const message = value.trim();
    if (!message || chatMutation.isPending) return;
    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");
    chatMutation.mutate(message);
  };

  const actionKeyFor = (messageIndex, actionIndex, action) => {
    const payloadKey = JSON.stringify(action.payload || {});
    return `${messageIndex}:${actionIndex}:${action.id}:${payloadKey}`;
  };

  const handleConfirmAction = (messageIndex, actionIndex, action) => {
    const actionKey = actionKeyFor(messageIndex, actionIndex, action);
    if (actionStatusRef.current[actionKey]) return;

    actionStatusRef.current[actionKey] = "pending";
    setActionStatuses((current) => ({ ...current, [actionKey]: "pending" }));
    confirmMutation.mutate({
      actionKey,
      id: action.id,
      payload: action.payload,
    });
  };

  const actionLabel = (action, status) => {
    if (status === "pending") return "Confirmando...";
    if (status === "confirmed") return "Confirmada";
    if (status === "failed") return "Fallida";
    return action.label;
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">AI Manager</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Copiloto para revisar negocio y preparar acciones con confirmacion.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-2 rounded-md border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <ShieldCheck className="h-4 w-4" />
            Tools internas
          </Badge>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Bot className="h-5 w-5" />
                Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[56vh] overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
                          <Bot className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                        </div>
                      )}
                      <div className={`max-w-[82%] rounded-lg border px-4 py-3 text-sm ${
                        message.role === "user"
                          ? "border-slate-800 bg-slate-900 text-white dark:border-slate-600"
                          : "border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      }`}>
                        <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                        {!!message.insights?.length && (
                          <div className="mt-4 grid gap-2">
                            {message.insights.map((insight, insightIndex) => (
                              <div
                                key={`${insight.title}-${insightIndex}`}
                                className={`rounded-md border p-3 ${insightClass[insight.type] || insightClass.info}`}
                              >
                                <p className="font-medium">{insight.title}</p>
                                <p className="mt-1 text-xs leading-5">{insight.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {!!message.actions?.length && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.actions.map((action, actionIndex) => {
                              const actionKey = actionKeyFor(index, actionIndex, action);
                              const status = actionStatuses[actionKey];
                              const isLocked = !!status || !action.requires_confirmation;

                              return (
                                <Button
                                  key={actionKey}
                                  size="sm"
                                  variant={action.requires_confirmation ? "default" : "outline"}
                                  className="rounded-md disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isLocked}
                                  onClick={() => handleConfirmAction(index, actionIndex, action)}
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  {actionLabel(action, status)}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Pregunta por margen, stock, clientes o campanas..."
                    className="min-h-[88px] resize-none bg-white dark:bg-slate-950"
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => sendMessage()} disabled={chatMutation.isPending || !input.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      {chatMutation.isPending ? "Analizando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white">
                  <Lightbulb className="h-5 w-5" />
                  Sugerencias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    className="h-auto w-full justify-start rounded-md whitespace-normal text-left"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-base text-slate-900 dark:text-white">Seguridad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>La IA no ejecuta SQL ni escribe datos directamente.</p>
                <p>Las acciones sensibles pasan por confirmacion y quedan registradas en backend.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
