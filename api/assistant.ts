import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gpt-5.6-luna";

function istanbulDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysToDateKey(
  key: string,
  days: number,
) {
  const date = new Date(
    `${key}T12:00:00+03:00`,
  );

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function isoWeekday(key: string) {
  const date = new Date(
    `${key}T12:00:00+03:00`,
  );

  const day = date.getUTCDay();

  return day === 0 ? 7 : day;
}

function nextWeekdayDate(
  from: string,
  targetWeekday: number,
) {
  const current = isoWeekday(from);

  const diff =
    (targetWeekday - current + 7) % 7;

  return addDaysToDateKey(
    from,
    diff,
  );
}

function outputText(response: any): string {
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return "";
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description: "Kullanıcıya Türkçe doğal cevap.",
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: [
              "create_task",
              "reschedule_task",
              "complete_task",
              "create_project",
              "create_project_plan",
              "create_project_step",
              "complete_project_step",
              "create_schedule_event",
              "create_weekly_schedule_series",
              "cancel_schedule_event",
              "create_memory",
              "none"
            ],
          },
          entity_id: {
            type: ["string", "null"],
          },
          title: {
            type: ["string", "null"],
          },
          description: {
            type: ["string", "null"],
          },
          scheduled_date: {
            type: ["string", "null"],
          },
          start_time: {
            type: ["string", "null"],
          },
          estimated_minutes: {
            type: ["integer", "null"],
          },
          priority: {
            type: ["string", "null"],
            enum: ["low", "medium", "high", null],
          },
          project_id: {
            type: ["string", "null"],
          },
          project_step_id: {
            type: ["string", "null"],
          },
          step_order: {
            type: ["integer", "null"],
          },
          weekday: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 7,
          },
          repeat_weeks: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 30,
          },
          steps: {
            type: ["array", "null"],
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: {
                  type: "string",
                },
                description: {
                  type: ["string", "null"],
                },
                estimated_minutes: {
                  type: ["integer", "null"],
                }
              },
              required: [
                "title",
                "description",
                "estimated_minutes"
              ]
            }
          },
        },
        required: [
          "type",
          "entity_id",
          "title",
          "description",
          "scheduled_date",
          "start_time",
          "estimated_minutes",
          "priority",
          "project_id",
          "project_step_id",
          "step_order",
          "weekday",
          "repeat_weeks",
          "steps"
        ],
      },
    },
  },
  required: ["reply", "actions"],
};

