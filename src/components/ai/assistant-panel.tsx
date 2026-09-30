import {
  Bot,
  LoaderCircle,
  Send,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function AssistantPanel() {
  const [open, setOpen] =
    useState(false);

  const [input, setInput] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [messages, setMessages] =
    useState<Message[]>([
      {
        role: "assistant",
        content:
          "Hazırım. Tasklarını, projelerini ve programını birlikte yönetebiliriz.",
      },
    ]);

  const bottomRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  async function send() {
    const message = input.trim();

    if (!message || loading) {
      return;
    }

    const history =
      messages.slice(-8);

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "Oturum bulunamadı.",
        );
      }

      const response = await fetch(
        "/api/assistant",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message,
            history,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "AI request failed",
        );
      }

      let answer =
        data.reply ??
        "Tamam.";

      if (
        Array.isArray(
          data.applied,
        ) &&
        data.applied.length > 0
      ) {
        answer += `\n\n✓ ${data.applied.length} değişiklik uygulandı.`;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer,
        },
      ]);

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          behavior: "smooth",
        });
      });
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Bir hata oluştu.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            `Hata: ${text}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open ? (
        <section
          className="
            fixed inset-x-3 bottom-20 z-50
            mx-auto flex max-h-[72svh]
            max-w-lg flex-col overflow-hidden
            rounded-2xl border border-border
            bg-background shadow-2xl
            sm:right-6 sm:left-auto sm:mx-0
            sm:w-[420px]
          "
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-foreground text-background">
                <Bot className="size-5" />
              </div>

              <div>
                <p className="font-medium">
                  Personal AI
                </p>
                <p className="text-xs text-muted-foreground">
                  Tasks · Projects · Schedule
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              className="rounded-lg p-2 hover:bg-secondary"
              aria-label="Close assistant"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map(
              (message, index) => (
                <div
                  key={index}
                  className={
                    message.role ===
                    "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-sm text-background"
                      : "mr-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-sm text-secondary-foreground"
                  }
                >
                  {message.content}
                </div>
              ),
            )}

            {loading ? (
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Düşünüyor...
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              rows={1}
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Örn. Yarın için programımı düzenle..."
              className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !input.trim()
              }
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        className="
          fixed right-4 bottom-4 z-50
          flex size-14 items-center
          justify-center rounded-full
          bg-foreground text-background
          shadow-xl transition-transform
          active:scale-95
        "
        aria-label="Open personal AI"
      >
        <Bot className="size-6" />
      </button>
    </>
  );
}
