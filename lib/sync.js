/**
 * Storage + live sync for the drawing board.
 * Both adapters share one interface; every write (even your own) comes back as an event,
 * so the owner and the viewer render through exactly the same path.
 *
 *   canWrite(): boolean
 *   subscribe(poemId, { added(id, stroke), changed(id, stroke), removed(id) }) -> unsubscribe
 *   startStroke(poemId, stroke) -> id
 *   updateStroke(poemId, id, stroke)
 *   removeStroke(poemId, id)
 *   clear(poemId)
 */

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
function assertSafe(poemId) {
  if (!SAFE_ID.test(poemId)) throw new Error(`poem id not allowed: ${poemId}`);
}

/** In-memory adapter: used for tests and for drawing locally when Firebase is not configured. */
export function createMemorySync() {
  const rooms = new Map(); // poemId -> { strokes: Map, listeners: Set }
  let counter = 0;
  const room = (poemId) => {
    assertSafe(poemId);
    if (!rooms.has(poemId)) rooms.set(poemId, { strokes: new Map(), listeners: new Set() });
    return rooms.get(poemId);
  };
  const emit = (r, type, ...args) => r.listeners.forEach((l) => l[type]?.(...args));
  const copy = (s) => ({ c: s.c, w: s.w, p: s.p.map((pt) => [...pt]) });

  return {
    canWrite: () => true,
    subscribe(poemId, handlers) {
      const r = room(poemId);
      r.listeners.add(handlers);
      for (const [id, s] of r.strokes) handlers.added?.(id, copy(s));
      return () => r.listeners.delete(handlers);
    },
    startStroke(poemId, stroke) {
      const r = room(poemId);
      const id = `s${String(++counter).padStart(6, "0")}`;
      r.strokes.set(id, copy(stroke));
      emit(r, "added", id, copy(stroke));
      return id;
    },
    updateStroke(poemId, id, stroke) {
      const r = room(poemId);
      if (!r.strokes.has(id)) return;
      r.strokes.set(id, copy(stroke));
      emit(r, "changed", id, copy(stroke));
    },
    removeStroke(poemId, id) {
      const r = room(poemId);
      if (r.strokes.delete(id)) emit(r, "removed", id);
    },
    clear(poemId) {
      const r = room(poemId);
      for (const id of [...r.strokes.keys()]) {
        r.strokes.delete(id);
        emit(r, "removed", id);
      }
    },
  };
}

const FIREBASE = "https://www.gstatic.com/firebasejs/10.12.2";

/**
 * Firebase Realtime Database adapter. Reading is public; writing needs the owner's sign-in
 * (enforced by the database rules in docs/firebase-setup.md, not by this code).
 */
export async function createFirebaseSync(config) {
  const [{ initializeApp }, db, authLib] = await Promise.all([
    import(`${FIREBASE}/firebase-app.js`),
    import(`${FIREBASE}/firebase-database.js`),
    import(`${FIREBASE}/firebase-auth.js`),
  ]);
  const app = initializeApp(config);
  const database = db.getDatabase(app);
  const auth = authLib.getAuth(app);
  const strokesRef = (poemId, id) => {
    assertSafe(poemId);
    return db.ref(database, `dibujos/${poemId}/strokes${id ? `/${id}` : ""}`);
  };

  return {
    canWrite: () => Boolean(auth.currentUser),
    login: (email, password) => authLib.signInWithEmailAndPassword(auth, email, password),
    logout: () => authLib.signOut(auth),
    onAuth: (cb) => authLib.onAuthStateChanged(auth, cb),
    subscribe(poemId, handlers) {
      const r = strokesRef(poemId);
      const offs = [
        db.onChildAdded(r, (snap) => handlers.added?.(snap.key, snap.val())),
        db.onChildChanged(r, (snap) => handlers.changed?.(snap.key, snap.val())),
        db.onChildRemoved(r, (snap) => handlers.removed?.(snap.key)),
      ];
      return () => offs.forEach((off) => off());
    },
    startStroke(poemId, stroke) {
      const node = db.push(strokesRef(poemId));
      db.set(node, { c: stroke.c, w: stroke.w, p: stroke.p, t: Date.now() });
      return node.key;
    },
    updateStroke(poemId, id, stroke) {
      db.set(strokesRef(poemId, `${id}/p`), stroke.p);
    },
    removeStroke(poemId, id) {
      db.remove(strokesRef(poemId, id));
    },
    clear(poemId) {
      db.remove(strokesRef(poemId));
    },
  };
}
