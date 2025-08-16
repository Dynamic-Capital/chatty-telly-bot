export class SupabaseClient {}

export function createClient(..._args) {
  const state = globalThis.__SUPA_MOCK__ || { tables: {} };
  return {
    from(table) {
      const rows = state.tables[table] || [];
      let col = null;
      let val = null;
      let op = null;
      let payload = null;
      let lastInsert = null;
      /** @type {any} */
      const api = {
        error: null,
        data: null,
        select(..._args) {
          return api;
        },
        insert(vals, _opts) {
          op = "insert";
          const arr = Array.isArray(vals) ? vals : [vals];
          arr.forEach((v) => rows.push(v));
          lastInsert = arr[0];
          return api;
        },
        update(vals, _opts) {
          op = "update";
          payload = vals;
          return api;
        },
        upsert(vals, _opts) {
          const arr = Array.isArray(vals) ? vals : [vals];
          arr.forEach((v) => {
            const idx = rows.findIndex((r) =>
              String(r.telegram_user_id) === String(v.telegram_user_id)
            );
            if (idx >= 0) rows[idx] = { ...rows[idx], ...v };
            else rows.push(v);
          });
          return Promise.resolve({ data: arr, error: null });
        },
        delete(..._args) {
          op = "delete";
          return api;
        },
        eq(c, v) {
          col = c;
          val = v;
          return api;
        },
        like(..._args) {
          return api;
        },
        gt(..._args) {
          return api;
        },
        gte(..._args) {
          return api;
        },
        lt(..._args) {
          return api;
        },
        lte(..._args) {
          return api;
        },
        or(..._args) {
          return api;
        },
        order(..._args) {
          return api;
        },
        limit(..._args) {
          return api;
        },
        single: async () => {
          if (op === "insert") return { data: lastInsert, error: null };
          if (op === "update") {
            const r = rows.find((r) =>
              col ? String(r[col]) === String(val) : true
            );
            if (r) Object.assign(r, payload);
            return { data: r || null, error: null };
          }
          if (op === "delete") {
            const idx = rows.findIndex((r) =>
              col ? String(r[col]) === String(val) : false
            );
            const r = idx >= 0 ? rows.splice(idx, 1)[0] : null;
            return { data: r, error: null };
          }
          const r = rows.find((r) =>
            col ? String(r[col]) === String(val) : true
          );
          return { data: r, error: null };
        },
        maybeSingle: async () => {
          const res = await api.single();
          return { data: res.data ?? null, error: res.error };
        },
      };
      return api;
    },
    storage: {
      from(_bucket) {
        return {
          upload: async (..._args) => ({ data: null, error: null }),
        };
      },
    },
    rpc(name, params) {
      if (name === "rl_touch") {
        const rl = state.rl || (state.rl = {});
        const now = Date.now();
        const rec = rl[params._tg] || { count: 0, ts: now };
        if (now - rec.ts > 60_000) {
          rec.count = 0;
          rec.ts = now;
        }
        rec.count++;
        rl[params._tg] = rec;
        if (rec.count > params._limit) {
          return Promise.resolve({
            data: null,
            error: { message: "rate_limited" },
          });
        }
        return Promise.resolve({ data: { count: rec.count }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}
