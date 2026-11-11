import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, getDocs, onSnapshot, query, where } from "firebase/firestore";

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-boardgame-night",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

after(async () => {
  await environment.cleanup();
});

test("rapid analytics listener teardown leaves Firestore usable after a denied query", { timeout: 30000 }, async () => {
  const uid = "analytics-listener-test";
  const db = environment.authenticatedContext(uid).firestore();
  const participantPlays = query(collectionGroup(db, "plays"), where("participantIds", "array-contains", uid));
  const errors = [];

  for (let i = 0; i < 30; i++) {
    const unsubscribe = onSnapshot(participantPlays, () => {}, (error) => errors.push(error));
    unsubscribe();
  }

  const denied = await new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(participantPlays, () => {
      unsubscribe();
      reject(new Error("Expected the collection-group query to be denied"));
    }, (error) => {
      unsubscribe();
      resolve(error);
    });
  });

  assert.equal(denied.code, "permission-denied");
  assert.ok(errors.every((error) => error.code === "permission-denied"));
  const games = await getDocs(collection(db, "games"));
  assert.ok(Array.isArray(games.docs));
});
