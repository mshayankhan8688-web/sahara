import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { readReplyLanguage } from "@/lib/replyLanguage";
import type { SavedPlan, Task } from "@/lib/types";
import { AiReply, Alert, Button, Field, PageHeader, TextArea, TextInput } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function PlannerPage() {
  useDocumentTitle("My day");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [ask, setAsk] = useState("Please plan my day.");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = () => {
    api.tasks().then((result) => setTasks(result.tasks)).catch((loadError) => {
      console.error("Failed to load tasks", loadError);
      setError(loadError instanceof ApiError ? loadError.message : "Tasks could not be loaded.");
    });
    api.plans("day").then((result) => setPlans(result.plans)).catch((loadError) => {
      console.error("Failed to load day plans", loadError);
    });
  };

  useEffect(load, []);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await api.createTask({ title, dueOn, priority });
      setTitle("");
      load();
    } catch (addError) {
      console.error("Failed to add task", addError);
      setError(addError instanceof ApiError ? addError.message : "The task could not be saved.");
    }
  };

  const planDay = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await api.guide({ kind: "day", prompt: ask, replyLanguage: readReplyLanguage() });
      setReply(result.content);
    } catch (planError) {
      console.error("Day plan failed", planError);
      setError(planError instanceof ApiError ? planError.message : "The plan could not be written.");
    } finally {
      setPending(false);
    }
  };

  const doneCount = tasks.filter((task) => task.done).length;

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Routine" title="Plan my day" body="Tasks stay in your account. A day plan from SAHARA is a suggestion, not a schedule that runs by itself." />
      {error ? (
        <Alert>
          <p>{error}</p>
          <button type="button" className="mt-2 text-sm font-semibold" onClick={() => void planDay()} disabled={pending}>Retry</button>
        </Alert>
      ) : null}
      <p className="mt-4 text-sm text-soft">{doneCount} of {tasks.length} tasks done.</p>
      <form onSubmit={(event) => void add(event)} className="panel mt-4 grid max-w-xl gap-3 p-4 sm:p-5">
        <Field label="Task">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date, optional">
            <TextInput type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </Field>
          <Field label="Priority">
            <select className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>
        <Button type="submit" disabled={title.trim().length === 0}>Add task</Button>
      </form>
      <ul className="mt-6 max-w-xl space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="panel flex items-start justify-between gap-3 px-4 py-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => void api.updateTask(task.id, { done: !task.done }).then(load)}
              />
              <span>
                <span className={task.done ? "text-soft line-through" : ""}>{task.title}</span>
                <span className="mt-1 block text-xs text-soft">{task.priority}{task.dueOn ? ` · ${task.dueOn}` : ""}</span>
              </span>
            </label>
            <button type="button" className="text-xs text-accent" onClick={() => void api.deleteTask(task.id).then(load)}>Delete</button>
          </li>
        ))}
      </ul>
      <div className="panel mt-8 max-w-xl space-y-3 p-4 sm:p-5">
        <Field label="Ask SAHARA to shape the day">
          <TextArea rows={3} value={ask} onChange={(event) => setAsk(event.target.value)} />
        </Field>
        <Button type="button" onClick={() => void planDay()} disabled={pending}>{pending ? "Writing…" : "Make a plan"}</Button>
      </div>
      {reply ? (
        <div className="mt-4 max-w-xl">
          <AiReply
            content={reply}
            action={
              <Button variant="ghost" type="button" onClick={() => void api.savePlan({ kind: "day", title: "Day plan", content: reply }).then(load)}>
                Save this plan
              </Button>
            }
          />
        </div>
      ) : null}
      <div className="mt-4 max-w-xl space-y-3">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-line bg-muted p-4 text-sm leading-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">{plan.title}</h2>
              <button type="button" className="text-xs text-accent" onClick={() => void api.deletePlan(plan.id).then(load)}>Delete</button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-soft">{plan.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
