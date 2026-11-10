import { Platform } from "react-native";

export type TodoLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  location: TodoLocation | null;
};

type BackendTodo = {
  _id: string;
  title: string;
  completed?: boolean;
  location?: TodoLocation | null;
};

const defaultApiUrl = Platform.select({
  android: "http://10.0.2.2:5000",
  default: "http://localhost:5000",
});

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  defaultApiUrl ||
  "http://localhost:5000"
).replace(/\/$/, "");

const TODOS_URL = `${API_URL}/api/todos`;

const mapTodo = (todo: BackendTodo): Todo => ({
  id: todo._id,
  title: todo.title,
  completed: Boolean(todo.completed),
  location: todo.location ?? null,
});

const requestJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const getTodos = async () => {
  const todos = await requestJson<BackendTodo[]>(TODOS_URL);

  return todos.map(mapTodo);
};

export const createTodo = async (
  title: string,
  location: TodoLocation | null,
) => {
  const todo = await requestJson<BackendTodo>(TODOS_URL, {
    method: "POST",
    body: JSON.stringify({
      title,
      location,
    }),
  });

  return mapTodo(todo);
};

export const updateTodo = async (
  id: string,
  updates: Partial<Pick<Todo, "title" | "completed" | "location">>,
) => {
  const todo = await requestJson<BackendTodo>(`${TODOS_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });

  return mapTodo(todo);
};

export const removeTodo = async (id: string) => {
  await requestJson<{ message: string }>(`${TODOS_URL}/${id}`, {
    method: "DELETE",
  });
};
