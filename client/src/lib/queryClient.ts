import { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const CACHE_STORAGE_KEY = "buzzly.apiQueryCache.v1";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CACHEABLE_API_PREFIXES = [
  "/api/assets",
  "/api/jobs",
  "/api/settings",
  "/api/script-prompts",
  "/api/elevenlabs/voices",
  "/api/elevenlabs/models",
];

type StoredQueryCache = Record<string, { data: unknown; updatedAt: number }>;

const queryKeyToUrl = (queryKey: QueryKey) => queryKey.map(String).join("/");
const isCacheableQuery = (queryKey: QueryKey) => {
  const url = queryKeyToUrl(queryKey);
  if (url === "/api/assets/media-urls") return false;
  return CACHEABLE_API_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));
};

const readStoredCache = (): StoredQueryCache => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_STORAGE_KEY) || "{}") as StoredQueryCache;
  } catch {
    return {};
  }
};

const writeStoredCache = (cache: StoredQueryCache) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage can be full on mobile Safari. The network cache still works.
  }
};

export function hydrateCachedApiQueries() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const stored = readStoredCache();
  let changed = false;

  Object.entries(stored).forEach(([key, entry]) => {
    if (!entry || now - entry.updatedAt > CACHE_MAX_AGE_MS) {
      delete stored[key];
      changed = true;
      return;
    }
    try {
      const queryKey = JSON.parse(key) as QueryKey;
      if (isCacheableQuery(queryKey)) {
        queryClient.setQueryData(queryKey, entry.data, { updatedAt: entry.updatedAt });
      }
    } catch {
      delete stored[key];
      changed = true;
    }
  });

  if (changed) writeStoredCache(stored);
}

export function invalidateAssetsCache() {
  queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
  queryClient.invalidateQueries({ queryKey: ["/api/assets/media-urls"] });
}

export function clearCachedApiQueries() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  }
  CACHEABLE_API_PREFIXES.forEach((prefix) => {
    queryClient.removeQueries({ predicate: (query) => {
      const url = queryKeyToUrl(query.queryKey);
      return url === prefix || url.startsWith(`${prefix}/`);
    } });
  });
}

queryClient.getQueryCache().subscribe((event) => {
  if (typeof window === "undefined" || event.type !== "updated") return;
  const query = event.query;
  if (query.state.status !== "success" || !isCacheableQuery(query.queryKey)) return;

  const stored = readStoredCache();
  stored[JSON.stringify(query.queryKey)] = {
    data: query.state.data,
    updatedAt: query.state.dataUpdatedAt || Date.now(),
  };
  writeStoredCache(stored);
});
