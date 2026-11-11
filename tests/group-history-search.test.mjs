import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { filterGroupSessionHistory } from "../src/utils/groupHistorySearch.js";

const require = createRequire(import.meta.url);
const builtComponent = buildSync({
  entryPoints: [new URL("../src/components/GroupHistorySearch.jsx", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  write: false,
}).outputFiles[0].text;
const componentModule = { exports: {} };
new Function("require", "module", "exports", builtComponent)(
  require,
  componentModule,
  componentModule.exports,
);
const GroupHistorySearch = componentModule.exports.default;

const games = [
  { id: "sky-team", title: "Sky Team" },
  { id: "azul-id", title: "Azul" },
  { id: "wingspan", title: "Wingspan" },
];

const records = [
  {
    id: "newest",
    winnerGameId: "sky-team",
    playedGameIds: ["sky-team", "azul-id"],
    participantIds: ["catan"],
    metrics: [{ name: "Catan", value: 42 }],
  },
  {
    id: "middle",
    winnerGameId: "wingspan",
    playedGameIds: ["wingspan"],
    participantIds: ["azul-id"],
    metrics: [{ name: "Azul", value: 7 }],
  },
  {
    id: "legacy",
    winnerGameId: "legacy-game-id",
    participantIds: ["sky-team"],
  },
];

test("search matches only selected and additionally played game titles", () => {
  const catan = filterGroupSessionHistory(records, games, " cAtAn ");
  assert.deepEqual(catan.records, []);
  assert.equal(catan.total, 3);
  assert.equal(catan.matches, 0);

  const azul = filterGroupSessionHistory(records, games, "AZUL");
  assert.deepEqual(azul.records.map((play) => play.id), ["newest"]);

  const selectedTitle = filterGroupSessionHistory(records, games, "sky team");
  assert.deepEqual(selectedTitle.records.map((play) => play.id), ["newest"]);

  const legacyFallback = filterGroupSessionHistory(records, games, "LEGACY-GAME");
  assert.deepEqual(legacyFallback.records.map((play) => play.id), ["legacy"]);
});

test("search preserves input order and shows every record for a blank query", () => {
  const result = filterGroupSessionHistory(records, games, "  ");
  assert.deepEqual(result.records, records);
  assert.equal(result.total, 3);
  assert.equal(result.matches, 3);
});

test("history search passes filtered records to the renderer and preserves an empty archive", () => {
  const markup = renderToStaticMarkup(
    createElement(
      GroupHistorySearch,
      {
        records: records.slice(0, 1),
        games,
        children: (visibleRecords) => createElement(
          "ul",
          null,
          visibleRecords.map((play) => createElement("li", { key: play.id }, play.id)),
        ),
      },
    ),
  );
  assert.match(markup, /<label[^>]*for="[^"]+"[^>]*>Search played games<\/label>/);
  assert.match(markup, /type="search"/);
  assert.match(markup, /<li>newest<\/li>/);

  const emptyMarkup = renderToStaticMarkup(
    createElement(GroupHistorySearch, {
      records: [],
      children: () => createElement("p", null, "No session history yet."),
    }),
  );
  assert.match(emptyMarkup, /No session history yet\./);
  assert.doesNotMatch(emptyMarkup, /No sessions match/);
});

test("history search announces loading and load errors accessibly", () => {
  const loadingMarkup = renderToStaticMarkup(
    createElement(GroupHistorySearch, { loading: true, records }, createElement("p", null, "stale")),
  );
  assert.match(loadingMarkup, /aria-busy="true"/);
  assert.match(loadingMarkup, /role="status"[^>]*>Loading session history/);
  assert.doesNotMatch(loadingMarkup, /stale/);

  const errorMarkup = renderToStaticMarkup(
    createElement(GroupHistorySearch, { error: new Error("offline"), onRetry: () => {} }),
  );
  assert.match(errorMarkup, /role="alert"/);
  assert.match(errorMarkup, />Retry<\/button>/);
});