const SYSTEM_PROMPT = `
Sen kullanıcının kişisel günlük planlama asistanısın.

Amacın:
- Kullanıcının gerçek verilerini dikkate almak.
- Gününü ve haftasını gerçekçi planlamak.
- Aktif projelerde ilerlemeyi takip etmek.
- Bir proje adımı tamamlandığında sıradaki mantıklı adıma geçmek.
- Ders, etkinlik ve mevcut tasklarla çakışma yaratmamak.
- Kullanıcının kalıcı tercihlerini ve hedeflerini dikkate almak.

Kurallar:
1. Database context gerçek kaynaktır. Olmayan ders, deadline, proje veya task uydurma.
1a. Alışkanlıklarda bugünkü durum için SADECE habits içindeki checked_today alanını kullan. recent_habit_checks geçmiş günleri de içerir; geçmiş bir check kaydını bugün tamamlanmış gibi yorumlama.
2. Kullanıcı açıkça "ekle", "taşı", "tamamlandı yap", "bitirdim", "kaydet" gibi bir değişiklik istiyorsa action üret.
3. Kullanıcı bir proje adımını bitirdiğini söylüyorsa ve o adım context'te varsa complete_project_step kullan.
4. Sonraki proje adımı belliyse, kullanıcının programında uygun bir zaman varsa create_task ile sıradaki adımı planlayabilirsin.
5. Aynı task zaten varsa duplicate task oluşturma.
6. scheduled_date her zaman YYYY-MM-DD olsun.
7. start_time varsa HH:MM şeklinde olsun.
8. Kullanıcı kalıcı bir tercih, hedef veya çalışma alışkanlığı söylüyorsa create_memory kullan.
9. Bir haftayı tamamen yeniden düzenlemek gibi çok büyük bir değişiklik 3'ten fazla kayıt değiştiriyorsa önce öneriyi açıkla; action üretme. Kullanıcı "uygula" derse uygula.
10. Küçük ve açık değişiklikleri doğrudan uygula.
11. Cevabı Türkçe ver.
12. Gereksiz uzun konuşma yapma; ne değiştirdiğini net söyle.
13. Kullanıcı yeni bir proje ve birden fazla roadmap adımı verirse create_project_plan kullan. Bu action project ve tüm adımlarını tek seferde oluşturur.
14. create_project_plan içindeki steps sırası yapılma sırasıdır.
15. Bir proje zaten varsa aynı projeyi tekrar oluşturma.
16. Kullanıcı ders, randevu veya etkinlik eklemek isterse create_schedule_event kullan.
17. Kullanıcı bir etkinliğin iptal olduğunu söylerse mevcut context'teki doğru etkinliği bul ve cancel_schedule_event kullan.
18. Bir task için saat seçerken upcoming_schedule içindeki etkinliklerle çakıştırma.
19. Kullanıcı belirli saat vermediyse ve bir güne task yerleştirmeni istiyorsa o günün mevcut programına göre makul bir boşluk seç.
20. Çalışma tasklarını mümkünse 08:00-22:00 arasında planla.
21. Kullanıcı her hafta tekrar eden bir ders veya etkinlik söylüyorsa create_weekly_schedule_series kullan.
22. weekday ISO standardıdır: Pazartesi=1, Salı=2, Çarşamba=3, Perşembe=4, Cuma=5, Cumartesi=6, Pazar=7.
23. repeat_weeks kullanıcı belirtmezse 16 kullan.
24. scheduled_date haftalık serinin başlayabileceği en erken tarihtir. Kullanıcı başlangıç tarihi belirtmediyse null bırak.
25. Tek seferlik ders veya etkinlik için create_schedule_event kullan.
26. Kullanıcı açıkça haftalık ders programını tanımlıyorsa bir mesajda birden fazla create_weekly_schedule_series action üretebilirsin; bu durum toplu değişiklik onayı kuralının istisnasıdır.
`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!openaiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing on server",
      });
    }

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase environment variables missing",
      });
    }

    const authorization = req.headers.authorization ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const token = authorization.slice("Bearer ".length);

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid session",
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body ?? {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const history = Array.isArray(body.history)
      ? body.history.slice(-8)
      : [];

    const today = istanbulDate();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const twoWeeksLater = istanbulDate(futureDate);

    const monthAgoDate = new Date();
    monthAgoDate.setDate(monthAgoDate.getDate() - 30);
    const monthAgo = istanbulDate(monthAgoDate);

    const [
      profileResult,
      tasksResult,
      projectsResult,
      stepsResult,
      scheduleResult,
      habitsResult,
      checksResult,
      memoriesResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),

      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .order("scheduled_date", {
          ascending: true,
          nullsFirst: false,
        })
        .limit(100),

      supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(30),

      supabase
        .from("project_steps")
        .select("*")
        .eq("user_id", user.id)
        .order("step_order", {
          ascending: true,
        })
        .limit(200),

      supabase
        .from("schedule_events")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte(
          "start_at",
          `${today}T00:00:00+03:00`,
        )
        .lte(
          "start_at",
          `${twoWeeksLater}T23:59:59+03:00`,
        )
        .order("start_at", {
          ascending: true,
        }),

      supabase
        .from("habits")
        .select("id,name,color")
        .eq("user_id", user.id),

      supabase
        .from("habit_checks")
        .select("habit_id,day")
        .eq("user_id", user.id)
        .gte("day", monthAgo),

      supabase
        .from("memories")
        .select("category,content,importance")
        .eq("user_id", user.id)
        .order("importance", {
          ascending: false,
        })
        .limit(40),
    ]);

    const todayCheckedHabitIds = new Set(
      (checksResult.data ?? [])
        .filter((check: any) => check.day === today)
        .map((check: any) => check.habit_id),
    );

    const habitsWithTodayStatus = (
      habitsResult.data ?? []
    ).map((habit: any) => ({
      ...habit,
      checked_today:
        todayCheckedHabitIds.has(habit.id),
    }));

    const context = {
      current_date: today,
      timezone: "Europe/Istanbul",

      profile: profileResult.data ?? null,

      active_tasks:
        tasksResult.data ?? [],

      active_projects:
        projectsResult.data ?? [],

      project_steps:
        stepsResult.data ?? [],

      upcoming_schedule:
        scheduleResult.data ?? [],

      habits:
        habitsWithTodayStatus,

      today_completed_habit_ids:
        Array.from(todayCheckedHabitIds),

      recent_habit_checks:
        checksResult.data ?? [],

      memories:
        memoriesResult.data ?? [],
    };

    const conversationText = history
      .map((item: any) => {
        const role =
          item?.role === "assistant"
            ? "ASSISTANT"
            : "USER";

        const content =
          typeof item?.content === "string"
            ? item.content
            : "";

        return `${role}: ${content}`;
      })
      .join("\n");

    const prompt = `
CURRENT DATABASE CONTEXT:
${JSON.stringify(context)}

RECENT CONVERSATION:
${conversationText || "(none)"}

CURRENT USER MESSAGE:
${message}
`;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          store: false,

          reasoning: {
            effort: "low",
          },

          instructions: SYSTEM_PROMPT,

          input: prompt,

          max_output_tokens: 1800,

          text: {
            format: {
              type: "json_schema",
              name: "personal_planner_response",
              strict: true,
              schema,
            },
          },
        }),
      },
    );

    const raw = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI error:", raw);

      return res.status(500).json({
        error:
          raw?.error?.message ??
          "OpenAI request failed",
      });
    }

    const text = outputText(raw);

    if (!text) {
      console.error("Missing model output:", raw);

      return res.status(500).json({
        error: "AI returned no text",
      });
    }

    const result = JSON.parse(text);

    const applied: any[] = [];

    for (const action of result.actions ?? []) {
      if (action.type === "none") {
        continue;
      }

      if (
        action.type === "create_task" &&
        action.title
      ) {
        const insert = {
          user_id: user.id,
          title: action.title,
          description:
            action.description ?? null,
          scheduled_date:
            action.scheduled_date ?? null,
          start_time:
            action.start_time ?? null,
          estimated_minutes:
            action.estimated_minutes ?? null,
          priority:
            action.priority ?? "medium",
          status: "todo",
          project_id:
            action.project_id ?? null,
          project_step_id:
            action.project_step_id ?? null,
          ai_created: true,
        };

        const { data, error } = await supabase
          .from("tasks")
          .insert(insert)
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type === "reschedule_task" &&
        action.entity_id &&
        action.scheduled_date
      ) {
        const update: Record<string, any> = {
          scheduled_date:
            action.scheduled_date,
        };

        if (action.start_time) {
          update.start_time =
            action.start_time;
        }

        const { data, error } = await supabase
          .from("tasks")
          .update(update)
          .eq("id", action.entity_id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type === "complete_task" &&
        action.entity_id
      ) {
        const { data, error } = await supabase
          .from("tasks")
          .update({
            status: "completed",
          })
          .eq("id", action.entity_id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type === "create_project_plan" &&
        action.title
      ) {
        const { data: project, error: projectError } =
          await supabase
            .from("projects")
            .insert({
              user_id: user.id,
              title: action.title,
              description:
                action.description ?? null,
              priority:
                action.priority ?? "medium",
              status: "active",
            })
            .select()
            .single();

        if (projectError) {
          throw projectError;
        }

        const steps = Array.isArray(action.steps)
          ? action.steps
          : [];

        let createdSteps: any[] = [];

        if (steps.length > 0) {
          const rows = steps.map(
            (step: any, index: number) => ({
              user_id: user.id,
              project_id: project.id,
              title: step.title,
              description:
                step.description ?? null,
              estimated_minutes:
                step.estimated_minutes ?? null,
              step_order: index + 1,
              status: "todo",
            }),
          );

          const {
            data,
            error: stepError,
          } = await supabase
            .from("project_steps")
            .insert(rows)
            .select();

          if (stepError) {
            throw stepError;
          }

          createdSteps = data ?? [];
        }

        applied.push({
          type: action.type,
          data: {
            project,
            steps: createdSteps,
          },
        });

        continue;
      }

      if (
        action.type === "create_project" &&
        action.title
      ) {
        const { data, error } = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            title: action.title,
            description:
              action.description ?? null,
            priority:
              action.priority ?? "medium",
            status: "active",
          })
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type ===
          "create_project_step" &&
        action.project_id &&
        action.title
      ) {
        const { data, error } = await supabase
          .from("project_steps")
          .insert({
            user_id: user.id,
            project_id:
              action.project_id,
            title: action.title,
            description:
              action.description ?? null,
            estimated_minutes:
              action.estimated_minutes ?? null,
            step_order:
              action.step_order ?? 0,
            status: "todo",
          })
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type ===
          "complete_project_step" &&
        action.entity_id
      ) {
        const { data, error } = await supabase
          .from("project_steps")
          .update({
            status: "done",
          })
          .eq("id", action.entity_id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type === "create_weekly_schedule_series" &&
        action.title &&
        action.weekday &&
        action.start_time
      ) {
        const weekday = Math.min(
          7,
          Math.max(
            1,
            Number(action.weekday),
          ),
        );

        const repeatWeeks = Math.min(
          30,
          Math.max(
            1,
            Number(
              action.repeat_weeks ?? 16,
            ),
          ),
        );

        const duration =
          action.estimated_minutes ?? 60;

        const baseDate =
          action.scheduled_date ?? today;

        const firstDate =
          nextWeekdayDate(
            baseDate,
            weekday,
          );

        const seriesId =
          randomUUID();

        const rows = [];

        for (
          let i = 0;
          i < repeatWeeks;
          i++
        ) {
          const eventDate =
            addDaysToDateKey(
              firstDate,
              i * 7,
            );

          const start =
            new Date(
              `${eventDate}T${action.start_time}:00+03:00`,
            );

          const end =
            new Date(
              start.getTime() +
                duration *
                  60 *
                  1000,
            );

          rows.push({
            user_id: user.id,
            title: action.title,
            description:
              action.description ?? null,
            start_at:
              start.toISOString(),
            end_at:
              end.toISOString(),
            recurrence: "weekly",
            series_id: seriesId,
            status: "active",
          });
        }

        const {
          data,
          error,
        } = await supabase
          .from("schedule_events")
          .upsert(
            rows,
            {
              onConflict:
                "user_id,title,start_at",
            },
          )
          .select(
            "id,title,start_at,end_at,series_id"
          );

        if (error) {
          throw error;
        }

        applied.push({
          type: action.type,
          data: {
            series_id: seriesId,
            created_count:
              data?.length ?? 0,
            first_date:
              firstDate,
            repeat_weeks:
              repeatWeeks,
          },
        });

        continue;
      }

      if (
        action.type === "create_schedule_event" &&
        action.title &&
        action.scheduled_date &&
        action.start_time
      ) {
        const duration =
          action.estimated_minutes ?? 60;

        const start = new Date(
          `${action.scheduled_date}T${action.start_time}:00+03:00`
        );

        const end = new Date(
          start.getTime() +
          duration * 60 * 1000
        );

        const { data, error } =
          await supabase
            .from("schedule_events")
            .insert({
              user_id: user.id,
              title: action.title,
              description:
                action.description ?? null,
              start_at:
                start.toISOString(),
              end_at:
                end.toISOString(),
              status: "active",
            })
            .select()
            .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type === "cancel_schedule_event" &&
        action.entity_id
      ) {
        const { data, error } =
          await supabase
            .from("schedule_events")
            .update({
              status: "cancelled",
            })
            .eq(
              "id",
              action.entity_id,
            )
            .eq(
              "user_id",
              user.id,
            )
            .select()
            .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });

        continue;
      }

      if (
        action.type === "create_memory" &&
        action.description
      ) {
        const { data, error } = await supabase
          .from("memories")
          .insert({
            user_id: user.id,
            category:
              action.title ??
              "general",
            content:
              action.description,
            importance: 5,
          })
          .select()
          .single();

        if (error) throw error;

        applied.push({
          type: action.type,
          data,
        });
      }
    }

    return res.status(200).json({
      reply: result.reply,
      applied,
      usage: raw.usage ?? null,
      model: MODEL,
    });
  } catch (error: any) {
    console.error("Assistant error:", error);

    return res.status(500).json({
      error:
        error?.message ??
        "Unexpected assistant error",
    });
  }
}
